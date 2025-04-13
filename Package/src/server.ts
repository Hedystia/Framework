import { z } from "zod";
import { serve } from "bun";

type RouteSchema = {
  params?: z.ZodObject<any>;
  body?: z.ZodType<any>;
  response?: z.ZodType<any>;
};

type InferRouteContext<T extends RouteSchema> = {
  params: T["params"] extends z.ZodObject<any> ? z.infer<T["params"]> : {};
  body: T["body"] extends z.ZodType<any> ? z.infer<T["body"]> : unknown;
  response: T["response"] extends z.ZodType<any> ? z.infer<T["response"]> : unknown;
};

type RouteDefinition = {
  method: "GET" | "POST";
  path: string;
  params?: unknown;
  body?: unknown;
  response?: unknown;
};

interface FrameworkOptions {
  reusePort?: boolean;
}

export type ExtractRoutes<T extends RouteDefinition[]> = T[number];

export class Framework<Routes extends RouteDefinition[] = []> {
  routes: {
    method: "GET" | "POST";
    path: string;
    schema: RouteSchema;
    handler: (ctx: any) => Response;
  }[] = [];
  private reusePort: boolean;

  constructor(options?: FrameworkOptions) {
    this.reusePort = options?.reusePort ?? false;
  }

  get<Path extends string, Params extends z.ZodObject<any>, ResponseSchema extends z.ZodType<any>>(
    path: Path,
    handler: (ctx: InferRouteContext<{ params: Params; response: ResponseSchema }>) => Response,
    schema: { params?: Params; response?: ResponseSchema } = {},
  ): Framework<
    [
      ...Routes,
      {
        method: "GET";
        path: Path;
        params: Params extends z.ZodObject<any> ? z.infer<Params> : {};
        response: z.infer<ResponseSchema>;
      },
    ]
  > {
    this.routes.push({ method: "GET", path, handler, schema });
    return this as unknown as Framework<
      [...Routes, { method: "GET"; path: Path; params: z.infer<Params> }]
    >;
  }

  post<
    Path extends string,
    Params extends z.ZodObject<any>,
    Body extends z.ZodType<any>,
    ResponseSchema extends z.ZodType<any>,
  >(
    path: Path,
    handler: (
      ctx: InferRouteContext<{ params: Params; body: Body; response: ResponseSchema }>,
    ) => Response,
    schema: { params?: Params; body?: Body; response?: ResponseSchema } = {},
  ): Framework<
    [
      ...Routes,
      {
        method: "POST";
        path: Path;
        params: Params extends z.ZodObject<any> ? z.infer<Params> : {};
        body: Body extends z.ZodType<any> ? z.infer<Body> : unknown;
        response: z.infer<ResponseSchema>;
      },
    ]
  > {
    this.routes.push({
      method: "POST",
      path,
      handler,
      schema: {
        params: schema.params || (z.object({}) as any),
        body: schema.body,
      },
    });
    return this as unknown as Framework<
      [
        ...Routes,
        {
          method: "POST";
          path: Path;
          params: Params extends z.ZodObject<any> ? z.infer<Params> : {};
          body: Body extends z.ZodType<any> ? z.infer<Body> : unknown;
        },
      ]
    >;
  }

  listen(port: number): this {
    serve({
      port,
      reusePort: this.reusePort,
      fetch: async (req) => {
        const url = new URL(req.url);
        const method = req.method;

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

          let body = undefined;
          let parsedBody: ReturnType<z.ZodTypeAny["safeParse"]> = {
            success: true,
            data: undefined,
          };

          if (method === "POST") {
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
            params: parsedParams.data,
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
