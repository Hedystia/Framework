export type RouteDefinition = {
  method: "GET" | "PATCH" | "POST" | "PUT" | "DELETE";
  path: string;
  params?: unknown;
  query?: unknown;
  body?: unknown;
  response?: unknown;
};
