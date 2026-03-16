import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { d, database, migration, table } from "@hedystia/db";

const users = table("hedystia_test_users", {
  id: d.integer().primaryKey().autoIncrement(),
  name: d.varchar(255).notNull(),
  email: d.varchar(255).unique(),
  age: d.integer().default(0),
  active: d.boolean().default(true),
});

const posts = table("hedystia_test_posts", {
  id: d.integer().primaryKey().autoIncrement(),
  userId: d.integer().references(() => users.id, { onDelete: "CASCADE" }),
  title: d.varchar(255).notNull(),
  content: d.text(),
});

const addScoreColumn = migration("add_score_to_users", {
  async up({ schema }) {
    await schema.addColumn("hedystia_test_users", "score", {
      name: "score",
      type: "float",
      primaryKey: false,
      autoIncrement: false,
      notNull: false,
      unique: false,
      defaultValue: 0,
    });
  },
  async down({ schema }) {
    await schema.dropColumn("hedystia_test_users", "score");
  },
});

const db = database({
  schemas: [users, posts],
  database: "mysql",
  connection: {
    host: process.env.MYSQL_HOST ?? "localhost",
    port: Number(process.env.MYSQL_PORT ?? 3306),
    user: process.env.MYSQL_USER ?? "root",
    password: process.env.MYSQL_PASSWORD ?? "",
    database: process.env.MYSQL_DATABASE ?? "hedystia_test",
  },
  syncSchemas: true,
  runMigrations: true,
  migrations: [addScoreColumn],
  cache: {
    enabled: true,
    ttl: 5000,
    maxTtl: 30000,
    maxEntries: 1000,
  },
});

