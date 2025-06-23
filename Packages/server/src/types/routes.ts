export type RouteDefinition = {
  method: "GET" | "PATCH" | "POST" | "PUT" | "DELETE" | "WS" | "SUB";
  path: string;
  params?: unknown;
  query?: unknown;
  headers?: unknown;
  body?: unknown;
  response?: unknown;
};
