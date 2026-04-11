<div align="center">
  <p>
    <strong>🚀 Hedystia</strong>
  </p>

  <p>
    <strong>A complete TypeScript ecosystem — server, ORM, reactive UI, validations, and more. ⚡</strong>
  </p>

  <p>
    <a href="https://docs.hedystia.com"><img src="https://img.shields.io/badge/Docs-blue?style=flat-square" alt="Documentation"></a>
    <a href="https://www.npmjs.com/package/hedystia"><img src="https://img.shields.io/npm/v/hedystia.svg?style=flat-square" alt="npm version"></a>
    <a href="https://www.npmjs.com/package/hedystia"><img src="https://img.shields.io/npm/dm/hedystia.svg?style=flat-square" alt="npm downloads"></a>
    <a href="LICENSE"><img src="https://img.shields.io/github/license/Hedystia/Hedystia.svg?style=flat-square" alt="license"></a>
    <img src="https://img.shields.io/badge/Bun-powered-FFD43B?style=flat-square&logo=bun" alt="Bun powered">
  </p>
</div>

## 📦 Packages

| Package | npm | Description |
|---------|-----|-------------|
| [`hedystia`](./Packages/server) | [![npm](https://img.shields.io/npm/v/hedystia.svg?style=flat-square)](https://www.npmjs.com/package/hedystia) | Core HTTP server framework with full type safety, WebSocket, SSE, middleware, hooks and macros |
| [`@hedystia/validations`](./Packages/validations) | [![npm](https://img.shields.io/npm/v/@hedystia/validations.svg?style=flat-square)](https://www.npmjs.com/package/@hedystia/validations) | Schema validation system — Standard Schema v1 compliant, interoperable with Zod, ArkType, etc. |
| [`@hedystia/db`](./Packages/database) | [![npm](https://img.shields.io/npm/v/@hedystia/db.svg?style=flat-square)](https://www.npmjs.com/package/@hedystia/db) | Type-safe ORM with schema-first design, migrations, caching, and multi-driver support (MySQL, SQLite, S3) |
| [`@hedystia/view`](./Packages/view) | [![npm](https://img.shields.io/npm/v/@hedystia/view.svg?style=flat-square)](https://www.npmjs.com/package/@hedystia/view) | Reactive UI engine — fine-grained signals, no Virtual DOM, JSX, SSR, and control flow primitives |
| [`@hedystia/client`](./Packages/client) | [![npm](https://img.shields.io/npm/v/@hedystia/client.svg?style=flat-square)](https://www.npmjs.com/package/@hedystia/client) | Auto-generated type-safe HTTP client with path chaining, SSE and WebSocket support |
| [`@hedystia/adapter`](./Packages/adapter) | [![npm](https://img.shields.io/npm/v/@hedystia/adapter.svg?style=flat-square)](https://www.npmjs.com/package/@hedystia/adapter) | Multi-runtime adapters — Cloudflare Workers, Node.js, Deno, Lambda, Vercel, Fastly Compute |
| [`@hedystia/swagger`](./Packages/swagger) | [![npm](https://img.shields.io/npm/v/@hedystia/swagger.svg?style=flat-square)](https://www.npmjs.com/package/@hedystia/swagger) | OpenAPI/Swagger documentation auto-generated from your routes |
| [`@hedystia/types`](./Packages/types) | [![npm](https://img.shields.io/npm/v/@hedystia/types.svg?style=flat-square)](https://www.npmjs.com/package/@hedystia/types) | Route type generation utility for end-to-end type safety |

### Integrations

| Package | npm | Description |
|---------|-----|-------------|
| [`@hedystia/astro`](./Packages/integrations/view/astro) | [![npm](https://img.shields.io/npm/v/@hedystia/astro.svg?style=flat-square)](https://www.npmjs.com/package/@hedystia/astro) | Astro integration for `@hedystia/view` components |
| [`@hedystia/better-auth`](./Packages/integrations/database/better-auth) | [![npm](https://img.shields.io/npm/v/@hedystia/better-auth.svg?style=flat-square)](https://www.npmjs.com/package/@hedystia/better-auth) | Better Auth adapter for `@hedystia/db` |

## 🚀 Quick Start

### Server

```bash
bun add hedystia
```

```typescript
import { Hedystia, h } from "hedystia";

const app = new Hedystia()
  .get("/hello/:name", (ctx) => `Hello ${ctx.params.name}!`, {
    params: h.object({ name: h.string() }),
    response: h.string()
  })
  .listen(3000);
```

### Type-safe Client

```bash
bun add @hedystia/client
```

```typescript
import { createClient } from "@hedystia/client";

const client = createClient<typeof app>("http://localhost:3000");

const { data } = await client.hello.name("World").get();
console.log(data); // "Hello World!"
```

### Database (ORM)

```bash
bun add @hedystia/db
```

```typescript
import { database, table } from "@hedystia/db";

const users = table("users", {
  id: (col) => col.int().primaryKey().autoIncrement(),
  name: (col) => col.string(),
  email: (col) => col.string().unique(),
});

const db = database({ driver: "mysql2", connection: { /* ... */ } });
const repo = db.repository(users);

await repo.insert({ name: "Alice", email: "alice@example.com" });
const user = await repo.findOne({ where: { email: "alice@example.com" } });
```

### Reactive UI (View)

```bash
bun add @hedystia/view
```

```typescript
import { sig, mount, Show, For } from "@hedystia/view";

function Counter() {
  const count = sig(0);
  return (
    <button onClick={() => count.set(count.get() + 1)}>
      Count: {count}
    </button>
  );
}

mount(Counter, document.getElementById("app")!);
```

### Validations

```bash
bun add @hedystia/validations
```

```typescript
import { h } from "@hedystia/validations";

const userSchema = h.object({
  email: h.email(),
  age: h.number(),
  name: h.string(),
});

// Standard Schema v1 compliant — works with Zod, ArkType, etc.
```

### Swagger

```typescript
import { swagger } from "@hedystia/swagger";

const docs = swagger({
  title: "My API",
  description: "API documentation",
  version: "1.0.0",
});

app.use("/swagger", docs.plugin(app));
```

### Multi-runtime Adapters

```typescript
import { adapter } from "@hedystia/adapter";

// Deploy anywhere
adapter(app).toCloudflareWorker();
adapter(app).toNodeHandler();
adapter(app).toDeno();
adapter(app).toLambda();
adapter(app).toVercel();
adapter(app).toFastlyCompute();
```

## 📜 License

MIT License © 2026 Hedystia

## 📖 Documentation

- [Full Documentation](https://docs.hedystia.com)
- [Getting Started Guide](https://docs.hedystia.com/framework/getting-started)
- [API Reference](https://docs.hedystia.com/framework/overview)

## 🗣️ Community

- [GitHub Issues](https://github.com/Hedystia/Hedystia/issues)
- [Discord Server](https://hedystia.com/support)
