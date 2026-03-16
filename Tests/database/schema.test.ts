import { describe, expect, it } from "bun:test";
import { ColumnBuilder, d, table } from "@hedystia/db";

describe("Schema - Column builders", () => {
  it("should create an integer column", () => {
    const col = d.integer();
    expect(col).toBeInstanceOf(ColumnBuilder);
    const meta = col.__build("id");
    expect(meta.type).toBe("integer");
    expect(meta.name).toBe("id");
  });

  it("should create a varchar column with length", () => {
    const col = d.varchar(100);
    const meta = col.__build("name");
    expect(meta.type).toBe("varchar");
    expect(meta.length).toBe(100);
  });

  it("should create a varchar column with default length", () => {
    const col = d.varchar();
    const meta = col.__build("name");
    expect(meta.length).toBe(255);
  });

  it("should create a char column", () => {
    const col = d.char(10);
    const meta = col.__build("code");
    expect(meta.type).toBe("char");
    expect(meta.length).toBe(10);
  });

  it("should create a text column", () => {
    const col = d.text();
    const meta = col.__build("bio");
    expect(meta.type).toBe("text");
  });

  it("should create a boolean column", () => {
    const col = d.boolean();
    const meta = col.__build("active");
    expect(meta.type).toBe("boolean");
  });

  it("should create a json column", () => {
    const col = d.json();
    const meta = col.__build("data");
    expect(meta.type).toBe("json");
  });

  it("should create a datetime column", () => {
    const col = d.datetime();
    const meta = col.__build("createdAt");
    expect(meta.type).toBe("datetime");
  });

  it("should create a timestamp column", () => {
    const col = d.timestamp();
    const meta = col.__build("updatedAt");
    expect(meta.type).toBe("timestamp");
  });

  it("should create a decimal column with precision and scale", () => {
    const col = d.decimal(8, 4);
    const meta = col.__build("price");
    expect(meta.type).toBe("decimal");
    expect(meta.precision).toBe(8);
    expect(meta.scale).toBe(4);
  });

  it("should create a float column", () => {
    const col = d.float();
    const meta = col.__build("score");
    expect(meta.type).toBe("float");
  });

  it("should create a bigint column", () => {
    const col = d.bigint();
    const meta = col.__build("bigId");
    expect(meta.type).toBe("bigint");
  });

  it("should create a blob column", () => {
    const col = d.blob();
    const meta = col.__build("data");
    expect(meta.type).toBe("blob");
  });
});

describe("Schema - Column modifiers", () => {
  it("should mark a column as primary key", () => {
    const meta = d.integer().primaryKey().__build("id");
    expect(meta.primaryKey).toBe(true);
    expect(meta.notNull).toBe(true);
    expect(meta.unique).toBe(true);
  });

  it("should mark a column as auto increment", () => {
    const meta = d.integer().primaryKey().autoIncrement().__build("id");
    expect(meta.autoIncrement).toBe(true);
  });

  it("should mark a column as not null", () => {
    const meta = d.varchar(255).notNull().__build("name");
    expect(meta.notNull).toBe(true);
  });

  it("should mark a column as nullable", () => {
    const meta = d.varchar(255).nullable().__build("bio");
    expect(meta.notNull).toBe(false);
  });

  it("should set a default value", () => {
    const meta = d.integer().default(0).__build("count");
    expect(meta.defaultValue).toBe(0);
  });

  it("should mark a column as unique", () => {
    const meta = d.varchar(255).unique().__build("email");
    expect(meta.unique).toBe(true);
  });

  it("should chain multiple modifiers", () => {
    const meta = d.varchar(100).notNull().unique().default("unknown").__build("username");
    expect(meta.notNull).toBe(true);
    expect(meta.unique).toBe(true);
    expect(meta.defaultValue).toBe("unknown");
    expect(meta.length).toBe(100);
  });
});

describe("Schema - Table definition", () => {
  it("should create a table definition", () => {
    const users = table("users", {
      id: d.integer().primaryKey().autoIncrement(),
      name: d.varchar(255).notNull(),
      email: d.varchar(255).unique(),
    });

    expect(users.__table).toBe(true);
    expect(users.__name).toBe("users");
    expect(users.__columns.length).toBe(3);
  });

  it("should have correct column metadata", () => {
    const users = table("users", {
      id: d.integer().primaryKey().autoIncrement(),
      name: d.varchar(100).notNull(),
    });

    const idCol = users.__columns.find((c) => c.name === "id")!;
    expect(idCol.primaryKey).toBe(true);
    expect(idCol.autoIncrement).toBe(true);
    expect(idCol.type).toBe("integer");
    expect(idCol.name).toBe("id");

    const nameCol = users.__columns.find((c) => c.name === "name")!;
    expect(nameCol.notNull).toBe(true);
    expect(nameCol.type).toBe("varchar");
    expect(nameCol.length).toBe(100);
    expect(nameCol.name).toBe("name");
  });

  it("should support references between tables", () => {
    const users = table("users", {
      id: d.integer().primaryKey().autoIncrement(),
      name: d.varchar(255).notNull(),
    });

    const posts = table("posts", {
      id: d.integer().primaryKey().autoIncrement(),
      userId: d.integer().references(() => users.id, { onDelete: "CASCADE" }),
      title: d.varchar(255).notNull(),
    });

    expect(posts.__deferredRefs.length).toBe(1);
    expect(posts.__deferredRefs[0]?.columnName).toBe("userId");
    expect(posts.__deferredRefs[0]?.onDelete).toBe("CASCADE");
  });
});
