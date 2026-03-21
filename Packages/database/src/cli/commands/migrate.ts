import { resolve } from "path";
import { pathToFileURL } from "url";
import { DEFAULT_MIGRATIONS_PATH, DEFAULT_SCHEMAS_PATH } from "../../constants";
import { database } from "../../core/database";

interface MigrateOptions {
  config?: string;
  migrationsPath?: string;
  schemasPath?: string;
  database?: string;
  connection?: string;
  steps?: number;
}

async function loadModules(dir: string): Promise<Record<string, unknown>> {
  const fs = await import("fs");
  const path = await import("path");

  const absDir = resolve(dir);
  if (!fs.existsSync(absDir)) {
    return {};
  }

  const files = fs.readdirSync(absDir).filter((f: string) => /\.(ts|js|mjs|cjs)$/.test(f));
  const modules: Record<string, unknown> = {};

  for (const file of files) {
    const filePath = path.join(absDir, file);
    const fileUrl = pathToFileURL(filePath).href;
    const mod = await import(fileUrl);
    const key = path.basename(file, path.extname(file));
    if (mod.default) {
      modules[key] = mod.default;
    }
    for (const [k, v] of Object.entries(mod)) {
      if (k !== "default") {
        modules[k] = v;
      }
    }
  }

  return modules;
}

function parseConnection(connStr: string): Record<string, unknown> {
  if (connStr.endsWith(".db") || connStr.endsWith(".sqlite") || connStr.endsWith(".sqlite3")) {
    return { filename: connStr };
  }
  try {
    return JSON.parse(connStr);
  } catch {
    return { filename: connStr };
  }
}

async function createDbInstance(options: MigrateOptions) {
  const migrationsPath = options.migrationsPath ?? DEFAULT_MIGRATIONS_PATH;
  const schemasPath = options.schemasPath ?? DEFAULT_SCHEMAS_PATH;
  const dbType = options.database ?? "sqlite";

  const migrations = await loadModules(migrationsPath);
  const schemas = await loadModules(schemasPath);

  const connection = options.connection
    ? parseConnection(options.connection)
    : { filename: "./database.db" };

  const db = database({
    schemas,
    migrations,
    database: dbType as any,
    connection: connection as any,
    cache: false,
    runMigrations: false,
  });

  await db.initialize();
  return db;
}

/**
 * Run pending migrations
 */
export async function migrateUp(options: MigrateOptions): Promise<void> {
  const db = await createDbInstance(options);
  try {
    await db.migrateUp();
    console.log("Migrations applied successfully");
  } finally {
    await db.close();
  }
}

/**
 * Rollback migrations
 */
export async function migrateDown(options: MigrateOptions): Promise<void> {
  const db = await createDbInstance(options);
  try {
    const steps = options.steps ?? 1;
    const rolledBack = await db.migrateDown(steps);
    if (rolledBack.length === 0) {
      console.log("No migrations to rollback");
    } else {
      for (const name of rolledBack) {
        console.log(`  Rolled back: ${name}`);
      }
      console.log(`Rolled back ${rolledBack.length} migration(s)`);
    }
  } finally {
    await db.close();
  }
}
