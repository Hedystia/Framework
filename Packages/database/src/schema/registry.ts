import { SchemaError } from "../errors";
import type { TableDefinition, TableMetadata } from "../types";

/**
 * Schema registry that manages table definitions and resolves references
 */
export class SchemaRegistry {
  private tables = new Map<string, TableMetadata>();
  private definitions = new Map<string, TableDefinition>();
  private columnMaps = new Map<string, Record<string, string>>();
  private reverseColumnMaps = new Map<string, Record<string, string>>();
  private relations = new Map<
    string,
    Array<{
      from: { table: string; column: string };
      to: { table: string; column: string };
      relationName: string;
    }>
  >();

  /**
   * Register table definitions and resolve all deferred references
   * @param {readonly TableDefinition[]} schemas - Table definitions to register
   */
  register(
    schemas: readonly TableDefinition<any, any, any, any>[],
    schemaKeyMap?: Map<string, string>,
  ): void {
    for (const schema of schemas) {
      if (!schema.__table || !schema.__name) {
        throw new SchemaError("Invalid table definition");
      }

      this.definitions.set(schema.__name, schema);
      this.tables.set(schema.__name, {
        name: schema.__name,
        columns: [...schema.__columns],
      });

      const colMap: Record<string, string> = schema.__columnMap ?? {};
      this.columnMaps.set(schema.__name, colMap);
      const reverseMap: Record<string, string> = {};
      for (const [codeKey, dbName] of Object.entries(colMap)) {
        reverseMap[dbName] = codeKey;
      }
      this.reverseColumnMaps.set(schema.__name, reverseMap);
    }

    for (const schema of schemas) {
      for (const ref of schema.__deferredRefs) {
        const resolved = ref.resolve();
        if (!resolved.table || !resolved.column) {
          throw new SchemaError(
            `Failed to resolve reference for ${schema.__name}.${ref.columnName}`,
          );
        }

        if (!this.tables.has(resolved.table)) {
          throw new SchemaError(
            `Referenced table "${resolved.table}" does not exist in schema registry`,
          );
        }

        const colMap = this.columnMaps.get(schema.__name) ?? {};
        const dbColumnName = colMap[ref.columnName] ?? ref.columnName;
        const column = schema.__columns.find((c: any) => c.name === dbColumnName);
        if (column) {
          column.references = {
            table: resolved.table,
            column: resolved.column,
            onDelete: ref.onDelete,
            onUpdate: ref.onUpdate,
            relationName: ref.relationName,
          };
        }

        const relationName =
          ref.relationName || ref.columnName.replace(/Id$/, "").replace(/_id$/, "");

        if (!this.relations.has(schema.__name)) {
          this.relations.set(schema.__name, []);
        }
        this.relations.get(schema.__name)!.push({
          from: { table: schema.__name, column: dbColumnName },
          to: { table: resolved.table, column: resolved.column },
          relationName,
        });

        if (!this.relations.has(resolved.table)) {
          this.relations.set(resolved.table, []);
        }
        const reverseRelationName = schemaKeyMap?.get(schema.__name) ?? schema.__name;
        this.relations.get(resolved.table)!.push({
          from: { table: resolved.table, column: resolved.column },
          to: { table: schema.__name, column: dbColumnName },
          relationName: reverseRelationName,
        });
      }
    }
  }

  /**
   * Get table metadata by name
   * @param {string} name - Table name
   * @returns {TableMetadata | undefined} The table metadata
   */
  getTable(name: string): TableMetadata | undefined {
    return this.tables.get(name);
  }

  /**
   * Get all registered table metadata
   * @returns {Map<string, TableMetadata>} All registered tables
   */
  getAllTables(): Map<string, TableMetadata> {
    return this.tables;
  }

  /**
   * Get relations for a table
   * @param {string} tableName - Table name
   * @returns {Array<object>} Relations for the table
   */
  getRelations(tableName: string): Array<{
    from: { table: string; column: string };
    to: { table: string; column: string };
    relationName: string;
  }> {
    return this.relations.get(tableName) ?? [];
  }

  /**
   * Get the primary key column name for a table (returns DB column name)
   * @param {string} tableName - Table name
   * @returns {string | null} The primary key column name or null
   */
  getPrimaryKey(tableName: string): string | null {
    const table = this.tables.get(tableName);
    if (!table) {
      return null;
    }
    for (const col of table.columns) {
      if (col.primaryKey) {
        return col.name;
      }
    }
    return null;
  }

  /**
   * Get the column name map (code key -> DB column name) for a table
   * @param {string} tableName - Table name
   * @returns {Record<string, string>} Column name map
   */
  getColumnMap(tableName: string): Record<string, string> {
    return this.columnMaps.get(tableName) ?? {};
  }

  /**
   * Get the reverse column name map (DB column name -> code key) for a table
   * @param {string} tableName - Table name
   * @returns {Record<string, string>} Reverse column name map
   */
  getReverseColumnMap(tableName: string): Record<string, string> {
    return this.reverseColumnMaps.get(tableName) ?? {};
  }
}
