export type RouteDefinition = {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  params?: unknown;
  query?: unknown;
  body?: unknown;
  response?: unknown;
};
