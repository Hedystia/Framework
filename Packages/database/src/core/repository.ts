import type { CacheManager } from "../cache";
import { FileDriver } from "../drivers/file";
import {
  compileDelete,
  compileInsert,
  compileSelect,
  compileUpdate,
  compileWhere,
} from "../drivers/sql-compiler";
import { QueryError } from "../errors";
import type { SchemaRegistry } from "../schema";
import type {
  DatabaseDriver,
  DeleteOptions,
  QueryOptions,
  Repository,
  TableMetadata,
  UpdateOptions,
  WhereClause,
} from "../types";

/**
 * Repository implementation that provides CRUD operations for a table
 * @template T - The row type for this table
 */
export class TableRepository<T extends Record<string, any>> implements Repository<T> {
  private tableName: string;
  private driver: DatabaseDriver;
  private cache: CacheManager;
  private registry: SchemaRegistry;
  private meta: TableMetadata;

  constructor(
    tableName: string,
    driver: DatabaseDriver,
    cache: CacheManager,
    registry: SchemaRegistry,
  ) {
    this.tableName = tableName;
    this.driver = driver;
    this.cache = cache;
    this.registry = registry;
    const meta = registry.getTable(tableName);
    if (!meta) {
      throw new QueryError(`Table "${tableName}" is not registered`);
    }
    this.meta = meta;
  }

  /**
   * Find all rows matching the query options
   * @param {QueryOptions<T>} [options] - Query options
   * @returns {Promise<T[]>} Array of matching rows
   */
  async find(options?: QueryOptions<T>): Promise<T[]> {
    return this.cache.getOrSet(this.tableName, "find", options, async () => {
      let rows: T[];
      if (this.driver instanceof FileDriver) {
        rows = this.findFile(options);
      } else {
        rows = await this.findSQL(options);
      }
      if (options?.with) {
        rows = await this.loadRelations(rows, options.with);
      }
      this.cacheEntities(rows);
      return rows;
    });
  }

  /**
   * Find all rows matching the query options (alias for find)
   * @param {QueryOptions<T>} [options] - Query options
   * @returns {Promise<T[]>} Array of matching rows
   */
  async findMany(options?: QueryOptions<T>): Promise<T[]> {
    return this.find(options);
  }

  /**
   * Find the first row matching the query options
   * @param {QueryOptions<T>} [options] - Query options
   * @returns {Promise<T | null>} The first matching row or null
   */
  async findFirst(options?: QueryOptions<T>): Promise<T | null> {
    return this.cache.getOrSet(this.tableName, "findFirst", options, async () => {
      const opts = { ...options, take: 1 };
      let rows: T[];
      if (this.driver instanceof FileDriver) {
        rows = this.findFile(opts);
      } else {
        rows = await this.findSQL(opts);
      }
      if (rows.length === 0) {
        return null;
      }
      if (options?.with) {
        rows = await this.loadRelations(rows, options.with);
      }
      const row = rows[0] ?? null;
      if (row) {
        this.cacheEntity(row);
      }
      return row;
    });
  }

  /**
   * Insert one or more rows
   * @param {Partial<T> | Partial<T>[]} data - Data to insert
   * @returns {Promise<T>} The inserted row
   */
  async insert(data: Partial<T> | Partial<T>[]): Promise<T> {
    const single = Array.isArray(data) ? data[0] : data;
    if (!single) {
      throw new QueryError("Insert data cannot be empty");
    }

    this.cache.invalidateTable(this.tableName);
    const cleaned = this.cleanData(single);

    if (this.driver instanceof FileDriver) {
      const id = (this.driver as FileDriver).insertRow(this.tableName, cleaned);
      const pk = this.registry.getPrimaryKey(this.tableName);
      if (pk) {
        cleaned[pk] = id;
      }
      this.cacheEntity(cleaned as T);
      return cleaned as T;
    }

    const params: unknown[] = [];
    const sql = compileInsert(this.tableName, cleaned, params);
    const result = await this.driver.execute(sql, params);

    const pk = this.registry.getPrimaryKey(this.tableName);
    if (pk && result.insertId) {
      cleaned[pk] = result.insertId;
    }

    this.cacheEntity(cleaned as T);
    return cleaned as T;
  }

