import { DriverError } from "../errors";
import type { ColumnMetadata, S3ConnectionConfig, TableMetadata } from "../types";
import { BaseDriver } from "./driver";

interface S3TableData {
  rows: Record<string, unknown>[];
  autoIncrementId: number;
  meta: {
    columns: ColumnMetadata[];
  };
}

/**
 * S3-based database driver using JSON objects for storage
 */
export class S3Driver extends BaseDriver {
  private config: S3ConnectionConfig;
  private data = new Map<string, S3TableData>();
  private client: any = null;

  constructor(config: S3ConnectionConfig) {
    super();
    this.config = config;
  }

  private getKey(tableName: string): string {
    const prefix = this.config.prefix ? `${this.config.prefix}/` : "";
    return `${prefix}${tableName}.json`;
  }

  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    try {
      const { S3Client, HeadBucketCommand } = await import("@aws-sdk/client-s3");
      const clientConfig: any = {};
      if (this.config.region) {
        clientConfig.region = this.config.region;
      }
      if (this.config.endpoint) {
        clientConfig.endpoint = this.config.endpoint;
        clientConfig.forcePathStyle = true;
      }
      if (this.config.accessKeyId && this.config.secretAccessKey) {
        clientConfig.credentials = {
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey,
        };
      }
      this.client = new S3Client(clientConfig);

      try {
        await this.client.send(new HeadBucketCommand({ Bucket: this.config.bucket }));
      } catch (err: any) {
        if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
          const { CreateBucketCommand } = await import("@aws-sdk/client-s3");
          await this.client.send(new CreateBucketCommand({ Bucket: this.config.bucket }));
        } else if (err.$metadata?.httpStatusCode !== 200) {
          throw err;
        }
      }