describe("MySQL Driver", () => {
  beforeAll(async () => {
    try {
      await db.initialize();
    } catch {
      const driver = db.getDriver();
      await driver.execute("DROP TABLE IF EXISTS `hedystia_test_posts`");
      await driver.execute("DROP TABLE IF EXISTS `hedystia_test_users`");
      await driver.execute("DROP TABLE IF EXISTS `__hedystia_migrations`");
      await db.initialize();
    }
    await db.hedystia_test_posts.truncate();
    await db.hedystia_test_users.truncate();
  });

  afterAll(async () => {
    await db.hedystia_test_posts.truncate();
    await db.hedystia_test_users.truncate();
    await db.close();
  });

  describe("insert", () => {
    it("should insert a single row", async () => {
      const user = await db.hedystia_test_users.insert({
        name: "Alice",
        email: "alice@mysql.com",
        age: 25,
      });
      expect(user.name).toBe("Alice");
      expect(user.email).toBe("alice@mysql.com");
      expect(user.id).toBeDefined();
    });

    it("should insert with default values", async () => {
      const user = await db.hedystia_test_users.insert({
        name: "Bob",
        email: "bob@mysql.com",
      });
      expect(user.name).toBe("Bob");
      expect(user.id).toBeDefined();
    });
  });

  describe("insertMany", () => {
    it("should insert multiple rows", async () => {
      const result = await db.hedystia_test_users.insertMany([
        { name: "Charlie", email: "charlie@mysql.com", age: 30 },
        { name: "Diana", email: "diana@mysql.com", age: 28 },
      ]);
      expect(result.length).toBe(2);
      expect(result[0]?.name).toBe("Charlie");
      expect(result[1]?.name).toBe("Diana");
    });
  });

  describe("find", () => {
    it("should find all rows", async () => {
      const result = await db.hedystia_test_users.find();
      expect(result.length).toBeGreaterThanOrEqual(4);
    });

    it("should find with where clause", async () => {
      const result = await db.hedystia_test_users.find({ where: { name: "Alice" } });
      expect(result.length).toBe(1);
      expect(result[0]?.name).toBe("Alice");
    });

    it("should find with comparison operators", async () => {
      const result = await db.hedystia_test_users.find({ where: { age: { gte: 28 } } });
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it("should find with like operator", async () => {
      const result = await db.hedystia_test_users.find({ where: { name: { like: "%li%" } } });
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it("should find with in operator", async () => {
      const result = await db.hedystia_test_users.find({
        where: { name: { in: ["Alice", "Bob"] } },
      });
      expect(result.length).toBe(2);
    });

    it("should find with orderBy", async () => {
      const result = await db.hedystia_test_users.find({ orderBy: { name: "asc" } });
      expect(result.length).toBeGreaterThanOrEqual(4);
      expect(result[0]?.name).toBe("Alice");
    });

    it("should find with take and skip", async () => {
      const result = await db.hedystia_test_users.find({ take: 2, skip: 1 });
      expect(result.length).toBe(2);
    });

    it("should find with OR condition", async () => {
      const result = await db.hedystia_test_users.find({
        where: { OR: [{ name: "Alice" }, { name: "Bob" }] },
      });
      expect(result.length).toBe(2);
    });

    it("should find with between", async () => {
      const result = await db.hedystia_test_users.find({
        where: { age: { between: [20, 30] } },
      });
      expect(result.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("findMany", () => {
    it("should be an alias for find", async () => {
      const result = await db.hedystia_test_users.findMany();
      expect(result.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe("findFirst", () => {
    it("should find the first matching row", async () => {
      const result = await db.hedystia_test_users.findFirst({ where: { name: "Alice" } });
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Alice");
    });

    it("should return null if no match", async () => {
      const result = await db.hedystia_test_users.findFirst({ where: { name: "NonExistent" } });
      expect(result).toBeNull();
    });
  });

  describe("update", () => {
    it("should update matching rows", async () => {
      const result = await db.hedystia_test_users.update({
        where: { name: "Alice" },
        data: { age: 26 },
      });
      expect(result.length).toBe(1);
      expect(result[0]?.age).toBe(26);
    });

    it("should reject update without where", async () => {
      expect(db.hedystia_test_users.update({ where: {}, data: { age: 99 } })).rejects.toThrow();
    });
  });

  describe("delete", () => {
    it("should delete matching rows", async () => {
      await db.hedystia_test_users.insert({ name: "ToDelete", email: "delete@mysql.com" });
      const count = await db.hedystia_test_users.delete({ where: { name: "ToDelete" } });
      expect(count).toBe(1);
    });

    it("should reject delete without where", async () => {
      expect(db.hedystia_test_users.delete({ where: {} })).rejects.toThrow();
    });
  });

  describe("count", () => {
    it("should count all rows", async () => {
      const count = await db.hedystia_test_users.count();
      expect(count).toBeGreaterThanOrEqual(4);
    });

    it("should count with where", async () => {
      const count = await db.hedystia_test_users.count({ where: { name: "Alice" } });
      expect(count).toBe(1);
    });
  });

  describe("exists", () => {
    it("should return true when row exists", async () => {
      const result = await db.hedystia_test_users.exists({ where: { name: "Alice" } });
      expect(result).toBe(true);
    });

    it("should return false when row does not exist", async () => {
      const result = await db.hedystia_test_users.exists({ where: { name: "NonExistent" } });
      expect(result).toBe(false);
    });
  });

  describe("upsert", () => {
    it("should insert if not exists", async () => {
      const result = await db.hedystia_test_users.upsert({
        where: { name: "UpsertNew" },
        create: { name: "UpsertNew", email: "upsert@mysql.com", age: 20 },
        update: { age: 21 },
      });
      expect(result.name).toBe("UpsertNew");
    });

    it("should update if exists", async () => {
      const result = await db.hedystia_test_users.upsert({
        where: { name: "UpsertNew" },
        create: { name: "UpsertNew", email: "upsert2@mysql.com", age: 20 },
        update: { age: 99 },
      });
      expect(result.age).toBe(99);
    });
  });

  describe("truncate", () => {
    it("should remove all rows from posts", async () => {
      const user = await db.hedystia_test_users.findFirst({ where: { name: "Alice" } });
      await db.hedystia_test_posts.insert({ userId: user!.id, title: "Test Post" });
      await db.hedystia_test_posts.truncate();
      const count = await db.hedystia_test_posts.count();
      expect(count).toBe(0);
    });
  });

  describe("relations", () => {
    it("should insert related data and find with relations", async () => {
      const user = await db.hedystia_test_users.findFirst({ where: { name: "Alice" } });
      await db.hedystia_test_posts.insert({ userId: user!.id, title: "MySQL Post 1" });
      await db.hedystia_test_posts.insert({ userId: user!.id, title: "MySQL Post 2" });

      const usersWithPosts = await db.hedystia_test_users.find({
        where: { name: "Alice" },
        with: { hedystia_test_posts: true },
      });
      expect(usersWithPosts[0]?.hedystia_test_posts).toBeDefined();
      expect(usersWithPosts[0]?.hedystia_test_posts.length).toBe(2);
    });
  });

  describe("raw", () => {
    it("should execute raw SQL", async () => {
      const rows = await db.raw("SELECT * FROM `hedystia_test_users` WHERE `name` = ?", ["Alice"]);
      expect(rows.length).toBe(1);
    });
  });

  describe("migration", () => {
    it("should have run migration adding score column", async () => {
      const rows = await db.raw("SELECT name FROM `__hedystia_migrations`");
      expect(rows.some((r: any) => r.name === "add_score_to_users")).toBe(true);
    });
  });

  describe("cache", () => {
    it("should cache find results", async () => {
      const r1 = await db.hedystia_test_users.find({ where: { name: "Alice" } });
      const r2 = await db.hedystia_test_users.find({ where: { name: "Alice" } });
      expect(r1).toEqual(r2);
    });

    it("should invalidate cache on insert", async () => {
      const before = await db.hedystia_test_users.find();
      await db.hedystia_test_users.insert({ name: "CacheTest", email: "cachetest@mysql.com" });
      const after = await db.hedystia_test_users.find();
      expect(after.length).toBe(before.length + 1);
    });
  });
});
