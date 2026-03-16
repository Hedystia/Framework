import { DriverError } from "../errors";
import type { ConnectionConfig, DatabaseDriver, DatabaseType } from "../types";
import { FileDriver } from "./file";
import { MySQLDriver } from "./mysql";
import { SQLiteDriver } from "./sqlite";

export { BaseDriver } from "./driver";
export { FileDriver } from "./file";
export { MySQLDriver } from "./mysql";
export * from "./sql-compiler";
export { SQLiteDriver } from "./sqlite";

/**
 * Create a database driver instance based on the database type
 * @param {DatabaseType} type - Database type
 * @param {ConnectionConfig} config - Connection configuration
 * @returns {DatabaseDriver} The created driver
 */
export function createDriver(type: DatabaseType, config: ConnectionConfig): DatabaseDriver {
  switch (type) {
    case "sqlite":
      return new SQLiteDriver(config as any);
    case "mysql":
      return new MySQLDriver(config as any);
    case "file":
      return new FileDriver(config as any);
    default:
      throw new DriverError(`Unsupported database type: ${type}`);
  }
}