      await this.loadAll();
      this.connected = true;
    } catch (err: any) {
      throw new DriverError(`Failed to connect to S3: ${err.message}`);
    }
  }

  async disconnect(): Promise<void> {
    await this.flushAll();
    this.data.clear();
    this.client = null;
    this.connected = false;
  }

  async execute(sql: string, params: unknown[] = []): Promise<any> {
    return this.executeParsed(sql, params);
  }

  async query(sql: string, params: unknown[] = []): Promise<any[]> {
    const result = this.executeParsed(sql, params);
    return Array.isArray(result) ? result : [];
  }

  async tableExists(name: string): Promise<boolean> {
    return this.data.has(name);
  }

  async getTableColumns(name: string): Promise<ColumnMetadata[]> {
    const table = this.data.get(name);
    if (!table) {
      return [];
    }
    return Object.values(table.meta.columns);
  }

  async createTable(meta: TableMetadata): Promise<void> {
    if (this.data.has(meta.name)) {
      return;
    }
    this.data.set(meta.name, {
      rows: [],
      autoIncrementId: 0,
      meta: { columns: [...meta.columns] },
    });
    await this.flush(meta.name);
  }

  async dropTable(name: string): Promise<void> {
    this.data.delete(name);
    try {
      const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.config.bucket,
          Key: this.getKey(name),
        }),
      );
    } catch {}
  }

  async addColumn(table: string, column: ColumnMetadata): Promise<void> {
    const tableData = this.data.get(table);
    if (!tableData) {
      throw new DriverError(`Table "${table}" does not exist`);
    }
    tableData.meta.columns.push(column);
    for (const row of tableData.rows) {
      row[column.name] = column.defaultValue ?? null;
    }
    await this.flush(table);
  }

  async dropColumn(table: string, name: string): Promise<void> {
    const tableData = this.data.get(table);
    if (!tableData) {
      throw new DriverError(`Table "${table}" does not exist`);
    }
    tableData.meta.columns = tableData.meta.columns.filter((c) => c.name !== name);
    for (const row of tableData.rows) {
      delete row[name];
    }
    await this.flush(table);
  }

  async renameColumn(table: string, oldName: string, newName: string): Promise<void> {
    const tableData = this.data.get(table);
    if (!tableData) {
      throw new DriverError(`Table "${table}" does not exist`);
    }
    const col = tableData.meta.columns.find((c) => c.name === oldName);
    if (col) {
      col.name = newName;
    }
    for (const row of tableData.rows) {
      row[newName] = row[oldName];
      delete row[oldName];
    }
    await this.flush(table);
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    const snapshot = new Map<string, string>();
    for (const [name, tableData] of this.data) {
      snapshot.set(name, JSON.stringify(tableData));
    }
    try {
      const result = await fn();
      await this.flushAll();
      return result;
    } catch (err) {
      for (const [name, json] of snapshot) {
        this.data.set(name, JSON.parse(json));
      }
      throw err;
    }
  }

  async getAllTableColumns(): Promise<Record<string, ColumnMetadata[]>> {
    const result: Record<string, ColumnMetadata[]> = {};
    for (const [name, tableData] of this.data) {
      result[name] = [...tableData.meta.columns];
    }
    return result;
  }

  getTableData(tableName: string): S3TableData | undefined {
    return this.data.get(tableName);
  }

  insertRow(tableName: string, row: Record<string, unknown>): number {
    const tableData = this.data.get(tableName);
    if (!tableData) {
      throw new DriverError(`Table "${tableName}" does not exist`);
    }
    let pkCol: string | null = null;
    for (const col of tableData.meta.columns) {
      if (col.autoIncrement) {
        pkCol = col.name;
        break;
      }
    }
    if (pkCol && row[pkCol] === undefined) {
      tableData.autoIncrementId++;
      row[pkCol] = tableData.autoIncrementId;
    }
    tableData.rows.push({ ...row });
    this.flush(tableName);
    return pkCol ? (row[pkCol] as number) : 0;
  }

  findRows(
    tableName: string,
    filter?: (row: Record<string, unknown>) => boolean,
  ): Record<string, unknown>[] {
    const tableData = this.data.get(tableName);
    if (!tableData) {
      return [];
    }
    if (!filter) {
      return tableData.rows.map((r) => ({ ...r }));
    }
    return tableData.rows.filter(filter).map((r) => ({ ...r }));
  }

  updateRows(
    tableName: string,
    filter: (row: Record<string, unknown>) => boolean,
    data: Record<string, unknown>,
  ): number {
    const tableData = this.data.get(tableName);
    if (!tableData) {
      return 0;
    }
    let count = 0;
    for (const row of tableData.rows) {
      if (filter(row)) {
        Object.assign(row, data);
        count++;
      }
    }
    if (count > 0) {
      this.flush(tableName);
    }
    return count;
  }

  deleteRows(tableName: string, filter: (row: Record<string, unknown>) => boolean): number {
    const tableData = this.data.get(tableName);
    if (!tableData) {
      return 0;
    }
    const before = tableData.rows.length;
    tableData.rows = tableData.rows.filter((r) => !filter(r));
    const deleted = before - tableData.rows.length;
    if (deleted > 0) {
      this.flush(tableName);
    }
    return deleted;
  }

  truncateTable(tableName: string): void {
    const tableData = this.data.get(tableName);
    if (tableData) {
      tableData.rows = [];
      tableData.autoIncrementId = 0;
      this.flush(tableName);
    }
  }

  countRows(tableName: string, filter?: (row: Record<string, unknown>) => boolean): number {
    const tableData = this.data.get(tableName);
    if (!tableData) {
      return 0;
    }
    if (!filter) {
      return tableData.rows.length;
    }
    return tableData.rows.filter(filter).length;
  }

  private async loadAll(): Promise<void> {
    try {
      const { ListObjectsV2Command, GetObjectCommand } = await import("@aws-sdk/client-s3");
      const prefix = this.config.prefix ? `${this.config.prefix}/` : "";
      const response = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.config.bucket,
          Prefix: prefix,
        }),
      );

      if (response.Contents) {
        for (const obj of response.Contents) {
          if (obj.Key?.endsWith(".json")) {
            const tableName = obj.Key.replace(prefix, "").replace(".json", "");
            try {
              const getResponse = await this.client.send(
                new GetObjectCommand({
                  Bucket: this.config.bucket,
                  Key: obj.Key,
                }),
              );
              const body = await getResponse.Body?.transformToString();
              if (body) {
                this.data.set(tableName, JSON.parse(body));
              }
            } catch {}
          }
        }
      }
    } catch {}
  }

  private async flush(tableName: string): Promise<void> {
    const tableData = this.data.get(tableName);
    if (!tableData || !this.client) {
      return;
    }
    try {
      const { PutObjectCommand } = await import("@aws-sdk/client-s3");
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.config.bucket,
          Key: this.getKey(tableName),
          Body: JSON.stringify(tableData),
          ContentType: "application/json",
        }),
      );
    } catch {}
  }

  private async flushAll(): Promise<void> {
    for (const [name] of this.data) {
      await this.flush(name);
    }
  }

  private executeParsed(sql: string, params: unknown[]): any {
    const trimmed = sql.trim().toUpperCase();
    if (trimmed.startsWith("CREATE TABLE")) {
      return { insertId: 0, affectedRows: 0 };
    }
    if (trimmed.startsWith("DROP TABLE")) {
      const match = sql.match(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?`?(\w+)`?/i);
      if (match?.[1]) {
        this.data.delete(match[1]);
      }
      return { insertId: 0, affectedRows: 0 };
    }
    if (trimmed.startsWith("SELECT")) {
      const tableMatch = sql.match(/FROM\s+`?(\w+)`?/i);
      if (!tableMatch) {
        return [];
      }
      const tableName = tableMatch[1];
      if (!tableName) {
        return [];
      }
      return this.findRows(tableName);
    }
    if (trimmed.startsWith("INSERT")) {
      const tableMatch = sql.match(/INTO\s+`?(\w+)`?/i);
      if (!tableMatch) {
        return { insertId: 0, affectedRows: 0 };
      }
      const colMatch = sql.match(/\(([^)]+)\)\s+VALUES/i);
      if (!colMatch) {
        return { insertId: 0, affectedRows: 0 };
      }
      const cols = colMatch[1]?.split(",").map((c) => c.trim().replace(/`/g, ""));
      if (!cols) {
        return { insertId: 0, affectedRows: 0 };
      }
      const row: Record<string, unknown> = {};
      for (let i = 0; i < cols.length; i++) {
        const col = cols[i];
        if (col) {
          row[col] = params[i];
        }
      }
      const id = this.insertRow(tableMatch[1]!, row);
      return { insertId: id, affectedRows: 1 };
    }
    return { insertId: 0, affectedRows: 0 };
  }
}
