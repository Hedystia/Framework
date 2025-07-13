import type { CorsOptions } from "../types";

export default async function generateCorsHeaders(
  cors: CorsOptions | undefined,
  request: Request,
): Promise<Record<string, string | number>> {
  if (!cors) {
    return {};
  }

  const headers: Record<string, string | number> = {};
  const origin = request.headers.get("Origin");
  let allowedOrigin: string | null = null;

  if (cors.origin === "*") {
    allowedOrigin = "*";
  } else if (cors.origin === true) {
    allowedOrigin = origin || "*";
  } else if (typeof cors.origin === "string") {
    if (cors.origin === origin) {
      allowedOrigin = origin;
    }
  } else if (Array.isArray(cors.origin)) {
    if (origin && cors.origin.includes(origin)) {
      allowedOrigin = origin;
    }
  } else if (typeof cors.origin === "function") {
    const result = cors.origin(origin || undefined);
    const isAllowed = result instanceof Promise ? await result : result;
    if (isAllowed && origin) {
      allowedOrigin = origin;
    }
  }

  if (!allowedOrigin) {
    return {};
  }

  headers["Access-Control-Allow-Origin"] = allowedOrigin;

  if (cors.credentials) {
    if (headers["Access-Control-Allow-Origin"] === "*") {
      headers["Access-Control-Allow-Origin"] = origin || "*";
    }
    headers["Access-Control-Allow-Credentials"] = "true";
  }

  if (cors.methods) {
    headers["Access-Control-Allow-Methods"] = Array.isArray(cors.methods)
      ? cors.methods.join(",")
      : cors.methods;
  }

  if (cors.allowedHeaders) {
    headers["Access-Control-Allow-Headers"] = Array.isArray(cors.allowedHeaders)
      ? cors.allowedHeaders.join(",")
      : cors.allowedHeaders;
  }

  if (cors.exposedHeaders) {
    headers["Access-Control-Expose-Headers"] = Array.isArray(cors.exposedHeaders)
      ? cors.exposedHeaders.join(",")
      : cors.exposedHeaders;
  }

  if (cors.maxAge !== undefined) {
    headers["Access-Control-Max-Age"] = cors.maxAge;
  }

  return headers;
}
