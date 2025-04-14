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

type PrefixRoutes<Prefix extends string, T extends RouteDefinition[]> = {
  [K in keyof T]: T[K] extends RouteDefinition
    ? {
        method: T[K]["method"];
        path: `${Prefix}${T[K]["path"]}`;
        params: T[K]["params"];
        query: T[K]["query"];
        body: T[K] extends { body: infer B } ? B : undefined;
        response: T[K] extends { response: infer R } ? R : undefined;
      }
    : never;
};

type RequestHandler = (ctx: any) => Response | Promise<Response>;
type NextFunction = () => Promise<Response>;

type OnRequestHandler = (req: Request) => Request | Promise<Request>;
type OnParseHandler = (req: Request) => Promise<any> | any;
type OnTransformHandler = (ctx: any) => any | Promise<any>;
type OnBeforeHandleHandler = (
  ctx: any,
  next: NextFunction,
) => Response | Promise<Response> | void | Promise<void>;
type OnAfterHandleHandler = (response: Response, ctx: any) => Response | Promise<Response>;
type OnMapResponseHandler = (result: any, ctx: any) => Response | Promise<Response>;
type OnErrorHandler = (error: Error, ctx: any) => Response | Promise<Response>;
type OnAfterResponseHandler = (response: Response, ctx: any) => void | Promise<void>;

export class Framework<Routes extends RouteDefinition[] = []> {
  routes: {
    method: "GET" | "PATCH" | "POST" | "PUT" | "DELETE";
    path: string;
    schema: RouteSchema;
    handler: RequestHandler;
  }[] = [];
  private reusePort: boolean;
  private prefix: string = "";
  private server: any = null;

  private onRequestHandlers: OnRequestHandler[] = [];
  private onParseHandlers: OnParseHandler[] = [];
  private onTransformHandlers: OnTransformHandler[] = [];
  private onBeforeHandleHandlers: OnBeforeHandleHandler[] = [];
  private onAfterHandleHandlers: OnAfterHandleHandler[] = [];
  private onMapResponseHandlers: OnMapResponseHandler[] = [];
  private onErrorHandlers: OnErrorHandler[] = [];
  private onAfterResponseHandlers: OnAfterResponseHandler[] = [];

  constructor(options?: FrameworkOptions) {
    this.reusePort = options?.reusePort ?? false;
  }

  onRequest(handler: OnRequestHandler): this {
    this.onRequestHandlers.push(handler);
    return this;
  }

  onParse(handler: OnParseHandler): this {
    this.onParseHandlers.push(handler);
    return this;
  }

  onTransform(handler: OnTransformHandler): this {
    this.onTransformHandlers.push(handler);
    return this;
  }

  onBeforeHandle(handler: OnBeforeHandleHandler): this {
    this.onBeforeHandleHandlers.push(handler);
    return this;
  }

  onAfterHandle(handler: OnAfterHandleHandler): this {
    this.onAfterHandleHandlers.push(handler);
    return this;
  }

  onMapResponse(handler: OnMapResponseHandler): this {
    this.onMapResponseHandlers.push(handler);
    return this;
  }

  onError(handler: OnErrorHandler): this {
    this.onErrorHandlers.push(handler);
    return this;
  }

  onAfterResponse(handler: OnAfterResponseHandler): this {
    this.onAfterResponseHandlers.push(handler);
    return this;
  }

