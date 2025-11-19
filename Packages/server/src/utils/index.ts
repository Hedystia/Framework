import {
  AnySchemaType,
  ArraySchema,
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

  try {
    if (contentType.includes("application/json")) {
      return await req.json();
    }
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const obj: Record<string, any> = {};
      formData.forEach((value, key) => {
        if (obj[key]) {
          if (Array.isArray(obj[key])) {
            obj[key].push(value);
          } else {
            obj[key] = [obj[key], value];
          }
        } else {
          obj[key] = value;
        }
      });
      return obj;
    }
    if (contentType.includes("text/") || contentType.includes("xml")) {
      return await req.text();
    }
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      const params = new URLSearchParams(text);
      return Object.fromEntries(params.entries());
    }
  } catch (e) {
    console.warn("Error parsing body:", e);
  }

  try {
    return await req.json();
  } catch {
    return await req.text();
  }
}

export function determineContentType(body: any): string {
  if (typeof body === "string") {
    return "text/plain";
  }
  if (body instanceof Uint8Array || body instanceof ArrayBuffer) {
    return "application/octet-stream";
  }
  if (typeof Blob !== "undefined" && body instanceof Blob) {
    return body.type || "application/octet-stream";
  }
  if (typeof FormData !== "undefined" && body instanceof FormData) {
    return "multipart/form-data";
  }
  if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) {
    return "application/x-www-form-urlencoded";
  }
  return "application/json";
}

export function schemaToTypeString(schema: any): string {
  if (!schema) {
    return "any";
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

  if (schema instanceof OptionalSchema) {
    const inner = (schema as any).innerSchema;
    return `${schemaToTypeString(inner)} | undefined`;
  }

  if (schema instanceof ArraySchema) {
    const inner = (schema as any).innerSchema;
    const innerType = schemaToTypeString(inner);
    return innerType.includes("|") || innerType.includes("{")
      ? `(${innerType})[]`
      : `${innerType}[]`;
  }

  if (schema instanceof UnionSchema) {
    const schemas = (schema as any).schemas || [];
    if (schemas.length === 0) {
      return "any";
    }
    return schemas.map((s: any) => schemaToTypeString(s)).join(" | ");
  }

  if (schema instanceof LiteralSchema) {
    const val = (schema as any).value;
    return typeof val === "string" ? `'${val}'` : String(val);
  }

  if (schema instanceof InstanceOfSchema) {
    const ctor = (schema as any).classConstructor;
    return ctor ? ctor.name : "object";
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

        let typeStr = schemaToTypeString(value);

        if (isOptional) {
          typeStr = typeStr.replace(" | undefined", "");
        }

        return `${finalKey}${optionalMarker}:${typeStr}`;
      })
      .join(";");

    return `{${properties}}`;
  }

  return "any";
}
