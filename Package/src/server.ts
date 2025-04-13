import { z } from "zod";
import { serve } from "bun";

type RouteSchema = {
  params?: z.ZodObject<any>;
};

type InferRouteContext<T extends RouteSchema> = {
  params: T["params"] extends z.ZodObject<any> ? z.infer<T["params"]> : {};
};

type RouteDefinition = {
  method: "GET";
  path: string;
  params: unknown;
};

export type ExtractRoutes<T extends RouteDefinition[]> = T[number];

export class Framework<Routes extends RouteDefinition[] = []> {
  private routes: {
    path: string;
    schema: RouteSchema;
    handler: (ctx: any) => Response;
  }[] = [];

  get<Path extends string, Params extends z.ZodObject<any>>(
    path: Path,
    handler: (ctx: InferRouteContext<{ params: Params }>) => Response,
    schema: { params: Params },
  ): Framework<[...Routes, { method: "GET"; path: Path; params: z.infer<Params> }]> {
    this.routes.push({ path, handler, schema });
    return this as unknown as Framework<
      [...Routes, { method: "GET"; path: Path; params: z.infer<Params> }]
    >;
  }

  listen(port: number) {
    serve({
      port,
      fetch: (req) => {
        const url = new URL(req.url);
        for (const route of this.routes) {
          const rawParams = matchRoute(url.pathname, route.path);
          if (!rawParams) continue;

          const parsedParams = route.schema.params
            ? route.schema.params.safeParse(rawParams)
            : { success: true, data: {} };

          if (!parsedParams.success) {
            return new Response("Invalid params", { status: 400 });
          }

          return route.handler({
            params: parsedParams.data,
          });
        }
        return new Response("Not found", { status: 404 });
      },
    });
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
