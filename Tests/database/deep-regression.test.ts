import { existsSync, rmSync } from "node:fs";
import { database, datetime, integer, json, table, text, varchar } from "@hedystia/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const file = "/tmp/hedystia_deep_regression.db";
const accounts = table("deep_accounts", {
  id: integer().primaryKey().autoIncrement(),
  displayName: varchar(120).name("display_name").notNull(),
  profile: json(),
  createdAt: datetime().name("created_at"),
});
const notes = table("deep_notes", {
  id: integer().primaryKey().autoIncrement(),
  accountId: integer()
    .name("account_id")
    .references(() => accounts.id, { relationName: "notes" }),
  body: text().notNull(),
});

const db = database({
  schemas: { accounts, notes },
  database: "sqlite",
  connection: { filename: file },
  syncSchemas: true,
  cache: false,
});

describe("database deep repository contracts", () => {
  beforeAll(async () => {
    for (const suffix of ["", "-shm", "-wal"]) {
      if (existsSync(file + suffix)) {
        rmSync(file + suffix);
      }
    }
    await Promise.all([db.initialize(), db.initialize(), db.initialize()]);
  });

  beforeEach(async () => {
    await db.notes.truncate();
    await db.accounts.truncate();
    await db.accounts.insert({
      displayName: "Ada",
      profile: { roles: ["admin"], preferences: { density: "compact" } },
      createdAt: new Date("2026-01-02T03:04:05.000Z"),
    });
  });

  afterAll(async () => {
    await db.close();
    for (const suffix of ["", "-shm", "-wal"]) {
      if (existsSync(file + suffix)) {
        rmSync(file + suffix);
      }
    }
  });

  it("round-trips aliased columns, nested JSON, and Date values", async () => {
    const inserted = await db.accounts.findFirst({ where: { displayName: "Ada" } });

    expect(inserted).not.toBeNull();
    expect(inserted!.displayName).toBe("Ada");
    expect(inserted!.profile).toEqual({ roles: ["admin"], preferences: { density: "compact" } });
    expect(inserted!.createdAt).toEqual(new Date("2026-01-02T03:04:05.000Z"));

    const selected = await db.accounts.find({
      where: { displayName: "Ada" },
      select: ["displayName", "profile", "createdAt"],
      orderBy: { displayName: "asc" },
    });
    expect(selected).toHaveLength(1);
    expect(selected[0]).toMatchObject({ displayName: "Ada", profile: { roles: ["admin"] } });
    expect(selected[0]?.createdAt).toBeInstanceOf(Date);
  });

  it("eager-loads reverse relations and keeps logical filters isolated", async () => {
    const account = await db.accounts.findFirst({ where: { displayName: "Ada" } });
    await db.notes.insertMany([
      { accountId: account!.id, body: "first" },
      { accountId: account!.id, body: "second" },
      { accountId: account!.id, body: "third" },
    ]);

    const result = await db.accounts.find({
      where: { displayName: "Ada" },
      with: { notes: { orderBy: { id: "desc" }, take: 2 } },
    });
    expect(result[0]?.notes?.map((note) => note.body)).toEqual(["third", "second"]);
    expect(await db.notes.count({ where: { body: { in: ["first", "second", "third"] } } })).toBe(3);
  });

  it("commits successful transactions and rolls back failed transactions", async () => {
    const before = await db.accounts.count();
    await db.transaction(async () => {
      await db.accounts.insert({
        displayName: "Committed",
        profile: {},
        createdAt: new Date("2026-01-03T00:00:00.000Z"),
      });
    });
    expect(await db.accounts.count()).toBe(before + 1);

    await expect(
      db.transaction(async () => {
        await db.accounts.insert({
          displayName: "Rolled back",
          profile: {},
          createdAt: new Date("2026-01-04T00:00:00.000Z"),
        });
        throw new Error("abort unit of work");
      }),
    ).rejects.toThrow("abort unit of work");
    expect(await db.accounts.exists({ where: { displayName: "Rolled back" } })).toBe(false);
    await expect(db.transaction(() => db.transaction(async () => 1))).rejects.toThrow(
      "Nested transactions",
    );
  });

  it("supports upsert, conditional updates, and explicit deletion boundaries", async () => {
    const created = await db.accounts.upsert({
      where: { displayName: "Upserted" },
      create: {
        displayName: "Upserted",
        profile: { version: 1 },
        createdAt: new Date("2026-01-05T00:00:00.000Z"),
      },
      update: { profile: { version: 2 } },
    });
    expect(created.profile).toEqual({ version: 1 });

    const updated = await db.accounts.upsert({
      where: { displayName: "Upserted" },
      create: {
        displayName: "Upserted",
        profile: { version: 3 },
        createdAt: new Date("2026-01-06T00:00:00.000Z"),
      },
      update: { profile: { version: 2 } },
    });
    expect(updated.profile).toEqual({ version: 2 });
    expect(await db.accounts.delete({ where: { displayName: "Upserted" } })).toBe(1);
  });
});