  /**
   * Insert multiple rows
   * @param {Partial<T>[]} data - Array of data to insert
   * @returns {Promise<T[]>} The inserted rows
   */
  async insertMany(data: Partial<T>[]): Promise<T[]> {
    const results: T[] = [];
    for (const item of data) {
      results.push(await this.insert(item));
    }
    return results;
  }

  /**
   * Update rows matching the where clause
   * @param {UpdateOptions<T>} options - Update options with where and data
   * @returns {Promise<T[]>} The updated rows
   */
  async update(options: UpdateOptions<T>): Promise<T[]> {
    if (!options.where || Object.keys(options.where).length === 0) {
      throw new QueryError("Update requires a where clause");
    }

    this.cache.invalidateTable(this.tableName);
    const cleaned = this.cleanData(options.data);

    if (this.driver instanceof FileDriver) {
      const filter = this.buildFileFilter(options.where as WhereClause);
      (this.driver as FileDriver).updateRows(this.tableName, filter, cleaned);
      return this.find({ where: options.where } as QueryOptions<T>);
    }

    const params: unknown[] = [];
    const sql = compileUpdate(this.tableName, cleaned, options.where as WhereClause, params);
    await this.driver.execute(sql, params);

    return this.find({ where: options.where } as QueryOptions<T>);
  }

  /**
   * Delete rows matching the where clause
   * @param {DeleteOptions<T>} options - Delete options with where clause
   * @returns {Promise<number>} Number of deleted rows
   */
  async delete(options: DeleteOptions<T>): Promise<number> {
    if (!options.where || Object.keys(options.where).length === 0) {
      throw new QueryError("Delete requires a where clause");
    }

    this.cache.invalidateTable(this.tableName);

    if (this.driver instanceof FileDriver) {
      const filter = this.buildFileFilter(options.where as WhereClause);
      return (this.driver as FileDriver).deleteRows(this.tableName, filter);
    }

    const params: unknown[] = [];
    const sql = compileDelete(this.tableName, options.where as WhereClause, params);
    const result = await this.driver.execute(sql, params);
    return result.affectedRows;
  }

  /**
   * Count rows matching the where clause
   * @param {Pick<QueryOptions<T>, "where">} [options] - Count options
   * @returns {Promise<number>} Row count
   */
  async count(options?: Pick<QueryOptions<T>, "where">): Promise<number> {
    return this.cache.getOrSet(this.tableName, "count", options, async () => {
      if (this.driver instanceof FileDriver) {
        const filter = options?.where
          ? this.buildFileFilter(options.where as WhereClause)
          : undefined;
        return (this.driver as FileDriver).countRows(this.tableName, filter);
      }

      const params: unknown[] = [];
      let sql = `SELECT COUNT(*) as count FROM \`${this.tableName}\``;
      if (options?.where && Object.keys(options.where).length > 0) {
        sql += ` WHERE ${compileWhere(options.where as WhereClause, params)}`;
      }
      const rows = await this.driver.query(sql, params);
      return rows[0]?.count ?? 0;
    });
  }

  /**
   * Check if any row exists matching the where clause
   * @param {Pick<QueryOptions<T>, "where">} options - Exists options
   * @returns {Promise<boolean>} Whether a matching row exists
   */
  async exists(options: Pick<QueryOptions<T>, "where">): Promise<boolean> {
    const c = await this.count(options);
    return c > 0;
  }

  /**
   * Insert or update a row based on the where clause
   * @param {object} options - Upsert options
   * @param {WhereClause<T>} options.where - Condition to check
   * @param {Partial<T>} options.create - Data to insert if not found
   * @param {Partial<T>} options.update - Data to update if found
   * @returns {Promise<T>} The upserted row
   */
  async upsert(options: {
    where: WhereClause<T>;
    create: Partial<T>;
    update: Partial<T>;
  }): Promise<T> {
    const existing = await this.findFirst({ where: options.where } as QueryOptions<T>);
    if (existing) {
      const updated = await this.update({ where: options.where, data: options.update });
      return updated[0] ?? existing;
    }
    return this.insert(options.create);
  }

