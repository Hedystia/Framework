import { describe, expect, it } from "bun:test";
import { d, SchemaRegistry, table } from "@hedystia/db";

const users = table("users", {
  id: d.integer().primaryKey().autoIncrement(),
  name: d.varchar(255).notNull(),
  email: d.varchar(255).unique(),
});

const posts = table("posts", {
  id: d.integer().primaryKey().autoIncrement(),
  userId: d.integer().references(() => users.id, { onDelete: "CASCADE" }),
  title: d.varchar(255).notNull(),
  content: d.text(),
});

describe("Schema Registry", () => {
  it("should register schemas", () => {
    const registry = new SchemaRegistry();
    registry.register([users, posts]);

    expect(registry.getTable("users")).toBeDefined();
    expect(registry.getTable("posts")).toBeDefined();
    expect(registry.getTable("nonexistent")).toBeUndefined();
  });

  it("should resolve references", () => {
    const registry = new SchemaRegistry();
    registry.register([users, posts]);

    const postsTable = registry.getTable("posts")!;
    const userIdCol = postsTable.columns.find((c) => c.name === "userId")!;
    expect(userIdCol.references).toBeDefined();
    expect(userIdCol.references!.table).toBe("users");
    expect(userIdCol.references!.column).toBe("id");
    expect(userIdCol.references!.onDelete).toBe("CASCADE");
  });

  it("should track relations", () => {
    const registry = new SchemaRegistry();
    registry.register([users, posts]);

    const postRelations = registry.getRelations("posts");
    expect(postRelations.length).toBeGreaterThan(0);

    const userRelations = registry.getRelations("users");
    expect(userRelations.length).toBeGreaterThan(0);
  });

  it("should get primary key", () => {
    const registry = new SchemaRegistry();
    registry.register([users, posts]);

    expect(registry.getPrimaryKey("users")).toBe("id");
    expect(registry.getPrimaryKey("posts")).toBe("id");
    expect(registry.getPrimaryKey("nonexistent")).toBeNull();
  });

  it("should get all tables", () => {
    const registry = new SchemaRegistry();
    registry.register([users, posts]);

    const allTables = registry.getAllTables();
    expect(allTables.size).toBe(2);
    expect(allTables.has("users")).toBe(true);
    expect(allTables.has("posts")).toBe(true);
  });

  it("should throw on invalid schema", () => {
    const registry = new SchemaRegistry();
    expect(() => registry.register([{} as any])).toThrow();
  });
});
