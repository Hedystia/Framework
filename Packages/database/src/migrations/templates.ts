/**
 * Generate a migration file template
 * @param {string} id - Migration id (e.g. "20260320095958_sessions")
 * @param {string} varName - Variable name for the export (camelCase)
 * @returns {string} Migration file content
 */
export function generateMigrationTemplate(id: string, varName: string): string {
  return `import { migration } from "@hedystia/db";

export const ${varName} = migration("${id}", {
  async up({ schema, sql }) {
    // Add your migration logic here
  },
  async down({ schema, sql }) {
    // Add your rollback logic here
  },
});
`;
}

/**
 * Generate a schema file template
 * @param {string} name - Table name
 * @returns {string} Schema file content
 */
export function generateSchemaTemplate(name: string): string {
  return `import { table, integer, datetime } from "@hedystia/db";

export const ${name} = table("${name}", {
  id: integer().primaryKey().autoIncrement(),
  createdAt: datetime().default(new Date()),
  updatedAt: datetime().default(new Date()),
});
`;
}
