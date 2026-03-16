import { DriverError } from "../errors";
import type { ColumnMetadata, MySQLConnectionConfig, TableMetadata } from "../types";
import { BaseDriver } from "./driver";
import { compileColumnDef, compileCreateTable } from "./sql-compiler";

/**
 * MySQL database driver using mysql2
 */
export class MySQLDriver extends BaseDriver {
  private pool: any = null;
  private config: MySQLConnectionConfig;

  constructor(config: MySQLConnectionConfig) {
    super();
    this.config = config;
  }

  /**
   * Connect to the MySQL database
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }
    try {
      const mysql = await import("mysql2/promise");
      this.pool = mysql.createPool({
        host: this.config.host,
        port: this.config.port ?? 3306,
        user: this.config.user,
        password: this.config.password,
        database: this.config.database,
        waitForConnections: true,
        connectionLimit: 10,
      });
      this.connected = true;
    } catch {
      throw new DriverError("Failed to connect to MySQL database");
    }
  }

  /**
   * Disconnect from the MySQL database
   */
  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.connected = false;
    }
  }

  /**
   * Execute a SQL statement
   * @param {string} sql - SQL statement
   * @param {unknown[]} [params] - Query parameters
   * @returns {Promise<any>} Execution result
   */
  async execute(sql: string, params: unknown[] = []): Promise<any> {
    try {
      const [result] = await this.pool.execute(sql, this.formatParams(params));
      return {
        insertId: result.insertId,
        affectedRows: result.affectedRows,
      };
    } catch (err: any) {
      throw new DriverError(`MySQL execute error: ${err.message}`);
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
      const [rows] = await this.pool.execute(sql, this.formatParams(params));
      return rows;
    } catch (err: any) {
      throw new DriverError(`MySQL query error: ${err.message}`);
    }
  }

  private formatParams(params: unknown[]): unknown[] {
    return params.map((p) => {
      if (p instanceof Date) {
        return p.toISOString().slice(0, 19).replace("T", " ");
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
    const rows = await this.query(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?",
      [this.config.database, name],
    );
    return rows.length > 0;
  }

  /**
   * Get column metadata for a table
   * @param {string} name - Table name
   * @returns {Promise<ColumnMetadata[]>} Column metadata
   */
  async getTableColumns(name: string): Promise<ColumnMetadata[]> {
    const rows = await this.query(
      "SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY, EXTRA, COLUMN_DEFAULT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION",
      [this.config.database, name],
    );
    return rows.map((row: any) => ({
      name: row.COLUMN_NAME,
      type: this.mapMySQLType(row.DATA_TYPE),
      primaryKey: row.COLUMN_KEY === "PRI",
      autoIncrement: row.EXTRA?.includes("auto_increment") ?? false,
      notNull: row.IS_NULLABLE === "NO",
      unique: row.COLUMN_KEY === "UNI",
      defaultValue: row.COLUMN_DEFAULT,
    }));
  }

  /**
   * Create a table from metadata
   * @param {TableMetadata} meta - Table metadata
   */
  async createTable(meta: TableMetadata): Promise<void> {
    const sql = compileCreateTable(meta, "mysql");
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
    const colDef = compileColumnDef(column, "mysql");
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
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      const result = await fn();
      await conn.commit();
      return result;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  private mapMySQLType(type: string): ColumnMetadata["type"] {
    const lower = type.toLowerCase();
    if (
      lower === "int" ||
      lower === "integer" ||
      lower === "tinyint" ||
      lower === "smallint" ||
      lower === "mediumint"
    ) {
      return "integer";
    }
    if (lower === "bigint") {
      return "bigint";
    }
    if (lower === "varchar") {
      return "varchar";
    }
    if (lower === "char") {
      return "char";
    }
    if (lower === "text" || lower === "mediumtext" || lower === "longtext") {
      return "text";
    }
    if (lower === "json") {
      return "json";
    }
    if (lower === "datetime") {
      return "datetime";
    }
    if (lower === "timestamp") {
      return "timestamp";
    }
    if (lower === "decimal" || lower === "numeric") {
      return "decimal";
    }
    if (lower === "float" || lower === "double" || lower === "real") {
      return "float";
    }
    if (lower === "blob" || lower === "mediumblob" || lower === "longblob") {
      return "blob";
    }
    return "text";
  }
}
