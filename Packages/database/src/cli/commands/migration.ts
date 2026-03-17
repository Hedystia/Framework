import { join } from "path";
import { DEFAULT_MIGRATIONS_PATH } from "../../constants";
import { generateMigrationTemplate } from "../../migrations";
import { ensureDir, writeFileSafe } from "../../utils";
import { generateTimestamp } from "../../utils/naming";

/**
 * Create a new migration file
 * @param {string} name - Migration name
 * @param {string} [path] - Output directory
 */
export function createMigration(name: string, path?: string): void {
  const dir = path ?? DEFAULT_MIGRATIONS_PATH;
  ensureDir(dir);

  const timestamp = generateTimestamp();
  const fileName = `${timestamp}_${name}.ts`;
  const filePath = join(dir, fileName);
  const migrationId = `${timestamp}_${name}`;
  const content = generateMigrationTemplate(migrationId);

  writeFileSafe(filePath, content);
  console.log(`Created migration: ${filePath}`);
}
