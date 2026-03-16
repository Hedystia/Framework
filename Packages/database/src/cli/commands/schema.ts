import { join } from "path";
import { DEFAULT_SCHEMAS_PATH } from "../../constants";
import { generateSchemaTemplate } from "../../migrations";
import { ensureDir, writeFileSafe } from "../../utils";

/**
 * Create a new schema file
 * @param {string} name - Table name
 * @param {string} [path] - Output directory
 */
export function createSchema(name: string, path?: string): void {
  const dir = path ?? DEFAULT_SCHEMAS_PATH;
  ensureDir(dir);

  const fileName = `${name}.ts`;
  const filePath = join(dir, fileName);
  const content = generateSchemaTemplate(name);

  writeFileSafe(filePath, content);
  console.log(`Created schema: ${filePath}`);
}
