import { z } from "zod";
import { serve } from "bun";
import type { RouteDefinition } from "./types/routes";

type RouteSchema = {
  params?: z.ZodObject<any>;
  query?: z.ZodObject<any>;
  body?: z.ZodType<any>;
  response?: z.ZodType<any>;
};

type InferRouteContext<T extends RouteSchema> = {
  req: Request;
  params: T["params"] extends z.ZodObject<any> ? z.infer<T["params"]> : {};
  query: T["query"] extends z.ZodObject<any> ? z.infer<T["query"]> : {};
  body: T["body"] extends z.ZodType<any> ? z.infer<T["body"]> : unknown;
};

interface FrameworkOptions {
  reusePort?: boolean;
}

export class Framework<Routes extends RouteDefinition[] = []> {
  routes: {
    method: "GET" | "PATCH" | "POST" | "PUT" | "DELETE";
    path: string;
    schema: RouteSchema;
    handler: (ctx: any) => Response;
  }[] = [];
  private reusePort: boolean;

  constructor(options?: FrameworkOptions) {
    this.reusePort = options?.reusePort ?? false;
  }

  get<
    Path extends string,
    Params extends z.ZodObject<any>,
    Query extends z.ZodObject<any>,
    ResponseSchema extends z.ZodType<any>,
  >(
    path: Path,
    handler: (ctx: InferRouteContext<{ params: Params; query: Query }>) => Response,
    schema: { params?: Params; query?: Query; response?: ResponseSchema } = {},
  ): Framework<
    [
      ...Routes,
      {
        method: "GET";
        path: Path;
        params: Params extends z.ZodObject<any> ? z.infer<Params> : {};
        query: Query extends z.ZodObject<any> ? z.infer<Query> : {};
        response: ResponseSchema extends z.ZodType<any> ? z.infer<ResponseSchema> : unknown;
      },
    ]
  > {
    this.routes.push({
      method: "GET",
      path,
      handler,
      schema: {
        params: schema.params || (z.object({}) as any),
        query: schema.query || (z.object({}) as any),
        response: schema.response,
      },
    });
    return this as any;
  }

  patch<
    Path extends string,
    Params extends z.ZodObject<any>,
    Query extends z.ZodObject<any>,
    Body extends z.ZodType<any>,
    ResponseSchema extends z.ZodType<any>,
  >(
    path: Path,
    handler: (ctx: InferRouteContext<{ params: Params; query: Query; body: Body }>) => Response,
    schema: { params?: Params; query?: Query; body?: Body; response?: ResponseSchema } = {},
  ): Framework<
    [
      ...Routes,
      {
        method: "PATCH";
        path: Path;
        params: Params extends z.ZodObject<any> ? z.infer<Params> : {};
        query: Query extends z.ZodObject<any> ? z.infer<Query> : {};
        body: Body extends z.ZodType<any> ? z.infer<Body> : unknown;
        response: ResponseSchema extends z.ZodType<any> ? z.infer<ResponseSchema> : unknown;
      },
    ]
  > {
    this.routes.push({
      method: "PATCH",
      path,
      handler,
      schema: {
        params: schema.params || (z.object({}) as any),
        query: schema.query || (z.object({}) as any),
        body: schema.body,
        response: schema.response,
      },
    });
    return this as any;
  }

  post<
    Path extends string,
    Params extends z.ZodObject<any>,
    Query extends z.ZodObject<any>,
    Body extends z.ZodType<any>,
    ResponseSchema extends z.ZodType<any>,
  >(
    path: Path,
    handler: (ctx: InferRouteContext<{ params: Params; query: Query; body: Body }>) => Response,
    schema: { params?: Params; query?: Query; body?: Body; response?: ResponseSchema } = {},
  ): Framework<
    [
      ...Routes,
      {
        method: "POST";
        path: Path;
        params: Params extends z.ZodObject<any> ? z.infer<Params> : {};
        query: Query extends z.ZodObject<any> ? z.infer<Query> : {};
        body: Body extends z.ZodType<any> ? z.infer<Body> : unknown;
        response: ResponseSchema extends z.ZodType<any> ? z.infer<ResponseSchema> : unknown;
      },
    ]
  > {
    this.routes.push({
      method: "POST",
      path,
      handler,
      schema: {
        params: schema.params || (z.object({}) as any),
        query: schema.query || (z.object({}) as any),
        body: schema.body,
        response: schema.response,
      },
    });
    return this as any;
  }

