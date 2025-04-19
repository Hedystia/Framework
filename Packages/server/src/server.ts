import { z } from "@zod/mini";
import { serve, type BunRequest } from "bun";
import type { RouteDefinition } from "./types/routes";

type RouteSchema = {
  params?: z.ZodMiniObject<any>;
  query?: z.ZodMiniObject<any>;
  body?: z.ZodMiniType<any>;
  response?: z.ZodMiniType<any>;
  description?: string;
  tags?: string[];
};

type InferRouteContext<T extends RouteSchema> = {
  req: BunRequest;
  params: T["params"] extends z.ZodMiniObject<any> ? z.infer<T["params"]> : {};
  query: T["query"] extends z.ZodMiniObject<any> ? z.infer<T["query"]> : {};
  body: T["body"] extends z.ZodMiniType<any> ? z.infer<T["body"]> : unknown;
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

type OnRequestHandler = (req: BunRequest) => BunRequest | Promise<BunRequest>;
type OnParseHandler = (req: BunRequest) => Promise<any> | any;
type OnTransformHandler = (ctx: any) => any | Promise<any>;
type OnBeforeHandleHandler = (
  ctx: any,
  next: NextFunction,
) => Response | Promise<Response> | void | Promise<void>;
type OnAfterHandleHandler = (response: Response, ctx: any) => Response | Promise<Response>;
type OnMapResponseHandler = (result: any, ctx: any) => Response | Promise<Response>;
type OnErrorHandler = (error: Error, ctx: any) => Response | Promise<Response>;
type OnAfterResponseHandler = (response: Response, ctx: any) => void | Promise<void>;

type MacroResolveFunction<T> = (ctx: any) => T | Promise<T>;
type MacroErrorFunction = (statusCode: number, message?: string) => never;

type MacroData = Record<string, any>;

type BunRouteRecord = Record<string, any>;

type WebSocketHandler = {
  message: (ws: ServerWebSocket, message: string | ArrayBuffer | Uint8Array) => void;
  open?: (ws: ServerWebSocket) => void;
  close?: (ws: ServerWebSocket, code: number, reason: string) => void;
  error?: (ws: ServerWebSocket, error: Error) => void;
  drain?: (ws: ServerWebSocket) => void;
};

type WebSocketOptions = {
  maxPayloadLength?: number;
  idleTimeout?: number;
  backpressureLimit?: number;
  closeOnBackpressureLimit?: boolean;
  sendPings?: boolean;
  publishToSelf?: boolean;
  perMessageDeflate?:
    | boolean
    | {
        compress?: boolean | Compressor;
        decompress?: boolean | Compressor;
      };
};

interface ServerWebSocket {
  readonly data: any;
  readonly readyState: number;
  readonly remoteAddress: string;
  send(message: string | ArrayBuffer | Uint8Array, compress?: boolean): number;
  close(code?: number, reason?: string): void;
  subscribe(topic: string): void;
  unsubscribe(topic: string): void;
  publish(topic: string, message: string | ArrayBuffer | Uint8Array): void;
  isSubscribed(topic: string): boolean;
  cork(cb: (ws: ServerWebSocket) => void): void;
}

type Compressor =
  | "disable"
  | "shared"
  | "dedicated"
  | "3KB"
  | "4KB"
  | "8KB"
  | "16KB"
  | "32KB"
  | "64KB"
  | "128KB"
  | "256KB";

export class Hedystia<Routes extends RouteDefinition[] = [], Macros extends MacroData = {}> {
  public routes: {
    method: "GET" | "PATCH" | "POST" | "PUT" | "DELETE";
    path: string;
    schema: RouteSchema;
    handler: RequestHandler;
  }[] = [];
  private reusePort: boolean;
  private prefix: string = "";
  private server: any = null;
  public macros: Record<string, { resolve: MacroResolveFunction<any> }> = {};
  private staticRoutes: { path: string; response: Response }[] = [];

  private onRequestHandlers: OnRequestHandler[] = [];
  private onParseHandlers: OnParseHandler[] = [];
  private onTransformHandlers: OnTransformHandler[] = [];
  private onBeforeHandleHandlers: OnBeforeHandleHandler[] = [];
  private onAfterHandleHandlers: OnAfterHandleHandler[] = [];
  private onMapResponseHandlers: OnMapResponseHandler[] = [];
  private onErrorHandlers: OnErrorHandler[] = [];
  private onAfterResponseHandlers: OnAfterResponseHandler[] = [];

  private wsRoutes: Map<string, WebSocketHandler & WebSocketOptions> = new Map();

  constructor(options?: FrameworkOptions) {
    this.reusePort = options?.reusePort ?? false;
  }

  macro<T extends Record<string, (enabled: boolean) => { resolve: MacroResolveFunction<any> }>>(
    config: T,
  ): Hedystia<Routes, Macros & { [K in keyof T]: ReturnType<ReturnType<T[K]>["resolve"]> }> & {
    error: MacroErrorFunction;
  } {
    for (const [key, macroFactory] of Object.entries(config)) {
      this.macros[key] = macroFactory(true);
    }

    const self = this as unknown as Hedystia<
      Routes,
      Macros & { [K in keyof T]: ReturnType<ReturnType<T[K]>["resolve"]> }
    > & { error: MacroErrorFunction };
    self.error = (statusCode: number, message?: string): never => {
      throw { isMacroError: true, statusCode, message: message || "Unauthorized" };
    };

    return self;
  }

  group<Prefix extends string, GroupRoutes extends RouteDefinition[]>(
    prefix: Prefix,
    callback: (app: Hedystia<[]>) => Hedystia<GroupRoutes>,
  ): Hedystia<[...Routes, ...PrefixRoutes<Prefix, GroupRoutes>]> {
    const groupApp = new Hedystia();
    groupApp.prefix = this.prefix + prefix;

    const configuredApp = callback(groupApp);

    for (const route of configuredApp.routes) {
      this.routes.push({
        ...route,
      });
    }

    this.onRequestHandlers.push(...configuredApp.onRequestHandlers);
    this.onParseHandlers.push(...configuredApp.onParseHandlers);
    this.onTransformHandlers.push(...configuredApp.onTransformHandlers);
    this.onBeforeHandleHandlers.push(...configuredApp.onBeforeHandleHandlers);
    this.onAfterHandleHandlers.push(...configuredApp.onAfterHandleHandlers);
    this.onMapResponseHandlers.push(...configuredApp.onMapResponseHandlers);
    this.onErrorHandlers.push(...configuredApp.onErrorHandlers);
    this.onAfterResponseHandlers.push(...configuredApp.onAfterResponseHandlers);

    return this as any;
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
    Params extends z.ZodMiniObject<any>,
    Query extends z.ZodMiniObject<any>,
    ResponseSchema extends z.ZodMiniType<any>,
    MacroOptions extends Partial<{ [K in keyof Macros]: true }> = {},
  >(
    path: Path,
    handler: (ctx: InferRouteContext<{ params: Params; query: Query }> & Macros) => Response | any,
    schema: {
      params?: Params;
      query?: Query;
      response?: ResponseSchema;
      description?: string;
      tags?: string[];
    } & MacroOptions = {} as any,
  ): Hedystia<
    [
      ...Routes,
      {
        method: "GET";
        path: Path;
        params: Params extends z.ZodMiniObject<any> ? z.infer<Params> : {};
        query: Query extends z.ZodMiniObject<any> ? z.infer<Query> : {};
        response: ResponseSchema extends z.ZodMiniType<any> ? z.infer<ResponseSchema> : unknown;
      },
    ],
    Macros
  > {
    const fullPath = this.prefix + path;

    const hasMacros = Object.keys(schema).some(
      (key) => !["params", "query", "body", "response"].includes(key) && schema[key] === true,
    );

    const wrappedHandler = hasMacros
      ? this.createWrappedHandler(handler, schema)
      : async function (ctx: any) {
          const result = await handler(ctx);
          return result instanceof Response ? result : Hedystia.createResponse(result);
        };

    this.routes.push({
      method: "GET",
      path: fullPath,
      handler: wrappedHandler,
      schema: {
        params: schema.params || (z.object({}) as any),
        query: schema.query || (z.object({}) as any),
        response: schema.response,
        description: schema.description,
        tags: schema.tags,
      },
    });

    return this as any;
  }

  patch<
    Path extends string,
    Params extends z.ZodMiniObject<any>,
    Query extends z.ZodMiniObject<any>,
    Body extends z.ZodMiniType<any>,
    ResponseSchema extends z.ZodMiniType<any>,
    MacroOptions extends Partial<{ [K in keyof Macros]: true }> = {},
  >(
    path: Path,
    handler: (
      ctx: InferRouteContext<{ params: Params; query: Query; body: Body }> & Macros,
    ) => Response | any,
    schema: {
      params?: Params;
      query?: Query;
      body?: Body;
      response?: ResponseSchema;
      description?: string;
      tags?: string[];
    } & MacroOptions = {} as any,
  ): Hedystia<
    [
      ...Routes,
      {
        method: "PATCH";
        path: Path;
        params: Params extends z.ZodMiniObject<any> ? z.infer<Params> : {};
        query: Query extends z.ZodMiniObject<any> ? z.infer<Query> : {};
        body: Body extends z.ZodMiniType<any> ? z.infer<Body> : unknown;
        response: ResponseSchema extends z.ZodMiniType<any> ? z.infer<ResponseSchema> : unknown;
      },
    ],
    Macros
  > {
    const fullPath = this.prefix + path;

    const hasMacros = Object.keys(schema).some(
      (key) => !["params", "query", "body", "response"].includes(key) && schema[key] === true,
    );

    const wrappedHandler = hasMacros
      ? this.createWrappedHandler(handler, schema)
      : async function (ctx: any) {
          const result = await handler(ctx);
          return result instanceof Response ? result : Hedystia.createResponse(result);
        };

    this.routes.push({
      method: "PATCH",
      path: fullPath,
      handler: wrappedHandler,
      schema: {
        params: schema.params || (z.object({}) as any),
        query: schema.query || (z.object({}) as any),
        body: schema.body,
        response: schema.response,
        description: schema.description,
        tags: schema.tags,
      },
    });

    return this as any;
  }

  post<
    Path extends string,
    Params extends z.ZodMiniObject<any>,
    Query extends z.ZodMiniObject<any>,
    Body extends z.ZodMiniType<any>,
    ResponseSchema extends z.ZodMiniType<any>,
    MacroOptions extends Partial<{ [K in keyof Macros]: true }> = {},
  >(
    path: Path,
    handler: (
      ctx: InferRouteContext<{ params: Params; query: Query; body: Body }> & Macros,
    ) => Response | any,
    schema: {
      params?: Params;
      query?: Query;
      body?: Body;
      response?: ResponseSchema;
      description?: string;
      tags?: string[];
    } & MacroOptions = {} as any,
  ): Hedystia<
    [
      ...Routes,
      {
        method: "POST";
        path: Path;
        params: Params extends z.ZodMiniObject<any> ? z.infer<Params> : {};
        query: Query extends z.ZodMiniObject<any> ? z.infer<Query> : {};
        body: Body extends z.ZodMiniType<any> ? z.infer<Body> : unknown;
        response: ResponseSchema extends z.ZodMiniType<any> ? z.infer<ResponseSchema> : unknown;
      },
    ],
    Macros
  > {
    const fullPath = this.prefix + path;

    const hasMacros = Object.keys(schema).some(
      (key) => !["params", "query", "body", "response"].includes(key) && schema[key] === true,
    );

    const wrappedHandler = hasMacros
      ? this.createWrappedHandler(handler, schema)
      : async function (ctx: any) {
          const result = await handler(ctx);
          return result instanceof Response ? result : Hedystia.createResponse(result);
        };

    this.routes.push({
      method: "POST",
      path: fullPath,
      handler: wrappedHandler,
      schema: {
        params: schema.params || (z.object({}) as any),
        query: schema.query || (z.object({}) as any),
        body: schema.body,
        response: schema.response,
        description: schema.description,
        tags: schema.tags,
      },
    });

    return this as any;
  }

  put<
    Path extends string,
    Params extends z.ZodMiniObject<any>,
    Query extends z.ZodMiniObject<any>,
    Body extends z.ZodMiniType<any>,
    ResponseSchema extends z.ZodMiniType<any>,
    MacroOptions extends Partial<{ [K in keyof Macros]: true }> = {},
  >(
    path: Path,
    handler: (
      ctx: InferRouteContext<{ params: Params; query: Query; body: Body }> & Macros,
    ) => Response | any,
    schema: {
      params?: Params;
      query?: Query;
      body?: Body;
      response?: ResponseSchema;
      description?: string;
      tags?: string[];
    } & MacroOptions = {} as any,
  ): Hedystia<
    [
      ...Routes,
      {
        method: "PUT";
        path: Path;
        params: Params extends z.ZodMiniObject<any> ? z.infer<Params> : {};
        query: Query extends z.ZodMiniObject<any> ? z.infer<Query> : {};
        body: Body extends z.ZodMiniType<any> ? z.infer<Body> : unknown;
        response: ResponseSchema extends z.ZodMiniType<any> ? z.infer<ResponseSchema> : unknown;
      },
    ],
    Macros
  > {
    const fullPath = this.prefix + path;

    const hasMacros = Object.keys(schema).some(
      (key) => !["params", "query", "body", "response"].includes(key) && schema[key] === true,
    );

    const wrappedHandler = hasMacros
      ? this.createWrappedHandler(handler, schema)
      : async function (ctx: any) {
          const result = await handler(ctx);
          return result instanceof Response ? result : Hedystia.createResponse(result);
        };

    this.routes.push({
      method: "PUT",
      path: fullPath,
      handler: wrappedHandler,
      schema: {
        params: schema.params || (z.object({}) as any),
        query: schema.query || (z.object({}) as any),
        body: schema.body,
        response: schema.response,
        description: schema.description,
        tags: schema.tags,
      },
    });

    return this as any;
  }

  delete<
    Path extends string,
    Params extends z.ZodMiniObject<any>,
    Query extends z.ZodMiniObject<any>,
    Body extends z.ZodMiniType<any>,
    ResponseSchema extends z.ZodMiniType<any>,
    MacroOptions extends Partial<{ [K in keyof Macros]: true }> = {},
  >(
    path: Path,
    handler: (
      ctx: InferRouteContext<{ params: Params; query: Query; body: Body }> & Macros,
    ) => Response | any,
    schema: {
      params?: Params;
      query?: Query;
      body?: Body;
      response?: ResponseSchema;
      description?: string;
      tags?: string[];
    } & MacroOptions = {} as any,
  ): Hedystia<
    [
      ...Routes,
      {
        method: "DELETE";
        path: Path;
        params: Params extends z.ZodMiniObject<any> ? z.infer<Params> : {};
        query: Query extends z.ZodMiniObject<any> ? z.infer<Query> : {};
        body: Body extends z.ZodMiniType<any> ? z.infer<Body> : unknown;
        response: ResponseSchema extends z.ZodMiniType<any> ? z.infer<ResponseSchema> : unknown;
      },
    ],
    Macros
  > {
    const fullPath = this.prefix + path;

    const hasMacros = Object.keys(schema).some(
      (key) => !["params", "query", "body", "response"].includes(key) && schema[key] === true,
    );

    const wrappedHandler = hasMacros
      ? this.createWrappedHandler(handler, schema)
      : async function (ctx: any) {
          const result = await handler(ctx);
          return result instanceof Response ? result : Hedystia.createResponse(result);
        };

    this.routes.push({
      method: "DELETE",
      path: fullPath,
      handler: wrappedHandler,
      schema: {
        params: schema.params || (z.object({}) as any),
        query: schema.query || (z.object({}) as any),
        body: schema.body,
        response: schema.response,
        description: schema.description,
        tags: schema.tags,
      },
    });

    return this as any;
  }

  static<
    Path extends string,
    ResponseSchema extends z.ZodMiniType<any> = z.ZodMiniType<any>,
    ContentType extends string = string,
    ResponseBody = any,
  >(
    path: Path,
    response:
      | Response
      | {
          body: ResponseBody;
          contentType?: ContentType;
          status?: number;
          headers?: Record<string, string>;
        },
    schema: {
      response?: ResponseSchema;
    } = {},
  ): Hedystia<
    [
      ...Routes,
      {
        method: "GET";
        path: Path;
        params: {};
        query: {};
        response: ResponseSchema extends z.ZodMiniType<any> ? z.infer<ResponseSchema> : unknown;
      },
    ],
    Macros
  > {
    let finalResponse: Response;

    if (response instanceof Response) {
      finalResponse = response;
    } else {
      const { body, contentType, status = 200, headers = {} } = response;

      if (schema.response) {
        const validationResult = schema.response.safeParse(body);
        if (!validationResult.success) {
          throw new Error(
            `Static route response validation failed: ${JSON.stringify(validationResult.error)}`,
          );
        }
      }

      if (
        typeof body === "string" ||
        body instanceof Uint8Array ||
        body instanceof ArrayBuffer ||
        body instanceof Blob ||
        body instanceof FormData
      ) {
        finalResponse = new Response(body, {
          status,
          headers: {
            "Content-Type": contentType || this.determineContentType(body),
            ...headers,
          },
        });
      } else {
        finalResponse = Response.json(body, {
          status,
          headers,
        });
      }
    }

    this.staticRoutes.push({
      path,
      response: finalResponse,
    });

    return this as any;
  }

  use<Prefix extends string, ChildRoutes extends RouteDefinition[]>(
    prefix: Prefix,
    childFramework: Hedystia<ChildRoutes>,
  ): Hedystia<[...Routes, ...PrefixRoutes<Prefix, ChildRoutes>]> {
    for (const route of childFramework.routes) {
      this.routes.push({
        ...route,
        path: prefix + route.path,
      });
    }

    for (const staticRoute of childFramework.staticRoutes) {
      this.staticRoutes.push({
        path: prefix + staticRoute.path,
        response: staticRoute.response,
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

  ws<Path extends string, Params extends z.ZodMiniObject<any> = z.ZodMiniObject<any>>(
    path: Path,
    handler: WebSocketHandler,
    options: WebSocketOptions & {
      params?: Params;
    } = {},
  ): Hedystia<
    [
      ...Routes,
      {
        method: "WS";
        path: Path;
        params: Params extends z.ZodMiniObject<any> ? z.infer<Params> : {};
        query: {};
        response: unknown;
      },
    ],
    Macros
  > {
    const fullPath = this.prefix + path;
    this.wsRoutes.set(fullPath, { ...handler, ...options });
    return this as any;
  }

  listen(port: number): this {
    const self = this;

    const bunRoutes: BunRouteRecord = {};

    for (const route of self.routes) {
      const routePath = route.path;

      if (!bunRoutes[routePath]) {
        bunRoutes[routePath] = {};
      }

      bunRoutes[routePath][route.method] = async (req: BunRequest) => {
        try {
          let modifiedReq = req;
          for (const handler of self.onRequestHandlers) {
            modifiedReq = await handler(modifiedReq);
          }

          const url = new URL(req.url);
          const queryParams = Object.fromEntries(url.searchParams.entries());

          const rawParams = matchRoute(url.pathname, routePath);
          if (!rawParams) {
            return new Response("Invalid route parameters", { status: 400 });
          }

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
          let parsedBody: ReturnType<z.ZodMiniAny["safeParse"]> = {
            success: true,
            data: undefined,
          };

          if (
            route.method === "PATCH" ||
            route.method === "POST" ||
            route.method === "PUT" ||
            route.method === "DELETE"
          ) {
            try {
              for (const parseHandler of self.onParseHandlers) {
                const parsedResult = await parseHandler(modifiedReq);
                if (parsedResult !== undefined) {
                  body = parsedResult;
                  break;
                }
              }

              if (body === undefined) {
                body = await parseRequestBody(modifiedReq);
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
            req: modifiedReq,
            params: parsedParams.data,
            query: parsedQuery.data,
            body: parsedBody.success ? parsedBody.data : body,
            route: routePath,
            method: route.method,
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
                  result = Hedystia.createResponse(result);
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

            return new Response("Internal Server Error", { status: 500 });
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
        } catch (error) {
          console.error(`Unhandled server error: ${error}`);
          return new Response("Internal Server Error", { status: 500 });
        }
      };
    }

    if (this.staticRoutes && this.staticRoutes.length > 0) {
      for (const staticRoute of this.staticRoutes) {
        bunRoutes[staticRoute.path] = staticRoute.response;
      }
    }

    const wsConfig: Record<string, any> = {};
    if (this.wsRoutes.size > 0) {
      wsConfig.websocket = {
        message: (ws: ServerWebSocket, message: string | ArrayBuffer | Uint8Array) => {
          const handler = this.wsRoutes.get(ws.data?.__wsPath);
          if (handler?.message) {
            handler.message(ws, message);
          }
        },
        open: (ws: ServerWebSocket) => {
          const handler = this.wsRoutes.get(ws.data?.__wsPath);
          if (handler?.open) {
            handler.open(ws);
          }
        },
        close: (ws: ServerWebSocket, code: number, reason: string) => {
          const handler = this.wsRoutes.get(ws.data?.__wsPath);
          if (handler?.close) {
            handler.close(ws, code, reason);
          }
        },
        error: (ws: ServerWebSocket, error: Error) => {
          const handler = this.wsRoutes.get(ws.data?.__wsPath);
          if (handler?.error) {
            handler.error(ws, error);
          }
        },
        drain: (ws: ServerWebSocket) => {
          const handler = this.wsRoutes.get(ws.data?.__wsPath);
          if (handler?.drain) {
            handler.drain(ws);
          }
        },
      };

      for (const [_path, options] of this.wsRoutes.entries()) {
        if (options.maxPayloadLength)
          wsConfig.websocket.maxPayloadLength = options.maxPayloadLength;
        if (options.idleTimeout) wsConfig.websocket.idleTimeout = options.idleTimeout;
        if (options.backpressureLimit)
          wsConfig.websocket.backpressureLimit = options.backpressureLimit;
        if (options.closeOnBackpressureLimit)
          wsConfig.websocket.closeOnBackpressureLimit = options.closeOnBackpressureLimit;
        if (options.sendPings !== undefined) wsConfig.websocket.sendPings = options.sendPings;
        if (options.publishToSelf !== undefined)
          wsConfig.websocket.publishToSelf = options.publishToSelf;
        if (options.perMessageDeflate !== undefined)
          wsConfig.websocket.perMessageDeflate = options.perMessageDeflate;
      }
    }

    this.server = serve({
      port,
      reusePort: this.reusePort,
      routes: bunRoutes,
      fetch: function (this: any, req: Request, server: any) {
        const url = new URL(req.url);
        const path = url.pathname;
        if (self.wsRoutes.has(path) && req.headers.get("upgrade")?.toLowerCase() === "websocket") {
          const wsRoute = self.wsRoutes.get(path);
          const wsParamsSchema = (wsRoute as any)?.params;
          if (wsParamsSchema) {
            const rawParams = matchRoute(path, path);
            const parsedParams = wsParamsSchema.safeParse(rawParams || {});
            if (!parsedParams.success) {
              return new Response("Invalid WebSocket parameters", { status: 400 });
            }
          }
          const upgraded = server.upgrade(req, {
            data: { __wsPath: path },
          });
          if (!upgraded) {
            return new Response("WebSocket upgrade failed", { status: 400 });
          }
          return new Response(null, { status: 101 });
        }
        return new Response("Not found", { status: 404 });
      },
      ...wsConfig,
    });

    return this;
  }

  toJSONSchema(schema: any) {
    return z.toJSONSchema(schema);
  }

  private createWrappedHandler(
    handler: (ctx: any) => Response | any,
    schema: Record<string, any>,
  ): RequestHandler {
    const macros = Object.entries(schema)
      .filter(
        ([key]) =>
          !["params", "query", "body", "response", "description", "tags"].includes(key) &&
          schema[key] === true,
      )
      .map(([key]) => ({ key, macro: this.macros[key] }));

    return async function (ctx: any): Promise<Response> {
      if (macros.length > 0) {
        for (const { key, macro } of macros) {
          try {
            ctx[key] = await macro?.resolve(ctx);
          } catch (err: any) {
            if (err.isMacroError) {
              return new Response(err.message, { status: err.statusCode });
            }
            throw err;
          }
        }
      }

      const result = await handler(ctx);
      return result instanceof Response ? result : Hedystia.createResponse(result);
    };
  }

  private determineContentType(body: any): string {
    if (typeof body === "string") return "text/plain";
    if (body instanceof Uint8Array || body instanceof ArrayBuffer)
      return "application/octet-stream";
    if (body instanceof Blob) return body.type || "application/octet-stream";
    if (body instanceof FormData) return "multipart/form-data";
    return "application/json";
  }

  close(): void {
    if (this.server) {
      this.server.stop();
      this.server = null;
    }
  }

  error(statusCode: number, message: string): never {
    throw { statusCode, message };
  }
}

function matchRoute(pathname: string, routePath: string): Record<string, string> | null {
  const pathParts = pathname.split("/").filter(Boolean);
  const routeParts = routePath.split("/").filter(Boolean);

  if (pathParts.length !== routeParts.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < routeParts.length; i++) {
    const routePart = routeParts[i];
    const pathPart = pathParts[i];
    if (!routePart) return null;
    if (routePart[0] === ":" && typeof pathPart === "string") {
      params[routePart.slice(1)] = pathPart;
    } else if (routePart !== pathPart) {
      return null;
    }
  }

  return params;
}

async function parseRequestBody(req: BunRequest): Promise<any> {
  const contentType = req.headers.get("Content-Type") || "";
  if (contentType.includes("application/json")) return req.json();
  if (contentType.includes("multipart/form-data")) return req.formData();
  if (contentType.includes("text/")) return req.text();
  try {
    return await req.json();
  } catch {
    return req.text();
  }
}
