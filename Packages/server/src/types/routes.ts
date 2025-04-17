export type RouteDefinition = {
  method: "GET" | "PATCH" | "POST" | "PUT" | "DELETE" | "WS";
  path: string;
  params?: unknown;
  query?: unknown;
  body?: unknown;
  response?: unknown;
};
