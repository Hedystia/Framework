import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { database, integer, migration, table, varchar } from "@hedystia/db";
import { existsSync, rmSync } from "fs";

const TEST_DB = "/tmp/hedystia_test_migration.db";

const users = table("users", {
  id: integer().primaryKey().autoIncrement(),
  name: varchar(255).notNull(),
  email: varchar(255),
});

const addAgeColumn = migration("add_age_column", {
  async up({ sql }) {
    await sql("ALTER TABLE `users` ADD COLUMN `age` INTEGER DEFAULT 0");
  },
  async down({ sql }) {
    await sql("ALTER TABLE `users` DROP COLUMN `age`");
  },
});

const addScoreColumn = migration("add_score_column", {
  async up({ sql }) {
    await sql("ALTER TABLE `users` ADD COLUMN `score` REAL DEFAULT 0.0");
  },
  async down({ sql }) {
    await sql("ALTER TABLE `users` DROP COLUMN `score`");
  },
});

const db = database({
  schemas: [users],
  database: "sqlite",
  connection: { filename: TEST_DB },
  syncSchemas: true,
  runMigrations: true,
  migrations: [addAgeColumn, addScoreColumn],
  cache: false,
});

describe("Migrations", () => {
  beforeAll(async () => {
    if (existsSync(TEST_DB)) {
      rmSync(TEST_DB);
    }
    await db.initialize();
  });

  afterAll(async () => {
    await db.close();
    if (existsSync(TEST_DB)) {
      rmSync(TEST_DB);
    }
  });

  it("should create migration definition", () => {
    const m = migration("test", {
      up: async () => {},
      down: async () => {},
    });
    expect(m.name).toBe("test");
    expect(typeof m.up).toBe("function");
    expect(typeof m.down).toBe("function");
  });

  it("should run migrations on initialize", async () => {
    const rows = await db.raw("SELECT name FROM `__hedystia_migrations`");
    expect(rows.length).toBe(2);
    expect(rows[0].name).toBe("add_age_column");
    expect(rows[1].name).toBe("add_score_column");
  });

  it("should not re-run completed migrations", async () => {
    await db.close();
    if (existsSync(TEST_DB)) {
      rmSync(TEST_DB);
    }

    const db2 = database({
      schemas: [users],
      database: "sqlite",
      connection: { filename: TEST_DB },
      syncSchemas: true,
      runMigrations: true,
      migrations: [addAgeColumn, addScoreColumn],
      cache: false,
    });

    await db2.initialize();
    const rows = await db2.raw("SELECT name FROM `__hedystia_migrations`");
    expect(rows.length).toBe(2);

    await db2.close();
    if (existsSync(TEST_DB)) {
      rmSync(TEST_DB);
    }
  });
});
