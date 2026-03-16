import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { d, database, table } from "@hedystia/db";
import { existsSync, rmSync } from "fs";

const TEST_DB = "/tmp/hedystia_test_sqlite.db";

const users = table("users", {
  id: d.integer().primaryKey().autoIncrement(),
  name: d.varchar(255).notNull(),
  email: d.varchar(255).unique(),
  age: d.integer().default(0),
  active: d.boolean().default(true),
});

const posts = table("posts", {
  id: d.integer().primaryKey().autoIncrement(),
  userId: d.integer().references(() => users.id, { onDelete: "CASCADE" }),
  title: d.varchar(255).notNull(),
  content: d.text(),
});

const db = database({
  schemas: [users, posts],
  database: "sqlite",
  connection: { filename: TEST_DB },
  syncSchemas: true,
  cache: false,
});

describe("SQLite Driver", () => {
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

  describe("insert", () => {
    it("should insert a single row", async () => {
      const user = await db.users.insert({ name: "Alice", email: "alice@test.com", age: 25 });
      expect(user.name).toBe("Alice");
      expect(user.email).toBe("alice@test.com");
      expect(user.id).toBeDefined();
    });

    it("should insert with default values", async () => {
      const user = await db.users.insert({ name: "Bob", email: "bob@test.com" });
      expect(user.name).toBe("Bob");
      expect(user.id).toBeDefined();
    });
  });

  describe("insertMany", () => {
    it("should insert multiple rows", async () => {
      const result = await db.users.insertMany([
        { name: "Charlie", email: "charlie@test.com", age: 30 },
        { name: "Diana", email: "diana@test.com", age: 28 },
      ]);
      expect(result.length).toBe(2);
      expect(result[0]?.name).toBe("Charlie");
      expect(result[1]?.name).toBe("Diana");
    });
  });

  describe("find", () => {
    it("should find all rows", async () => {
      const result = await db.users.find();
      expect(result.length).toBeGreaterThanOrEqual(4);
    });

    it("should find with where clause", async () => {
      const result = await db.users.find({ where: { name: "Alice" } });
      expect(result.length).toBe(1);
      expect(result[0]?.name).toBe("Alice");
    });

    it("should find with comparison operators", async () => {
      const result = await db.users.find({ where: { age: { gte: 28 } } });
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it("should find with like operator", async () => {
      const result = await db.users.find({ where: { name: { like: "%li%" } } });
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it("should find with in operator", async () => {
      const result = await db.users.find({ where: { name: { in: ["Alice", "Bob"] } } });
      expect(result.length).toBe(2);
    });

    it("should find with orderBy", async () => {
      const result = await db.users.find({ orderBy: { name: "asc" } });
      expect(result.length).toBeGreaterThanOrEqual(4);
      expect(result[0]?.name).toBe("Alice");
    });

    it("should find with take and skip", async () => {
      const result = await db.users.find({ take: 2, skip: 1 });
      expect(result.length).toBe(2);
    });

    it("should find with select", async () => {
      const result = await db.users.find({ select: ["name", "email"] });
      expect(result.length).toBeGreaterThanOrEqual(4);
    });

    it("should find with OR condition", async () => {
      const result = await db.users.find({
        where: { OR: [{ name: "Alice" }, { name: "Bob" }] },
      });
      expect(result.length).toBe(2);
    });

    it("should find with between", async () => {
      const result = await db.users.find({ where: { age: { between: [20, 30] } } });
      expect(result.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("findMany", () => {
    it("should be an alias for find", async () => {
      const result = await db.users.findMany();
      expect(result.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe("findFirst", () => {
    it("should find the first matching row", async () => {
      const result = await db.users.findFirst({ where: { name: "Alice" } });
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Alice");
    });

    it("should return null if no match", async () => {
      const result = await db.users.findFirst({ where: { name: "NonExistent" } });
      expect(result).toBeNull();
    });
  });

  describe("update", () => {
    it("should update matching rows", async () => {
      const result = await db.users.update({
        where: { name: "Alice" },
        data: { age: 26 },
      });
      expect(result.length).toBe(1);
      expect(result[0]?.age).toBe(26);
    });

    it("should reject update without where", async () => {
      expect(db.users.update({ where: {}, data: { age: 99 } })).rejects.toThrow();
    });
  });

  describe("delete", () => {
    it("should delete matching rows", async () => {
      await db.users.insert({ name: "ToDelete", email: "delete@test.com" });
      const count = await db.users.delete({ where: { name: "ToDelete" } });
      expect(count).toBe(1);
    });

    it("should reject delete without where", async () => {
      expect(db.users.delete({ where: {} })).rejects.toThrow();
    });
  });

  describe("count", () => {
    it("should count all rows", async () => {
      const count = await db.users.count();
      expect(count).toBeGreaterThanOrEqual(4);
    });

    it("should count with where", async () => {
      const count = await db.users.count({ where: { name: "Alice" } });
      expect(count).toBe(1);
    });
  });

  describe("exists", () => {
    it("should return true when row exists", async () => {
      const result = await db.users.exists({ where: { name: "Alice" } });
      expect(result).toBe(true);
    });

    it("should return false when row does not exist", async () => {
      const result = await db.users.exists({ where: { name: "NonExistent" } });
      expect(result).toBe(false);
    });
  });

  describe("upsert", () => {
    it("should insert if not exists", async () => {
      const result = await db.users.upsert({
        where: { name: "UpsertNew" },
        create: { name: "UpsertNew", email: "upsert@test.com", age: 20 },
        update: { age: 21 },
      });
      expect(result.name).toBe("UpsertNew");
    });

    it("should update if exists", async () => {
      const result = await db.users.upsert({
        where: { name: "UpsertNew" },
        create: { name: "UpsertNew", email: "upsert2@test.com", age: 20 },
        update: { age: 99 },
      });
      expect(result.age).toBe(99);
    });
  });

  describe("truncate", () => {
    it("should remove all rows", async () => {
      await db.posts.insert({ userId: 1, title: "Test Post" });
      await db.posts.truncate();
      const count = await db.posts.count();
      expect(count).toBe(0);
    });
  });

  describe("relations", () => {
    it("should insert related data and find with relations", async () => {
      const user = await db.users.findFirst({ where: { name: "Alice" } });
      await db.posts.insert({ userId: user!.id, title: "Alice Post 1" });
      await db.posts.insert({ userId: user!.id, title: "Alice Post 2" });

      const usersWithPosts = await db.users.find({
        where: { name: "Alice" },
        with: { posts: true }
      });
      expect(usersWithPosts[0]?.posts).toBeDefined();
      expect(usersWithPosts[0]?.posts?.length).toBe(2);
    });
  });

  describe("raw", () => {
    it("should execute raw SQL", async () => {
      const rows = await db.raw("SELECT * FROM `users` WHERE `name` = ?", ["Alice"]);
      expect(rows.length).toBe(1);
    });
  });

  describe("transaction", () => {
    it("should commit on success", async () => {
      const before = await db.users.count();
      await db.transaction(async () => {
        await db.raw("INSERT INTO `users` (`name`, `email`) VALUES (?, ?)", [
          "TxUser",
          "tx@test.com",
        ]);
      });
      const after = await db.users.count();
      expect(after).toBe(before + 1);
    });
  });
});
