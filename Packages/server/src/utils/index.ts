import {
  AnySchemaType,
  ArraySchema,
  BaseSchema,
  BooleanSchemaType,
  InstanceOfSchema,
  LiteralSchema,
  NullSchemaType,
  NumberSchemaType,
  ObjectSchemaType,
  OptionalSchema,
  StringSchemaType,
  UnionSchema,
} from "@hedystia/validations";

export function matchRoute(pathname: string, routePath: string): Record<string, string> | null {
  const pathParts = pathname.split("/").filter(Boolean);
  const routeParts = routePath.split("/").filter(Boolean);

  if (pathParts.length !== routeParts.length) {
    return null;
  }

  const params: Record<string, string> = {};
  for (let i = 0; i < routeParts.length; i++) {
    const routePart = routeParts[i];
    const pathPart = pathParts[i];
    if (!routePart) {
      return null;
    }
    if (routePart[0] === ":" && typeof pathPart === "string") {
      params[routePart.slice(1)] = pathPart;
    } else if (routePart !== pathPart) {
      return null;
    }
  }

  return params;
}

export async function parseRequestBody(req: Request): Promise<any> {
  const contentType = req.headers.get("Content-Type") || "";
  if (contentType.includes("application/json")) {
    return req.json();
  }
  if (contentType.includes("multipart/form-data")) {
    return req.formData();
  }
  if (contentType.includes("text/")) {
    return req.text();
  }
  try {
    return await req.json();
  } catch {
    return req.text();
  }
}

export function determineContentType(body: any): string {
  if (typeof body === "string") {
    return "text/plain";
  }
  if (body instanceof Uint8Array || body instanceof ArrayBuffer) {
    return "application/octet-stream";
  }
  if (body instanceof Blob) {
    return body.type || "application/octet-stream";
  }
  if (body instanceof FormData) {
    return "multipart/form-data";
  }
  return "application/json";
}

export function schemaToTypeString(schema: any): string {
  if (
    !schema ||
    (typeof schema === "object" && !schema.constructor.name) ||
    (typeof schema === "object" &&
      Object.keys(schema).length === 0 &&
      !(schema instanceof BaseSchema))
  ) {
    return "any";
  }

  if (schema && typeof schema === "object" && schema.def) {
    const def = schema.def;

    if (def.type === "literal" && Array.isArray(def.values) && def.values.length > 0) {
      const val = def.values[0];
      return typeof val === "string" ? `'${val}'` : String(val);
    }

    if (def.const !== undefined) {
      const val = def.const;
      return typeof val === "string" ? `'${val}'` : String(val);
    }

    if (typeof def.type === "string") {
      switch (def.type) {
        case "object": {
          const shape = def.shape;
          if (!shape || Object.keys(shape).length === 0) {
            return "{}";
          }
          const validIdentifierRegex = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
          const properties = Object.entries(shape)
            .map(([key, value]: [string, any]) => {
              const finalKey = validIdentifierRegex.test(key) ? key : `"${key}"`;
              const isOptional =
                value.def && (value.def.type === "optional" || value.def.type === "default");
              const optionalMarker = isOptional ? "?" : "";
              return `${finalKey}${optionalMarker}:${schemaToTypeString(value)}`;
            })
            .join(";");
          return `{${properties}}`;
        }
        case "string":
          return "string";
        case "number":
          return "number";
        case "boolean":
          return "boolean";
        case "null":
          return "null";
        case "any":
          return "any";
        case "unknown":
          return "unknown";
        case "optional":
        case "default":
          return schemaToTypeString(def.innerType);
        case "array":
          if (def.items) {
            return `(${schemaToTypeString(def.items)})[]`;
          }
          if (def.type) {
            return `(${schemaToTypeString(def.type)})[]`;
          }
          return "any[]";
        case "union":
          return def.options.map((s: any) => schemaToTypeString(s)).join("|");
        case "enum":
          return def.values.map((v: any) => (typeof v === "string" ? `'${v}'` : v)).join("|");
        default:
          return "any";
      }
    }
  }

  if (schema instanceof OptionalSchema) {
    return `${schemaToTypeString((schema as any).innerSchema)}|undefined`;
  }
  if (schema instanceof InstanceOfSchema) {
    const constructorName = (schema as any).classConstructor?.name;
    if (constructorName) {
      return constructorName;
    }
  }
  if (schema instanceof ArraySchema) {
    return `(${schemaToTypeString((schema as any).innerSchema)})[]`;
  }
  if (schema instanceof UnionSchema) {
    return (schema as any).schemas.map((s: any) => schemaToTypeString(s)).join("|");
  }
  if (schema instanceof LiteralSchema) {
    const val = (schema as any).value;
    return typeof val === "string" ? `'${val}'` : String(val);
  }
  if (schema instanceof ObjectSchemaType) {
    const definition = (schema as any).definition;
    if (!definition || Object.keys(definition).length === 0) {
      return "{}";
    }
    const validIdentifierRegex = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
    const properties = Object.entries(definition)
      .map(([key, value]) => {
        const finalKey = validIdentifierRegex.test(key) ? key : `"${key}"`;
        const isOptional = value instanceof OptionalSchema;
        const optionalMarker = isOptional ? "?" : "";
        return `${finalKey}${optionalMarker}:${schemaToTypeString(value)}`;
      })
      .join(";");
    return `{${properties}}`;
  }
  if (schema instanceof StringSchemaType) {
    return "string";
  }
  if (schema instanceof NumberSchemaType) {
    return "number";
  }
  if (schema instanceof BooleanSchemaType) {
    return "boolean";
  }
  if (schema instanceof NullSchemaType) {
    return "null";
  }
  if (schema instanceof AnySchemaType) {
    return "any";
  }

  return "any";
}
