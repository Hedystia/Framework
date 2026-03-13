<div align="center">
  <p>
    <strong>🚀 Hedystia Validations</strong>
  </p>

  <p>
    <strong>Next-gen TypeScript validation system for building type-safe APIs at lightspeed! ⚡</strong>
  </p>

  <p>
    <a href="https://docs.hedystia.com/validations/start"><img src="https://img.shields.io/badge/Docs-blue?style=flat-square" alt="Documentation"></a>
    <a href="https://www.npmjs.com/package/@hedystia/validations"><img src="https://img.shields.io/npm/v/@hedystia/validations.svg?style=flat-square" alt="npm version"></a>
    <a href="https://www.npmjs.com/package/@hedystia/validations"><img src="https://img.shields.io/npm/dm/@hedystia/validations.svg?style=flat-square" alt="npm downloads"></a>
    <a href="LICENSE"><img src="https://img.shields.io/github/license/Hedystia/Hedystia.svg?style=flat-square" alt="license"></a>
    <img src="https://img.shields.io/badge/Bun-powered-FFD43B?style=flat-square&logo=bun" alt="Bun powered">
  </p>
</div>

## 🌟 Superpowers

- 🌐 **Multi-runtime support** - Bun (default), Deno, Node.js, Vercel, Cloudflare Workers, Fastly Compute, Lambda, etc.
- 🔒 **End-to-end type safety** - Powerful built-in schema builder `h`.
- ⚡ **Lightweight & Fast** - Built for maximum performance without overhead.
- 📝 **Standard Schema** - 100% compatibility with the [Standard Schema](https://standardschema.dev/) specification.

## 🚀 Launch in 30 Seconds

1. Install with Bun:
```bash
bun add @hedystia/validations
```

2. Create your schemas:
```typescript
import { h } from "@hedystia/validations";

const userSchema = h.object({
  id: h.number(),
  name: h.string(),
  email: h.string().email(),
  tags: h.string().array().optional()
});
```

3. Type inference:
```typescript
import { Infer } from "@hedystia/validations";

type User = Infer<typeof userSchema>;
/*
{
  id: number;
  name: string;
  email: string;
  tags?: string[] | undefined;
}
*/
```

## 💡 Why Developers Love @hedystia/validations

### 🔄 Standard Schema Compatibility
Since `h` implements the Standard Schema specification, you can use it alongside any other Standard Schema-compatible library.

### 🧩 Complete Primitive & Composite Types
Provides a robust set of types to model any data structure:
- `h.string()` with built-in formats (email, uuid, phone, domain, date, regex)
- `h.number()` with `.min()`, `.max()` and coercion
- `h.boolean()`
- `h.literal()` and `h.options()` for unions
- `h.object()` and `.array()`

### ⚡ Built-in Coercion
URL parameters and query strings are always strings. Use `.coerce()` to convert them automatically:

```typescript
h.number().coerce()      // "42" -> 42
h.boolean().coerce()     // "true" -> true
```

## 📜 License
MIT License © 2026 Hedystia

## 📖 Documentation
- [Validations Documentation](https://docs.hedystia.com/validations/start)
- [Framework API Reference](https://docs.hedystia.com/framework/overview)

## 🗣️ Community
- [GitHub Issues](https://github.com/Hedystia/Hedystia/issues)
- [Discord Server](https://hedystia.com/support)
