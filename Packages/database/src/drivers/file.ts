import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { DriverError } from "../errors";
import type { ColumnMetadata, FileConnectionConfig, TableMetadata } from "../types";
import { BaseDriver } from "./driver";

interface FileTableData {
  rows: Record<string, unknown>[];
  autoIncrementId: number;
  meta: {
    columns: ColumnMetadata[];
  };
}

/**
 * File-based database driver using JSON files for storage
 */
export class FileDriver extends BaseDriver {
  private config: FileConnectionConfig;
  private data = new Map<string, FileTableData>();

  constructor(config: FileConnectionConfig) {
    super();
    this.config = config;
  }

  /**
   * Connect to the file database (ensures directory exists and loads data)
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }
    if (!existsSync(this.config.directory)) {
      mkdirSync(this.config.directory, { recursive: true });
    }
    this.loadAll();
    this.connected = true;
  }

  /**
   * Disconnect from the file database (flushes data to disk)
   */
  async disconnect(): Promise<void> {
    this.flushAll();
    this.data.clear();
    this.connected = false;
  }

  /**
   * Execute a SQL-like statement (parsed internally for file driver)
   * @param {string} sql - SQL statement
   * @param {unknown[]} [params] - Query parameters
   * @returns {Promise<any>} Execution result
   */
  async execute(sql: string, params: unknown[] = []): Promise<any> {
    return this.executeParsed(sql, params);
  }

  /**
   * Execute a SQL-like query
   * @param {string} sql - SQL query
   * @param {unknown[]} [params] - Query parameters
   * @returns {Promise<any[]>} Query results
   */
  async query(sql: string, params: unknown[] = []): Promise<any[]> {
    const result = this.executeParsed(sql, params);
    return Array.isArray(result) ? result : [];
  }

  /**
   * Check if a table exists
   * @param {string} name - Table name
   * @returns {Promise<boolean>} Whether the table exists
   */
  async tableExists(name: string): Promise<boolean> {
    return this.data.has(name);
  }

  /**
   * Get column metadata for a table
   * @param {string} name - Table name
   * @returns {Promise<ColumnMetadata[]>} Column metadata
   */
  async getTableColumns(name: string): Promise<ColumnMetadata[]> {
    const table = this.data.get(name);
    if (!table) {
      return [];
    }
    return Object.values(table.meta.columns);
  }

  /**
   * Create a table from metadata
   * @param {TableMetadata} meta - Table metadata
   */
  async createTable(meta: TableMetadata): Promise<void> {
    if (this.data.has(meta.name)) {
      return;
    }
    this.data.set(meta.name, {
      rows: [],
      autoIncrementId: 0,
      meta: { columns: [...meta.columns] },
    });
    this.flush(meta.name);
  }

  /**
   * Drop a table
   * @param {string} name - Table name
   */
  async dropTable(name: string): Promise<void> {
    this.data.delete(name);
    const filePath = join(this.config.directory, `${name}.json`);
    try {
      const { unlinkSync } = await import("fs");
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    } catch {}
  }

  /**
   * Add a column to a table
   * @param {string} table - Table name
   * @param {ColumnMetadata} column - Column metadata
   */
  async addColumn(table: string, column: ColumnMetadata): Promise<void> {
    const tableData = this.data.get(table);
    if (!tableData) {
      throw new DriverError(`Table "${table}" does not exist`);
    }
    tableData.meta.columns.push(column);
    for (const row of tableData.rows) {
      row[column.name] = column.defaultValue ?? null;
    }
    this.flush(table);
  }

  /**
   * Drop a column from a table
   * @param {string} table - Table name
   * @param {string} name - Column name
   */
  async dropColumn(table: string, name: string): Promise<void> {
    const tableData = this.data.get(table);
    if (!tableData) {
      throw new DriverError(`Table "${table}" does not exist`);
    }
    tableData.meta.columns = tableData.meta.columns.filter((c) => c.name !== name);
    for (const row of tableData.rows) {
      delete row[name];
    }
    this.flush(table);
  }

  /**
   * Rename a column
   * @param {string} table - Table name
   * @param {string} oldName - Current name
   * @param {string} newName - New name
   */
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
    this.flush(table);
  }

  /**
   * Execute within a transaction (pseudo-transaction for file driver)
   * @param {() => Promise<T>} fn - Function to execute
   * @returns {Promise<T>} Result
   */
  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    const snapshot = new Map<string, string>();
    for (const [name, tableData] of this.data) {
      snapshot.set(name, JSON.stringify(tableData));
    }
    try {
      const result = await fn();
      this.flushAll();
      return result;
    } catch (err) {
      for (const [name, json] of snapshot) {
        this.data.set(name, JSON.parse(json));
      }
      throw err;
    }
  }

  /**
   * Direct access for the repository to perform typed operations
   * @param {string} tableName - Table name
   * @returns {FileTableData | undefined} Table data
   */
  getTableData(tableName: string): FileTableData | undefined {
    return this.data.get(tableName);
  }

  /**
   * Insert a row directly into the file store
   * @param {string} tableName - Table name
   * @param {Record<string, unknown>} row - Row data
   * @returns {number} The insert ID
   */
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

  /**
   * Find rows matching a filter function
   * @param {string} tableName - Table name
   * @param {(row: Record<string, unknown>) => boolean} filter - Filter function
   * @returns {Record<string, unknown>[]} Matching rows
   */
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

  /**
   * Update rows matching a filter
   * @param {string} tableName - Table name
   * @param {(row: Record<string, unknown>) => boolean} filter - Filter function
   * @param {Record<string, unknown>} data - Update data
   * @returns {number} Number of affected rows
   */
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

  /**
   * Delete rows matching a filter
   * @param {string} tableName - Table name
   * @param {(row: Record<string, unknown>) => boolean} filter - Filter function
   * @returns {number} Number of deleted rows
   */
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

  /**
   * Truncate a table
   * @param {string} tableName - Table name
   */
  truncateTable(tableName: string): void {
    const tableData = this.data.get(tableName);
    if (tableData) {
      tableData.rows = [];
      tableData.autoIncrementId = 0;
      this.flush(tableName);
    }
  }

  /**
   * Count rows matching a filter
   * @param {string} tableName - Table name
   * @param {(row: Record<string, unknown>) => boolean} [filter] - Filter function
   * @returns {number} Row count
   */
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

  private loadAll(): void {
    if (!existsSync(this.config.directory)) {
      return;
    }
    const { readdirSync } = require("fs");
    const files = readdirSync(this.config.directory) as string[];
    for (const file of files) {
      if (file.endsWith(".json")) {
        const name = file.replace(".json", "");
        try {
          const content = readFileSync(join(this.config.directory, file), "utf-8");
          this.data.set(name, JSON.parse(content));
        } catch {}
      }
    }
  }

  private flush(tableName: string): void {
    const tableData = this.data.get(tableName);
    if (!tableData) {
      return;
    }
    const filePath = join(this.config.directory, `${tableName}.json`);
    writeFileSync(filePath, JSON.stringify(tableData, null, 2), "utf-8");
  }

  private flushAll(): void {
    for (const [name] of this.data) {
      this.flush(name);
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
