<div align="center">
  <p>
    <strong>🚀 Hedystia Framework</strong>
  </p>

  <p>
    <strong>Next-gen TypeScript framework for building type-safe APIs at lightspeed! ⚡</strong>
  </p>

  <p>
    <a href="https://docs.hedystia.com"><img src="https://img.shields.io/badge/Docs-blue?style=flat-square" alt="Documentation"></a>
    <a href="https://www.npmjs.com/package/hedystia"><img src="https://img.shields.io/npm/v/hedystia.svg?style=flat-square" alt="npm version"></a>
    <a href="https://www.npmjs.com/package/hedystia"><img src="https://img.shields.io/npm/dm/hedystia.svg?style=flat-square" alt="npm downloads"></a>
    <a href="LICENSE"><img src="https://img.shields.io/github/license/Hedystia/Framework.svg?style=flat-square" alt="license"></a>
    <img src="https://img.shields.io/badge/Bun-powered-FFD43B?style=flat-square&logo=bun" alt="Bun powered">
  </p>
</div>

## 🌟 Superpowers

- 🌐 **Multi-runtime support** - Bun (default), Deno, Node.js, Vercel, Cloudflare Workers, Fastly Compute, Lambda, etc.
- 🔒 **End-to-end type safety** - From params to response, full TypeScript integration
- ⚡ **Bun-native performance** - Built for Bun runtime with native validation
- 🧩 **Client integration** - Auto-generated type-safe HTTP client
- 🛡️ **Validation built-in** - Zod integration for runtime safety
- 🔌 **Extensible architecture** - Middleware, hooks and macros system
- 📝 **Standard Schema** - Compatibility with the standard schema so you can use it with Zod, Arktype, etc.

## 🚀 Launch in 30 Seconds

1. Install with Bun:
```bash
bun add hedystia
```

2. Create your first API:
```typescript
import { Hedystia, h } from "hedystia";

const app = new Hedystia()
  .get("/hello/:name", (ctx) => `Hello ${ctx.params.name}!`, {
    params: h.object({ name: h.string() }),
    response: h.string()
  })
  .listen(3000);
```

3. Generate client and consume API:
```typescript
import { createClient } from "@hedystia/client";

const client = createClient<typeof app>("http://localhost:3000");

// Fully typed request!
const { data } = await client.hello.name("World").get();
console.log(data); // "Hello World!"
```

## 💡 Why Developers Love Hedystia

### 🔄 Full-stack Type Safety
```typescript
// Server-side validation
.post("/users", (ctx) => {...}, {
  body: h.object({
    email: h.email(),
    age: h.number()
  })
})

// Client-side types
await client.users.post({
  body: {
      email: "user@example.com", // Autocompletes!
      age: 25 // Type-checked
  }
});
```

### 📖 Swagger Integration

```typescript
import { swagger } from "@hedystia/swagger";

const swaggerPlugin = swagger({
  title: "My API",
  description: "An example API with Swagger",
  version: "1.0.0",
  tags: [
    { name: "users", description: "User operations" },
  ],
});

app.use("/swagger", swaggerPlugin.plugin(app));

app.listen(3000);
```

### ⚡ Performance First
- Bun runtime optimized
- Faster by default
- Own type validation system
- Faster than Express
- Built-in response compression

### 🧩 Modern Feature Set
```typescript
// File uploads
.post("/upload", async (ctx) => {
  const formData = await ctx.body; // FormData type
})

// Binary responses
.get("/pdf", () => new Blob([...]), {
  response: h.instanceof(Blob)
})

// Nested routing
.group("/api/v1", (v1) => v1
  .group("/users", (users) => users
    .get("/:id", ...)
  )
)
```

## 🛠️ Development Roadmap

### Core Features
- ✅ HTTP Methods: GET, POST, PUT, PATCH, DELETE
- ✅ Response Types: JSON, Text, FormData, Blob, ArrayBuffer
- ✅ Router Groups & Middleware
- ✅ Type-safe Client Generation
- ✅ WebSocket Support
- ✅ Adapter System to work with other frameworks

### Advanced Capabilities
- ✅ Standard Schema Compatibility
- ✅ Hooks System (onRequest, onError, etc)
- ✅ Macro System for Auth/Rate Limiting
- ✅ OpenAPI - Swagger Integration

## 💼 Production Ready
```typescript
// Error handling
.onError((err, ctx) => {
  ctx.set.status(500);
  return { 
    error: err.message 
  };
})

// Rate limiting macro
.macro({
  rateLimit: () => ({
    resolve: async (ctx) => {
      // Implement your logic
    }
  })
})
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
