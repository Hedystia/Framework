import { SyncError } from "../errors";
import type { SchemaRegistry } from "../schema";
import type { DatabaseDriver, TableMetadata } from "../types";

/**
 * Schema synchronizer that compares the database state with the schema registry
 * and applies non-destructive changes
 */
export class Synchronizer {
  private driver: DatabaseDriver;
  private registry: SchemaRegistry;

  constructor(driver: DatabaseDriver, registry: SchemaRegistry) {
    this.driver = driver;
    this.registry = registry;
  }

  /**
   * Synchronize database schema with registry definitions
   * @param {boolean} [force=false] - Allow destructive operations (drop columns)
   */
  async sync(force = false): Promise<void> {
    const tables = this.registry.getAllTables();

    for (const [, tableMeta] of tables) {
      await this.syncTable(tableMeta, force);
    }
  }

  private async syncTable(meta: TableMetadata, force: boolean): Promise<void> {
    const exists = await this.driver.tableExists(meta.name);
    if (!exists) {
      await this.driver.createTable(meta);
      return;
    }

    const existingCols = await this.driver.getTableColumns(meta.name);
    const existingNames = new Set(existingCols.map((c) => c.name));
    const schemaNames = new Set(meta.columns.map((c) => c.name));

    for (const colMeta of meta.columns) {
      if (!existingNames.has(colMeta.name)) {
        await this.driver.addColumn(meta.name, colMeta);
      }
    }

    if (force) {
      for (const existingName of existingNames) {
        if (!schemaNames.has(existingName)) {
          try {
            await this.driver.dropColumn(meta.name, existingName);
          } catch (err: any) {
            throw new SyncError(`Failed to drop column ${existingName}: ${err.message}`);
          }
        }
      }
    }
  }
}