  static createResponse(data: any, contentType?: string): Response {
    if (contentType === "text/plain" || typeof data === "string") {
      return new Response(data, {
        headers: { "Content-Type": contentType || "text/plain" },
      });
    }

    if (data instanceof Uint8Array || data instanceof ArrayBuffer) {
      return new Response(data);
    }

    if (data instanceof Blob) {
      return new Response(data);
    }

    if (data instanceof FormData) {
      return new Response(data);
    }

    return Response.json(data);
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
    const fullPath = this.prefix + path;
    this.routes.push({
      method: "GET",
      path: fullPath,
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
    const fullPath = this.prefix + path;
    this.routes.push({
      method: "PATCH",
      path: fullPath,
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
    const fullPath = this.prefix + path;
    this.routes.push({
      method: "POST",
      path: fullPath,
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
    const fullPath = this.prefix + path;
    this.routes.push({
      method: "PUT",
      path: fullPath,
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
    const fullPath = this.prefix + path;
    this.routes.push({
      method: "DELETE",
      path: fullPath,
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

  use<Prefix extends string, ChildRoutes extends RouteDefinition[]>(
    prefix: Prefix,
    childFramework: Framework<ChildRoutes>,
  ): Framework<[...Routes, ...PrefixRoutes<Prefix, ChildRoutes>]> {
    for (const route of childFramework.routes) {
      this.routes.push({
        ...route,
        path: prefix + route.path,
      });
    }

    this.onRequestHandlers.push(...childFramework.onRequestHandlers);
    this.onParseHandlers.push(...childFramework.onParseHandlers);
    this.onTransformHandlers.push(...childFramework.onTransformHandlers);
    this.onBeforeHandleHandlers.push(...childFramework.onBeforeHandleHandlers);
    this.onAfterHandleHandlers.push(...childFramework.onAfterHandleHandlers);
    this.onMapResponseHandlers.push(...childFramework.onMapResponseHandlers);
    this.onErrorHandlers.push(...childFramework.onErrorHandlers);
    this.onAfterResponseHandlers.push(...childFramework.onAfterResponseHandlers);

    return this as any;
  }

  listen(port: number): this {
    const self = this;
    this.server = serve({
      port,
      reusePort: this.reusePort,
      fetch: async function (originalReq: Request) {
        try {
          let req = originalReq;
          for (const handler of self.onRequestHandlers) {
            req = await handler(req);
          }

          const url = new URL(req.url);
          const method = req.method;

          const queryParams: Record<string, string> = {};
          url.searchParams.forEach((value, key) => {
            queryParams[key] = value;
          });

          for (const route of self.routes) {
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

            if (
              method === "PATCH" ||
              method === "POST" ||
              method === "PUT" ||
              method === "DELETE"
            ) {
              try {
                for (const parseHandler of self.onParseHandlers) {
                  const parsedResult = await parseHandler(req);
                  if (parsedResult !== undefined) {
                    body = parsedResult;
                    break;
                  }
                }

                if (body === undefined) {
                  const contentType = req.headers.get("Content-Type") || "";

                  if (contentType.includes("application/json")) {
                    body = await req.json();
                  } else if (contentType.includes("multipart/form-data")) {
                    body = await req.formData();
                  } else if (contentType.includes("text/")) {
                    body = await req.text();
                  } else {
                    try {
                      body = await req.json();
                    } catch {
                      body = await req.text();
                    }
                  }
                }

                if (route.schema.body) {
                  parsedBody = route.schema.body.safeParse(body);
                  if (!parsedBody.success) {
                    return new Response("Invalid body", { status: 400 });
                  }
                  body = parsedBody.data;
                }
              } catch (e) {
                if (route.schema.body) {
                  return new Response("Invalid body format", { status: 400 });
                }
              }
            }

            let ctx = {
              req,
              params: parsedParams.data,
              query: parsedQuery.data,
              body: parsedBody.success ? parsedBody.data : body,
              route: route.path,
              method,
            };

            for (const transformHandler of self.onTransformHandlers) {
              const transformedCtx = await transformHandler(ctx);
              if (transformedCtx) {
                ctx = transformedCtx;
              }
            }

            try {
              let mainHandlerExecuted = false;
              let processResult: Response | null = null;

              async function executeMainHandler() {
                mainHandlerExecuted = true;
                let result = await route.handler(ctx);

                if (!(result instanceof Response)) {
                  for (const mapHandler of self.onMapResponseHandlers) {
                    const mappedResponse = await mapHandler(result, ctx);
                    if (mappedResponse instanceof Response) {
                      result = mappedResponse;
                      break;
                    }
                  }

                  if (!(result instanceof Response)) {
                    result = Framework.createResponse(result);
                  }
                }

                let finalResponse = result;
                for (const afterHandler of self.onAfterHandleHandlers) {
                  const afterResult = await afterHandler(finalResponse, ctx);
                  if (afterResult instanceof Response) {
                    finalResponse = afterResult;
                  }
                }

                setTimeout(async () => {
                  for (const afterResponseHandler of self.onAfterResponseHandlers) {
                    await afterResponseHandler(finalResponse, ctx);
                  }
                }, 0);

                return finalResponse;
              }

              let i = 0;
              const executeBeforeHandlers = async (): Promise<Response> => {
                if (i >= self.onBeforeHandleHandlers.length) {
                  return executeMainHandler();
                }

                const beforeHandler = self.onBeforeHandleHandlers[i++];
                if (!beforeHandler) {
                  return executeMainHandler();
                }

                const nextCalled = { value: false };

                const next = async () => {
                  nextCalled.value = true;
                  return executeBeforeHandlers();
                };

                const earlyResponse = await beforeHandler(ctx, next as () => Promise<Response>);

                if (earlyResponse instanceof Response) {
                  let finalResponse = earlyResponse;
                  for (const afterHandler of self.onAfterHandleHandlers) {
                    const afterResult = await afterHandler(finalResponse, ctx);
                    if (afterResult instanceof Response) {
                      finalResponse = afterResult;
                    }
                  }

                  setTimeout(async () => {
                    for (const afterResponseHandler of self.onAfterResponseHandlers) {
                      await afterResponseHandler(finalResponse, ctx);
                    }
                  }, 0);

                  return finalResponse;
                }

                if (nextCalled.value) {
                  return processResult || new Response("Internal Server Error", { status: 500 });
                }

                return executeBeforeHandlers();
              };

              if (self.onBeforeHandleHandlers.length > 0) {
                const result = await executeBeforeHandlers();
                if (result) return result;
              }

              if (!mainHandlerExecuted) {
                return await executeMainHandler();
              }
            } catch (error) {
              for (const errorHandler of self.onErrorHandlers) {
                try {
                  const errorResponse = await errorHandler(error as Error, ctx);
                  if (errorResponse instanceof Response) {
                    return errorResponse;
                  }
                } catch {}
              }

              console.error(`Error processing request: ${error}`);
              return new Response(`Internal Server Error: ${(error as Error).message}`, {
                status: 500,
              });
            }
          }

          return new Response("Not found", { status: 404 });
        } catch (error) {
          console.error(`Unhandled server error: ${error}`);
          return new Response("Internal Server Error", { status: 500 });
        }
      },
    });

    return this;
  }

  close(): void {
    if (this.server) {
      this.server.stop();
      this.server = null;
    }
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
