/**
 * Generate a migration file template
 * @param {string} name - Migration name
 * @returns {string} Migration file content
 */
export function generateMigrationTemplate(name: string): string {
  return `import { migration } from "@hedystia/db";

export default migration("${name}", {
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
