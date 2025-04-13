export type RouteDefinition = {
  method: "GET" | "POST";
  path: string;
  params?: unknown;
  body?: unknown;
  response?: unknown;
};