  put<
    Path extends string,
    Params extends z.ZodObject<any>,
    Query extends z.ZodObject<any>,
    Body extends z.ZodType<any>,
    ResponseSchema extends z.ZodType<any>,
  >(
    path: Path,
    handler: (ctx: InferRouteContext<{ params: Params; query: Query; body: Body }>) => Response,
    schema: { params?: Params; query?: Query; body?: Body; response?: ResponseSchema } = {},
  ): Framework<
    [
      ...Routes,
      {
        method: "PUT";
        path: Path;
        params: Params extends z.ZodObject<any> ? z.infer<Params> : {};
        query: Query extends z.ZodObject<any> ? z.infer<Query> : {};
        body: Body extends z.ZodType<any> ? z.infer<Body> : unknown;
        response: ResponseSchema extends z.ZodType<any> ? z.infer<ResponseSchema> : unknown;
      },
    ]
  > {
    this.routes.push({
      method: "PUT",
      path,
      handler,
      schema: {
        params: schema.params || (z.object({}) as any),
        query: schema.query || (z.object({}) as any),
        body: schema.body,
        response: schema.response,
      },
    });
    return this as any;
  }

  delete<
    Path extends string,
    Params extends z.ZodObject<any>,
    Query extends z.ZodObject<any>,
    Body extends z.ZodType<any>,
    ResponseSchema extends z.ZodType<any>,
  >(
    path: Path,
    handler: (ctx: InferRouteContext<{ params: Params; query: Query; body: Body }>) => Response,
    schema: { params?: Params; query?: Query; body?: Body; response?: ResponseSchema } = {},
  ): Framework<
    [
      ...Routes,
      {
        method: "DELETE";
        path: Path;
        params: Params extends z.ZodObject<any> ? z.infer<Params> : {};
        query: Query extends z.ZodObject<any> ? z.infer<Query> : {};
        body: Body extends z.ZodType<any> ? z.infer<Body> : unknown;
        response: ResponseSchema extends z.ZodType<any> ? z.infer<ResponseSchema> : unknown;
      },
    ]
  > {
    this.routes.push({
      method: "DELETE",
      path,
      handler,
      schema: {
        params: schema.params || (z.object({}) as any),
        query: schema.query || (z.object({}) as any),
        body: schema.body,
        response: schema.response,
      },
    });
    return this as any;
  }

  listen(port: number): this {
    serve({
      port,
      reusePort: this.reusePort,
      fetch: async (req) => {
        const url = new URL(req.url);
        const method = req.method;

        const queryParams: Record<string, string> = {};
        url.searchParams.forEach((value, key) => {
          queryParams[key] = value;
        });

        for (const route of this.routes) {
          if (route.method !== method) continue;

          const rawParams = matchRoute(url.pathname, route.path);
          if (!rawParams) continue;

          const parsedParams = route.schema.params
            ? route.schema.params.safeParse(rawParams)
            : { success: true, data: {} };

          if (!parsedParams.success) {
            return new Response("Invalid params", { status: 400 });
          }

          const parsedQuery = route.schema.query
            ? route.schema.query.safeParse(queryParams)
            : { success: true, data: {} };

          if (!parsedQuery.success) {
            return new Response("Invalid query parameters", { status: 400 });
          }

          let body = undefined;
          let parsedBody: ReturnType<z.ZodTypeAny["safeParse"]> = {
            success: true,
            data: undefined,
          };

          if (method === "PATCH" || method === "POST" || method === "PUT" || method === "DELETE") {
            try {
              body = await req.json();
              if (route.schema.body) {
                parsedBody = route.schema.body.safeParse(body);
                if (!parsedBody.success) {
                  return new Response("Invalid body", { status: 400 });
                }
              }
            } catch (e) {
              if (route.schema.body) {
                return new Response("Invalid JSON body", { status: 400 });
              }
            }
          }

          return route.handler({
            req,
            params: parsedParams.data,
            query: parsedQuery.data,
            body: parsedBody.data || body,
          });
        }
        return new Response("Not found", { status: 404 });
      },
    });
    return this;
  }
}

function matchRoute(pathname: string, routePath: string): Record<string, string> | null {
  const pathParts = pathname.split("/").filter(Boolean);
  const routeParts = routePath.split("/").filter(Boolean);

  if (pathParts.length !== routeParts.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < pathParts.length; i++) {
    const routePart = routeParts[i];
    const pathPart = pathParts[i];
    if (
      typeof routePart === "string" &&
      routePart.startsWith(":") &&
      typeof pathPart === "string"
    ) {
      params[routePart.slice(1)] = pathPart;
    } else if (routePart !== pathPart) {
      return null;
    }
  }

  return params;
}
