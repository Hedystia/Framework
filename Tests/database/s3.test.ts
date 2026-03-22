import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { database, integer, table, text, varchar } from "@hedystia/db";

const users = table("hedystia_test_users", {
  id: integer().primaryKey().autoIncrement(),
  name: varchar(255).notNull(),
  email: varchar(255).unique(),
  bio: text(),
});

describe("S3 Driver", () => {
  let initialized = false;

  const db = database({
    schemas: { users },
    database: "s3",
    connection: {
      bucket: "hedystia-test",
      endpoint: process.env.S3_URL || "http://localhost:9000",
      region: "us-east-1",
      accessKeyId: process.env.S3_KEY_ID || "admin",
      secretAccessKey: process.env.S3_ACCESS_KEY || "password",
      prefix: "test-db",
    },
    syncSchemas: true,
    cache: false,
  });

  beforeAll(async () => {
    try {
      await db.initialize();
      initialized = true;
      await db.users.truncate();
    } catch (err: any) {
      console.warn("S3 driver test skipped:", err.message);
    }
  });

  afterAll(async () => {
    try {
      if (initialized) {
        await db.users.truncate();
        await db.close();
      }
    } catch {}
  });

  describe("insert", () => {
    it("should insert a single row", async () => {
      if (!initialized) {
        return;
      }
      const user = await db.users.insert({
        name: "Alice",
        email: "alice@s3.com",
      });
      expect(user.name).toBe("Alice");
      expect(user.email).toBe("alice@s3.com");
      expect(user.id).toBeDefined();
    });
  });

  describe("find", () => {
    it("should find all rows", async () => {
      if (!initialized) {
        return;
      }
      const result = await db.users.find();
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it("should find with where clause", async () => {
      if (!initialized) {
        return;
      }
      const result = await db.users.find({ where: { name: "Alice" } });
      expect(result.length).toBe(1);
      expect(result[0]?.name).toBe("Alice");
    });
  });

  describe("findFirst", () => {
    it("should find the first matching row", async () => {
      if (!initialized) {
        return;
      }
      const result = await db.users.findFirst({ where: { name: "Alice" } });
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Alice");
    });

    it("should return null if no match", async () => {
      if (!initialized) {
        return;
      }
      const result = await db.users.findFirst({ where: { name: "NonExistent" } });
      expect(result).toBeNull();
    });
  });

  describe("update", () => {
    it("should update matching rows", async () => {
      if (!initialized) {
        return;
      }
      const result = await db.users.update({
        where: { name: "Alice" },
        data: { bio: "Updated bio" },
      });
      expect(result.length).toBe(1);
      expect(result[0]?.bio).toBe("Updated bio");
    });
  });

  describe("delete", () => {
    it("should delete matching rows", async () => {
      if (!initialized) {
        return;
      }
      await db.users.insert({ name: "ToDelete", email: "delete@s3.com" });
      const count = await db.users.delete({ where: { name: "ToDelete" } });
      expect(count).toBe(1);
    });
  });

  describe("count", () => {
    it("should count all rows", async () => {
      if (!initialized) {
        return;
      }
      const count = await db.users.count();
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });

  describe("truncate", () => {
    it("should remove all rows", async () => {
      if (!initialized) {
        return;
      }
      await db.users.truncate();
      const count = await db.users.count();
      expect(count).toBe(0);
    });
  });
});
