<div align="center">
  <p>
    <strong>🚀 Hedystia Framework</strong>
  </p>

  <p>
    <strong>Next-gen TypeScript framework for building type-safe APIs at lightspeed! ⚡</strong>
  </p>

  <p>
    <a href="https://www.npmjs.com/package/hedystia"><img src="https://img.shields.io/npm/v/hedystia.svg?style=flat-square" alt="npm version"></a>
    <a href="https://www.npmjs.com/package/hedystia"><img src="https://img.shields.io/npm/dm/hedystia.svg?style=flat-square" alt="npm downloads"></a>
    <a href="LICENSE"><img src="https://img.shields.io/github/license/Hedystia/Framework.svg?style=flat-square" alt="license"></a>
    <img src="https://img.shields.io/badge/Bun-powered-FFD43B?style=flat-square&logo=bun" alt="Bun powered">
  </p>
</div>

## 🚨 Early Access Notice
> **Warning**
> Framework is in active development. Core features are stable but some advanced functionality still being implemented.

## 🌟 Superpowers

- 🔒 **End-to-end type safety** - From params to response, full TypeScript integration
- ⚡ **Bun-native performance** - Built for Bun runtime with zod dependency
- 🧩 **Client integration** - Auto-generated type-safe HTTP client
- 🛡️ **Validation built-in** - Zod integration for runtime safety
- 🔌 **Extensible architecture** - Middleware, hooks and macros system

## 🚀 Launch in 30 Seconds

1. Install with Bun:
```bash
bun add hedystia
```

2. Create your first API:
```typescript
import { Hedystia, z } from "hedystia";

const app = new Hedystia()
  .get("/hello/:name", (ctx) => `Hello ${ctx.params.name}!`, {
    params: z.object({ name: z.string() }),
    response: z.string()
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
  body: z.object({
    email: z.string().email(),
    age: z.number().positive()
  })
})

// Client-side types
await client.users.post({
  email: "user@example.com", // Autocompletes!
  age: 25 // Type-checked
});
```

### ⚡ Performance First
- Bun runtime optimized
- Only zod dependency
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
  response: z.instanceof(Blob)
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
- 🚧 WebSocket Support

### Advanced Capabilities
- ✅ Zod Validation
- ✅ Hooks System (onRequest, onError, etc)
- ✅ Macro System for Auth/Rate Limiting
- 🚧 File System Routing
- 🚧 OpenAPI Spec Generation

## 💼 Production Ready
```typescript
// Error handling
.onError((err) => {
  return Response.json({ 
    error: err.message 
  }, { status: 500 })
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
MIT License © 2024 Hedystia Contributors

## 🗣️ Community
- [GitHub Issues](https://github.com/Hedystia/Framework/issues)
- [Discord Server](https://hedystia.com/support)
