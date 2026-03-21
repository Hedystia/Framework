import { join } from "path";
import { DEFAULT_MIGRATIONS_PATH } from "../../constants";
import { generateMigrationTemplate } from "../../migrations";
import { ensureDir, writeFileSafe } from "../../utils";
import { generateTimestamp, toCamelCase } from "../../utils/naming";

/**
 * Create a new migration file
 * @param {string} name - Migration name
 * @param {string} [path] - Output directory
 * @param {boolean} [noId] - Omit timestamp from variable name and migration id
 */
export function createMigration(name: string, path?: string, noId?: boolean): void {
  const dir = path ?? DEFAULT_MIGRATIONS_PATH;
  ensureDir(dir);

  const timestamp = generateTimestamp();
  const fileName = `${timestamp}_${name}.ts`;
  const filePath = join(dir, fileName);
  const migrationId = noId ? name : `${timestamp}_${name}`;
  const varName = noId ? toCamelCase(name) : `${toCamelCase(name)}${timestamp}`;
  const content = generateMigrationTemplate(migrationId, varName);

  writeFileSafe(filePath, content);
  console.log(`Created migration: ${filePath}`);
}
