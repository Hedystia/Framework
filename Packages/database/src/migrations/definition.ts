import type { MigrationContext, MigrationDefinition } from "../types";

/**
 * Define a database migration
 * @param {string} name - Migration name (should match the file name)
 * @param {object} actions - Migration actions
 * @param {(ctx: MigrationContext) => Promise<void>} actions.up - Function to run when applying the migration
 * @param {(ctx: MigrationContext) => Promise<void>} actions.down - Function to run when reverting the migration
 * @returns {MigrationDefinition} The migration definition
 */
export function migration(
  name: string,
  actions: {
    up: (ctx: MigrationContext) => Promise<void>;
    down: (ctx: MigrationContext) => Promise<void>;
  },
): MigrationDefinition {
  return {
    name,
    up: actions.up,
    down: actions.down,
  };
}
