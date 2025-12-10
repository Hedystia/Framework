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
  const origins = cors.origin ?? "*";
  let allowedOrigin: string | null = null;

  if (origins === "*") {
    allowedOrigin = "*";
  } else if (origins === true) {
    allowedOrigin = origin || "*";
  } else if (typeof origins === "string") {
    if (origins === origin) {
      allowedOrigin = origin;
    }
  } else if (Array.isArray(origins)) {
    if (origin && origins.includes(origin)) {
      allowedOrigin = origin;
    }
  } else if (typeof origins === "function") {
    const result = origins(origin || undefined);
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

  const methods = cors.methods ?? "*";
  headers["Access-Control-Allow-Methods"] = Array.isArray(methods) ? methods.join(",") : methods;

  const allowedHeaders = cors.allowedHeaders ?? "*";
  headers["Access-Control-Allow-Headers"] = Array.isArray(allowedHeaders)
    ? allowedHeaders.join(",")
    : allowedHeaders;

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
