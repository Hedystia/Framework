import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hedystiaAdapter } from "@hedystia/better-auth";
import { database } from "@hedystia/db";
import { describe, expect, it } from "vitest";

describe("Better Auth adapter integration boundaries", () => {
  it("creates a configured adapter without enabling unsupported capabilities", async () => {
    const db = database({
      schemas: {},
      database: "sqlite",
      connection: { filename: ":memory:" },
      syncSchemas: true,
    });

    try {
      const adapter = hedystiaAdapter(db, { usePlural: true, debugLogs: false });
      expect(adapter).toBeDefined();
      expect(typeof adapter).toBe("function");
    } finally {
      await db.close();
    }
  });

  it("generates a schema and migration for a Better Auth model", async () => {
    const outputDir = mkdtempSync(join(tmpdir(), "hedystia-auth-"));
    const db = database({ schemas: {}, database: "sqlite", connection: { filename: ":memory:" } });

    try {
      const adapterFactory = hedystiaAdapter(db, { outputDir });
      await db.initialize();
      const adapter = adapterFactory({} as any) as any;
      const result = await adapter.createSchema({
        tables: {
          User: {
            modelName: "users",
            fields: {
              email: { type: "string", required: true, unique: true },
              active: { type: "boolean", defaultValue: true },
            },
          },
        },
        file: "schema.changelog.md",
      });

      expect(result.code).toContain("CREATE Migration");
      expect(existsSync(join(outputDir, "schemas", "user.ts"))).toBe(true);
      expect(existsSync(join(outputDir, "migrations"))).toBe(true);
      expect(readFileSync(join(outputDir, "schemas", "user.ts"), "utf8")).toContain(
        "email: varchar(255).notNull().unique()",
      );
    } finally {
      await db.close();
      rmSync(outputDir, { recursive: true, force: true });
    }
  });
});
