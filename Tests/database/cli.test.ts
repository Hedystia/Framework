import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { generateMigrationTemplate, generateSchemaTemplate } from "@hedystia/db";
import { spawn } from "bun";
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "fs";

const TEST_CLI_DIR = "/tmp/hedystia_test_cli";

describe("CLI Templates", () => {
  beforeAll(() => {
    if (existsSync(TEST_CLI_DIR)) {
      rmSync(TEST_CLI_DIR, { recursive: true });
    }
  });

  afterAll(() => {
    if (existsSync(TEST_CLI_DIR)) {
      rmSync(TEST_CLI_DIR, { recursive: true });
    }
  });

  it("should generate migration template with id", () => {
    const content = generateMigrationTemplate(
      "20260101000000_create_users",
      "createUsers20260101000000",
    );
    expect(content).toContain(
      'export const createUsers20260101000000 = migration("20260101000000_create_users"',
    );
    expect(content).toContain("async up(");
    expect(content).toContain("async down(");
    expect(content).toContain("@hedystia/db");
  });

  it("should generate migration template without id", () => {
    const content = generateMigrationTemplate("create_users", "createUsers");
    expect(content).toContain('export const createUsers = migration("create_users"');
    expect(content).toContain("async up(");
    expect(content).toContain("async down(");
    expect(content).toContain("@hedystia/db");
  });

  it("should generate schema template", () => {
    const content = generateSchemaTemplate("users");
    expect(content).toContain('table("users"');
    expect(content).toContain("integer()");
    expect(content).toContain("primaryKey()");
    expect(content).toContain("@hedystia/db");
  });
});

describe("CLI Commands", () => {
  const migrationDir = `${TEST_CLI_DIR}/migrations`;
  const schemaDir = `${TEST_CLI_DIR}/schemas`;

  it("should create migration file via CLI", async () => {
    const proc = spawn(
      [
        "bun",
        "run",
        "./Packages/database/src/cli.ts",
        "migration",
        "create",
        "test_migration",
        "--path",
        migrationDir,
      ],
      { cwd: "/home/zastinian/Documents/codes/Framework" },
    );
    await proc.exited;
    expect(existsSync(migrationDir)).toBe(true);
    const files = readdirSync(migrationDir);
    expect(files.length).toBe(1);
    expect(files[0]).toContain("test_migration");
  });

  it("should create schema file via CLI", async () => {
    const proc = spawn(
      [
        "bun",
        "run",
        "./Packages/database/src/cli.ts",
        "schema",
        "create",
        "products",
        "--path",
        schemaDir,
      ],
      { cwd: "/home/zastinian/Documents/codes/Framework" },
    );
    await proc.exited;
    expect(existsSync(schemaDir)).toBe(true);
    const files = readdirSync(schemaDir);
    expect(files.some((f) => f.includes("products"))).toBe(true);
  });

  it("should create migration with shorthand syntax", async () => {
    const dir = `${TEST_CLI_DIR}/migrations2`;
    const proc = spawn(
      [
        "bun",
        "run",
        "./Packages/database/src/cli.ts",
        "migration",
        "short_migration",
        "--path",
        dir,
      ],
      { cwd: "/home/zastinian/Documents/codes/Framework" },
    );
    await proc.exited;
    expect(existsSync(dir)).toBe(true);
    const files = readdirSync(dir);
    expect(files.length).toBe(1);
  });
});

describe("CLI migrate up/down", () => {
  const MIGRATE_DIR = "/tmp/hedystia_test_cli_migrate";
  const DB_PATH = `${MIGRATE_DIR}/test.db`;
  const MIGRATIONS_DIR = `${MIGRATE_DIR}/migrations`;
  const SCHEMAS_DIR = `${MIGRATE_DIR}/schemas`;
  const CWD = "/home/zastinian/Documents/codes/Framework";

  const cleanup = () => {
    if (existsSync(MIGRATE_DIR)) {
      rmSync(MIGRATE_DIR, { recursive: true });
    }
  };

  beforeAll(() => {
    cleanup();
    mkdirSync(MIGRATIONS_DIR, { recursive: true });
    mkdirSync(SCHEMAS_DIR, { recursive: true });

    writeFileSync(
      `${SCHEMAS_DIR}/tasks.ts`,
      `import { table, integer, varchar } from "@hedystia/db";

export const tasks = table("tasks", {
  id: integer().primaryKey().autoIncrement(),
  title: varchar(255).notNull(),
});
`,
    );

    writeFileSync(
      `${MIGRATIONS_DIR}/20260101000000_create_tasks.ts`,
      `import { migration, table, integer, varchar } from "@hedystia/db";

export const createTasks20260101000000 = migration("20260101000000_create_tasks", {
  async up({ schema }) {
    schema.createTable(
      table("tasks", {
        id: integer().primaryKey().autoIncrement(),
        title: varchar(255).notNull(),
      }),
    );
  },
  async down({ schema }) {
    schema.dropTable("tasks");
  },
});
`,
    );
  });

  afterAll(cleanup);

  it("should run migrate up via CLI", async () => {
    const proc = spawn(
      [
        "bun",
        "run",
        "./Packages/database/src/cli.ts",
        "migrate",
        "up",
        "--migrations",
        MIGRATIONS_DIR,
        "--schemas",
        SCHEMAS_DIR,
        "--database",
        "sqlite",
        "--connection",
        DB_PATH,
      ],
      { cwd: CWD, stdout: "pipe", stderr: "pipe" },
    );
    const exitCode = await proc.exited;
    const stdout = await new Response(proc.stdout).text();
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Migrations applied successfully");
  });

  it("should run migrate down via CLI", async () => {
    const proc = spawn(
      [
        "bun",
        "run",
        "./Packages/database/src/cli.ts",
        "migrate",
        "down",
        "--migrations",
        MIGRATIONS_DIR,
        "--schemas",
        SCHEMAS_DIR,
        "--database",
        "sqlite",
        "--connection",
        DB_PATH,
        "--steps",
        "1",
      ],
      { cwd: CWD, stdout: "pipe", stderr: "pipe" },
    );
    const exitCode = await proc.exited;
    const stdout = await new Response(proc.stdout).text();
    expect(exitCode).toBe(0);
    expect(stdout).toContain("Rolled back");
  });

  it("should show usage when no subcommand given", async () => {
    const proc = spawn(["bun", "run", "./Packages/database/src/cli.ts", "migrate"], {
      cwd: CWD,
      stdout: "pipe",
      stderr: "pipe",
    });
    await proc.exited;
    const stdout = await new Response(proc.stdout).text();
    expect(stdout).toContain("migrate up");
    expect(stdout).toContain("migrate down");
  });
});