  /**
   * Remove all rows from the table
   */
  async truncate(): Promise<void> {
    this.cache.invalidateTable(this.tableName);
    if (this.driver instanceof FileDriver) {
      (this.driver as FileDriver).truncateTable(this.tableName);
      return;
    }
    await this.driver.execute(`DELETE FROM \`${this.tableName}\``);
  }

  private async findSQL(options?: QueryOptions<T>): Promise<T[]> {
    const params: unknown[] = [];
    const sql = compileSelect(
      this.tableName,
      {
        select: options?.select as string[] | undefined,
        where: options?.where as WhereClause | undefined,
        orderBy: options?.orderBy as Record<string, "asc" | "desc"> | undefined,
        take: options?.take,
        skip: options?.skip,
      },
      params,
    );
    return this.driver.query(sql, params);
  }

  private findFile(options?: QueryOptions<T>): T[] {
    const fd = this.driver as FileDriver;
    const filter = options?.where ? this.buildFileFilter(options.where as WhereClause) : undefined;
    let rows = fd.findRows(this.tableName, filter) as T[];

    if (options?.select) {
      const selectSet = new Set(options.select as string[]);
      rows = rows.map((row) => {
        const filtered: Record<string, any> = {};
        for (const key of selectSet) {
          filtered[key as string] = row[key as string];
        }
        return filtered as T;
      });
    }

    if (options?.orderBy) {
      const entries = Object.entries(options.orderBy);
      rows.sort((a, b) => {
        for (const [col, dir] of entries) {
          const av = a[col];
          const bv = b[col];
          if (av < bv) {
            return dir === "asc" ? -1 : 1;
          }
          if (av > bv) {
            return dir === "asc" ? 1 : -1;
          }
        }
        return 0;
      });
    }

    if (options?.skip) {
      rows = rows.slice(options.skip);
    }
    if (options?.take) {
      rows = rows.slice(0, options.take);
    }

    return rows;
  }

  private buildFileFilter(where: WhereClause): (row: Record<string, unknown>) => boolean {
    return (row) => this.matchWhere(row, where);
  }

