export type RouteDefinition = {
  method: "GET" | "POST" | "PUT";
  path: string;
  params?: unknown;
  query?: unknown;
  body?: unknown;
  response?: unknown;
};
