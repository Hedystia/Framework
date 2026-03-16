# @hedystia/db

Next-gen TypeScript ORM for building type-safe database layers at lightspeed.

## Installation

```bash
bun add @hedystia/db
```

### Database Drivers

Install the driver for your database. The ORM will automatically detect and use the most appropriate library available.

#### SQLite Driver
Supports multiple libraries in the following priority:
1. `better-sqlite3`
2. `sqlite3`
3. `sql.js`
4. `bun:sqlite`

```bash
# You can install any of these

bun add better-sqlite3
bun add sqlite3
bun add sql.js

# Or use bun:sqlite if you are using Bun
```

#### MySQL & MariaDB Driver
Supports both `mysql2` and `mysql` libraries.
- **Naming**: Use `database: "mysql"` or `database: "mariadb"`.
- **MariaDB**: Fully supported through the same drivers.

```bash
bun add mysql2 # Preferred
# or
bun add mysql
```

# File-based (no extra install needed)

## Quick Start

### Define your schema

```ts
import { table, d } from "@hedystia/db";

export const users = table("users", {
  id: d.integer().primaryKey().autoIncrement(),
  name: d.varchar(255).notNull(),
  email: d.varchar(255).unique(),
  age: d.integer().default(0),
});

export const posts = table("posts", {
  id: d.integer().primaryKey().autoIncrement(),
  userId: d.integer().references(() => users.id, { onDelete: "CASCADE" }),
  title: d.varchar(255).notNull(),
  content: d.text(),
});
```

### Create the database

```ts
import { database } from "@hedystia/db";
import { users, posts } from "./schemas";

const db = database({
  schemas: [users, posts],
  database: "sqlite",
  connection: { filename: "./data.db" },
  syncSchemas: true,
  cache: true,
});

await db.initialize();
```

### Query your data

```ts
// Insert
const user = await db.users.insert({ name: "Alice", email: "alice@example.com" });

// Find
const allUsers = await db.users.find();
const alice = await db.users.findFirst({ where: { name: "Alice" } });

// Update
await db.users.update({ where: { id: 1 }, data: { age: 26 } });

// Delete
await db.users.delete({ where: { id: 1 } });

// Relations
const usersWithPosts = await db.users.find({ with: { posts: true } });
```

## Features

- **One schema, multiple databases** — MySQL, SQLite, and File drivers
- **Type-safe queries** — Full TypeScript inference for all operations
- **Smart caching** — Adaptive TTL cache with automatic invalidation
- **Migrations** — CLI and programmatic migration support
- **Schema sync** — Automatic table creation and column diffing
- **Relations** — Foreign key references with eager loading

## Links

- [Documentation](https://docs.hedystia.com/db/start)
- [GitHub](https://github.com/Hedystia/Hedystia)
- [Discord](https://hedystia.com/discord)