  private matchWhere(row: Record<string, unknown>, where: WhereClause): boolean {
    for (const [key, value] of Object.entries(where)) {
      if (key === "OR" && Array.isArray(value)) {
        const any = (value as WhereClause[]).some((sub) => this.matchWhere(row, sub));
        if (!any) {
          return false;
        }
        continue;
      }
      if (key === "AND" && Array.isArray(value)) {
        const all = (value as WhereClause[]).every((sub) => this.matchWhere(row, sub));
        if (!all) {
          return false;
        }
        continue;
      }

      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        const cond = value as any;
        const rowVal = row[key];
        if (cond.eq !== undefined && rowVal !== cond.eq) {
          return false;
        }
        if (cond.neq !== undefined && rowVal === cond.neq) {
          return false;
        }
        if (cond.gt !== undefined && !((rowVal as any) > cond.gt)) {
          return false;
        }
        if (cond.gte !== undefined && !((rowVal as any) >= cond.gte)) {
          return false;
        }
        if (cond.lt !== undefined && !((rowVal as any) < cond.lt)) {
          return false;
        }
        if (cond.lte !== undefined && !((rowVal as any) <= cond.lte)) {
          return false;
        }
        if (
          cond.like !== undefined &&
          !String(rowVal).match(new RegExp(cond.like.replace(/%/g, ".*"), "i"))
        ) {
          return false;
        }
        if (
          cond.notLike !== undefined &&
          String(rowVal).match(new RegExp(cond.notLike.replace(/%/g, ".*"), "i"))
        ) {
          return false;
        }
        if (cond.in !== undefined && !cond.in.includes(rowVal)) {
          return false;
        }
        if (cond.notIn?.includes(rowVal)) {
          return false;
        }
        if (cond.isNull === true && rowVal !== null && rowVal !== undefined) {
          return false;
        }
        if (cond.isNull === false && (rowVal === null || rowVal === undefined)) {
          return false;
        }
        if (cond.between !== undefined) {
          if ((rowVal as any) < cond.between[0] || (rowVal as any) > cond.between[1]) {
            return false;
          }
        }
      } else {
        if (row[key] !== value) {
          return false;
        }
      }
    }
    return true;
  }

  private async loadRelations(
    rows: T[],
    withOpts: Record<string, boolean | QueryOptions>,
  ): Promise<T[]> {
    if (rows.length === 0) {
      return rows;
    }
    const relations = this.registry.getRelations(this.tableName);

    for (const [relationName, opts] of Object.entries(withOpts)) {
      if (!opts) {
        continue;
      }
      const relation = relations.find((r) => r.relationName === relationName);
      if (!relation) {
        continue;
      }

      const isParent = relation.from.table === this.tableName;
      if (isParent) {
        const ids = rows.map((r) => r[relation.from.column]).filter((v) => v != null);
        if (ids.length === 0) {
          continue;
        }
        const uniqueIds = [...new Set(ids)];
        const relatedOpts: QueryOptions = typeof opts === "object" ? opts : {};
        const related = await this.findRelated(
          relation.to.table,
          relation.to.column,
          uniqueIds,
          relatedOpts,
        );
        const relatedMap = new Map<unknown, unknown[]>();
        for (const r of related) {
          const key = (r as any)[relation.to.column];
          if (!relatedMap.has(key)) {
            relatedMap.set(key, []);
          }
          relatedMap.get(key)!.push(r);
        }
        for (const row of rows) {
          const key = row[relation.from.column];
          const relRows = relatedMap.get(key);
          (row as any)[relationName] = relRows ?? [];
        }
      } else {
        const pk = this.registry.getPrimaryKey(this.tableName);
        if (!pk) {
          continue;
        }
        const ids = rows.map((r) => r[pk]).filter((v) => v != null);
        if (ids.length === 0) {
          continue;
        }
        const uniqueIds = [...new Set(ids)];
        const relatedOpts: QueryOptions = typeof opts === "object" ? opts : {};
        const related = await this.findRelated(
          relation.to.table,
          relation.to.column,
          uniqueIds,
          relatedOpts,
        );
        const relatedMap = new Map<unknown, unknown[]>();
        for (const r of related) {
          const key = (r as any)[relation.to.column];
          if (!relatedMap.has(key)) {
            relatedMap.set(key, []);
          }
          relatedMap.get(key)!.push(r);
        }
        for (const row of rows) {
          const key = row[pk];
          (row as any)[relationName] = relatedMap.get(key) ?? [];
        }
      }
    }

    return rows;
  }

  private async findRelated(
    tableName: string,
    column: string,
    ids: unknown[],
    options: QueryOptions,
  ): Promise<any[]> {
    if (this.driver instanceof FileDriver) {
      const fd = this.driver as FileDriver;
      const filter = (row: Record<string, unknown>) => ids.includes(row[column]);
      return fd.findRows(tableName, filter);
    }

    const params: unknown[] = [];
    const placeholders = ids.map(() => "?").join(", ");
    params.push(...ids);

    let sql = `SELECT * FROM \`${tableName}\` WHERE \`${column}\` IN (${placeholders})`;
    if (options.orderBy) {
      const orderParts = Object.entries(options.orderBy).map(
        ([col, dir]) => `\`${col}\` ${(dir as string).toUpperCase()}`,
      );
      if (orderParts.length > 0) {
        sql += ` ORDER BY ${orderParts.join(", ")}`;
      }
    }
    if (options.take) {
      sql += ` LIMIT ${options.take}`;
    }

    return this.driver.query(sql, params);
  }

  private cleanData(data: Partial<T>): Record<string, unknown> {
    const cleaned: Record<string, unknown> = {};
    const columnNames = new Set(this.meta.columns.map((c) => c.name));
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (columnNames.has(key)) {
        cleaned[key] = value;
      }
    }
    return cleaned;
  }

  private cacheEntities(rows: T[]): void {
    const pk = this.registry.getPrimaryKey(this.tableName);
    if (!pk) {
      return;
    }
    for (const row of rows) {
      if (row[pk] != null) {
        this.cache.setEntity(this.tableName, row[pk], row);
      }
    }
  }

  private cacheEntity(row: T): void {
    const pk = this.registry.getPrimaryKey(this.tableName);
    if (!pk || row[pk] == null) {
      return;
    }
    this.cache.setEntity(this.tableName, row[pk], row);
  }
}
