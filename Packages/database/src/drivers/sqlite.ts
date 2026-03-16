import { DriverError } from "../errors";
import type { ColumnMetadata, SQLiteConnectionConfig, TableMetadata } from "../types";
import { BaseDriver } from "./driver";
import { compileColumnDef, compileCreateTable } from "./sql-compiler";

/**
 * SQLite database driver using bun:sqlite
 */
export class SQLiteDriver extends BaseDriver {
  private db: any = null;
  private config: SQLiteConnectionConfig;

  constructor(config: SQLiteConnectionConfig) {
    super();
    this.config = config;
  }

  /**
   * Connect to the SQLite database
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }
    try {
      const { Database } = await import("bun:sqlite");
      this.db = new Database(this.config.filename);
      this.db.exec("PRAGMA journal_mode=WAL");
      this.db.exec("PRAGMA foreign_keys=ON");
      this.connected = true;
    } catch {
      throw new DriverError("Failed to connect to SQLite database");
    }
  }

  /**
   * Disconnect from the SQLite database
   */
  async disconnect(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.connected = false;
    }
  }

  /**
   * Execute a SQL statement
   * @param {string} sql - SQL statement
   * @param {unknown[]} [params] - Query parameters
   * @returns {Promise<any>} Execution result with lastInsertRowid and changes
   */
  async execute(sql: string, params: unknown[] = []): Promise<any> {
    try {
      const stmt = this.db.prepare(sql);
      const result = stmt.run(...this.formatParams(params));
      return {
        insertId: Number(result.lastInsertRowid),
        affectedRows: result.changes,
      };
    } catch (err: any) {
      throw new DriverError(`SQLite execute error: ${err.message}`);
    }
  }

  /**
   * Execute a SQL query
   * @param {string} sql - SQL query
   * @param {unknown[]} [params] - Query parameters
   * @returns {Promise<any[]>} Query results
   */
  async query(sql: string, params: unknown[] = []): Promise<any[]> {
    try {
      const stmt = this.db.prepare(sql);
      return stmt.all(...this.formatParams(params));
    } catch (err: any) {
      throw new DriverError(`SQLite query error: ${err.message}`);
    }
  }

  private formatParams(params: unknown[]): any[] {
    return params.map((p) => {
      if (p instanceof Date) {
        return p.toISOString();
      }
      return p;
    });
  }

  /**
   * Check if a table exists
   * @param {string} name - Table name
   * @returns {Promise<boolean>} Whether the table exists
   */
  async tableExists(name: string): Promise<boolean> {
    const rows = await this.query("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [
      name,
    ]);
    return rows.length > 0;
  }

  /**
   * Get column metadata for a table
   * @param {string} name - Table name
   * @returns {Promise<ColumnMetadata[]>} Column metadata
   */
  async getTableColumns(name: string): Promise<ColumnMetadata[]> {
    const rows = await this.query(`PRAGMA table_info(\`${name}\`)`);
    return rows.map((row: any) => ({
      name: row.name,
      type: this.mapSQLiteType(row.type),
      primaryKey: row.pk === 1,
      autoIncrement: row.pk === 1 && row.type.toUpperCase() === "INTEGER",
      notNull: row.notnull === 1,
      unique: false,
      defaultValue: row.dflt_value,
    }));
  }

  /**
   * Create a table from metadata
   * @param {TableMetadata} meta - Table metadata
   */
  async createTable(meta: TableMetadata): Promise<void> {
    const sql = compileCreateTable(meta, "sqlite");
    await this.execute(sql);
  }

  /**
   * Drop a table
   * @param {string} name - Table name
   */
  async dropTable(name: string): Promise<void> {
    await this.execute(`DROP TABLE IF EXISTS \`${name}\``);
  }

  /**
   * Add a column to a table
   * @param {string} table - Table name
   * @param {ColumnMetadata} column - Column metadata
   */
  async addColumn(table: string, column: ColumnMetadata): Promise<void> {
    const colDef = compileColumnDef(column, "sqlite");
    await this.execute(`ALTER TABLE \`${table}\` ADD COLUMN ${colDef}`);
  }

  /**
   * Drop a column from a table
   * @param {string} table - Table name
   * @param {string} name - Column name
   */
  async dropColumn(table: string, name: string): Promise<void> {
    await this.execute(`ALTER TABLE \`${table}\` DROP COLUMN \`${name}\``);
  }

  /**
   * Rename a column
   * @param {string} table - Table name
   * @param {string} oldName - Current name
   * @param {string} newName - New name
   */
  async renameColumn(table: string, oldName: string, newName: string): Promise<void> {
    await this.execute(`ALTER TABLE \`${table}\` RENAME COLUMN \`${oldName}\` TO \`${newName}\``);
  }

  /**
   * Execute within a transaction
   * @param {() => Promise<T>} fn - Function to execute
   * @returns {Promise<T>} Result
   */
  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    await this.execute("BEGIN TRANSACTION");
    try {
      const result = await fn();
      await this.execute("COMMIT");
      return result;
    } catch (err) {
      await this.execute("ROLLBACK");
      throw err;
    }
  }

  private mapSQLiteType(type: string): ColumnMetadata["type"] {
    const upper = type.toUpperCase();
    if (upper.includes("INT")) {
      return "integer";
    }
    if (upper.includes("CHAR") || upper.includes("TEXT") || upper.includes("CLOB")) {
      return "text";
    }
    if (upper.includes("REAL") || upper.includes("FLOAT") || upper.includes("DOUBLE")) {
      return "float";
    }
    if (upper.includes("BLOB")) {
      return "blob";
    }
    return "text";
  }
}
