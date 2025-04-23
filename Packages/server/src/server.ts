import type { RouteDefinition } from "./types/routes";
import type { StandardSchemaV1 } from "@standard-schema/spec";

type ValidationSchema = StandardSchemaV1<any, any>;

type InferOutput<T extends ValidationSchema> = StandardSchemaV1.InferOutput<T>;

type RouteSchema = {
  params?: ValidationSchema;
  query?: ValidationSchema;
  body?: ValidationSchema;
  headers?: ValidationSchema;
  response?: ValidationSchema & { _type?: any };
  description?: string;
  tags?: string[];
};

type InferRouteContext<
  T extends RouteSchema,
  M extends MacroData = {},
  EnabledMacros extends keyof M = never,
> = {
  req: Request;
  params: T["params"] extends ValidationSchema ? InferOutput<T["params"]> : {};
  query: T["query"] extends ValidationSchema ? InferOutput<T["query"]> : {};
  body: T["body"] extends ValidationSchema ? InferOutput<T["body"]> : unknown;
  headers: T["headers"] extends ValidationSchema
    ? InferOutput<T["headers"]>
    : Record<string, string | null>;
} & Pick<M, EnabledMacros>;

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

type ContextTypes<T extends RouteSchema = {}> = {
  req: Request;
  params: T["params"] extends ValidationSchema ? InferOutput<T["params"]> : Record<string, any>;
  query: T["query"] extends ValidationSchema ? InferOutput<T["query"]> : Record<string, any>;
  body: T["body"] extends ValidationSchema ? InferOutput<T["body"]> : any;
  headers: T["headers"] extends ValidationSchema
    ? InferOutput<T["headers"]>
    : Record<string, string | null>;
  route?: string;
  method?: string;
};

type RequestHandler = (ctx: ContextTypes) => Response | Promise<Response>;
type NextFunction = () => Promise<Response>;
type GenericRequestHandler = (request: Request) => Response | Promise<Response>;

type OnRequestHandler = (req: Request) => Request | Promise<Request>;
type OnParseHandler = (req: Request) => Promise<any> | any;
type OnTransformHandler<T extends RouteSchema = {}> = (ctx: ContextTypes<T>) => any | Promise<any>;
type OnBeforeHandleHandler<T extends RouteSchema = {}> = (
  ctx: ContextTypes<T>,
  next: NextFunction,
) => Response | Promise<Response> | void | Promise<void>;
type OnAfterHandleHandler<T extends RouteSchema = {}> = (
  response: Response,
  ctx: ContextTypes<T>,
) => Response | Promise<Response>;
type OnMapResponseHandler<T extends RouteSchema = {}> = (
  result: ContextTypes<T>,
  ctx: ContextTypes<T>,
) => Response | Promise<Response>;
type OnErrorHandler<T extends RouteSchema = {}> = (
  error: Error,
  ctx: ContextTypes<T>,
) => Response | Promise<Response>;
type OnAfterResponseHandler<T extends RouteSchema = {}> = (
  response: Response,
  ctx: ContextTypes<T>,
) => void | Promise<void>;

type MacroResolveFunction<T extends RouteSchema = {}> = (ctx: ContextTypes<T>) => T | Promise<T>;
type MacroErrorFunction = (statusCode: number, message?: string) => never;

export type MacroData = Record<string, any>;

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
  public staticRoutes: { path: string; response: Response }[] = [];
  private genericHandlers: GenericRequestHandler[] = [];

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
    const prefixPath = groupApp.prefix;

    for (const route of configuredApp.routes) {
      const path = route.path === prefixPath + "/" ? prefixPath : route.path;
      this.routes.push({
        ...route,
        path,
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

  onTransform<T extends RouteSchema = {}>(handler: OnTransformHandler<T>): this {
    this.onTransformHandlers.push(handler as OnTransformHandler);
    return this;
  }

  onBeforeHandle<T extends RouteSchema = {}>(handler: OnBeforeHandleHandler<T>): this {
    this.onBeforeHandleHandlers.push(handler as OnBeforeHandleHandler);
    return this;
  }

  onAfterHandle<T extends RouteSchema = {}>(handler: OnAfterHandleHandler<T>): this {
    this.onAfterHandleHandlers.push(handler as OnAfterHandleHandler);
    return this;
  }

  onMapResponse<T extends RouteSchema = {}>(handler: OnMapResponseHandler<T>): this {
    this.onMapResponseHandlers.push(handler as OnMapResponseHandler);
    return this;
  }

  onError<T extends RouteSchema = {}>(handler: OnErrorHandler<T>): this {
    this.onErrorHandlers.push(handler as OnErrorHandler);
    return this;
  }

  onAfterResponse<T extends RouteSchema = {}>(handler: OnAfterResponseHandler<T>): this {
    this.onAfterResponseHandlers.push(handler as OnAfterResponseHandler);
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
    Params extends ValidationSchema,
    Query extends ValidationSchema,
    Headers extends ValidationSchema,
    ResponseSchema extends ValidationSchema,
    EnabledMacros extends keyof Macros = never,
  >(
    path: Path,
    handler: (
      ctx: InferRouteContext<
        { params: Params; query: Query; headers: Headers },
        Macros,
        EnabledMacros
      >,
    ) => Response | any,
    schema: {
      params?: Params;
      query?: Query;
      headers?: Headers;
      response?: ResponseSchema;
      description?: string;
      tags?: string[];
    } & { [K in EnabledMacros]?: true } = {} as any,
  ): Hedystia<
    [
      ...Routes,
      {
        method: "GET";
        path: Path;
        params: Params extends ValidationSchema ? InferOutput<Params> : {};
        query: Query extends ValidationSchema ? InferOutput<Query> : {};
        headers: Headers extends ValidationSchema
          ? InferOutput<Headers>
          : Record<string, string | null>;
        response: ResponseSchema extends ValidationSchema ? InferOutput<ResponseSchema> : unknown;
      },
    ],
    Macros
  > {
    const fullPath = this.prefix + path;

    const hasMacros = Object.keys(schema).some(
      (key) =>
        !["params", "query", "body", "headers", "response", "description", "tags"].includes(key) &&
        schema[key as keyof typeof schema] === true,
    );

    const wrappedHandler = hasMacros
      ? this.createWrappedHandler(handler, schema)
      : async function (ctx: any) {
          const result = handler(ctx);
          const finalResult = result instanceof Promise ? await result : result;
          return finalResult instanceof Response
            ? finalResult
            : Hedystia.createResponse(finalResult);
        };

    this.routes.push({
      method: "GET",
      path: fullPath,
      handler: wrappedHandler,
      schema: {
        params: schema.params || ({} as any),
        query: schema.query || ({} as any),
        headers: schema.headers || ({} as any),
        response: schema.response,
        description: schema.description,
        tags: schema.tags,
      },
    });

    return this as any;
  }

  patch<
    Path extends string,
    Params extends ValidationSchema,
    Query extends ValidationSchema,
    Body extends ValidationSchema,
    Headers extends ValidationSchema,
    ResponseSchema extends ValidationSchema,
    EnabledMacros extends keyof Macros = never,
  >(
    path: Path,
    handler: (
      ctx: InferRouteContext<
        { params: Params; query: Query; body: Body; headers: Headers },
        Macros,
        EnabledMacros
      >,
    ) => Response | any,
    schema: {
      params?: Params;
      query?: Query;
      body?: Body;
      headers?: Headers;
      response?: ResponseSchema;
      description?: string;
      tags?: string[];
    } & { [K in EnabledMacros]?: true } = {} as any,
  ): Hedystia<
    [
      ...Routes,
      {
        method: "PATCH";
        path: Path;
        params: Params extends ValidationSchema ? InferOutput<Params> : {};
        query: Query extends ValidationSchema ? InferOutput<Query> : {};
        body: Body extends ValidationSchema ? InferOutput<Body> : unknown;
        headers: Headers extends ValidationSchema
          ? InferOutput<Headers>
          : Record<string, string | null>;
        response: ResponseSchema extends ValidationSchema ? InferOutput<ResponseSchema> : unknown;
      },
    ],
    Macros
  > {
    const fullPath = this.prefix + path;

    const hasMacros = Object.keys(schema).some(
      (key) =>
        !["params", "query", "body", "headers", "response", "description", "tags"].includes(key) &&
        schema[key as keyof typeof schema] === true,
    );

    const wrappedHandler = hasMacros
      ? this.createWrappedHandler(handler, schema)
      : async function (ctx: any) {
          const result = handler(ctx);
          const finalResult = result instanceof Promise ? await result : result;
          return finalResult instanceof Response
            ? finalResult
            : Hedystia.createResponse(finalResult);
        };

    this.routes.push({
      method: "PATCH",
      path: fullPath,
      handler: wrappedHandler,
      schema: {
        params: schema.params || ({} as any),
        query: schema.query || ({} as any),
        body: schema.body,
        headers: schema.headers || ({} as any),
        response: schema.response,
        description: schema.description,
        tags: schema.tags,
      },
    });

    return this as any;
  }

  post<
    Path extends string,
    Params extends ValidationSchema,
    Query extends ValidationSchema,
    Body extends ValidationSchema,
    Headers extends ValidationSchema,
    ResponseSchema extends ValidationSchema,
    EnabledMacros extends keyof Macros = never,
  >(
    path: Path,
    handler: (
      ctx: InferRouteContext<
        { params: Params; query: Query; body: Body; headers: Headers },
        Macros,
        EnabledMacros
      >,
    ) => Response | any,
    schema: {
      params?: Params;
      query?: Query;
      body?: Body;
      headers?: Headers;
      response?: ResponseSchema;
      description?: string;
      tags?: string[];
    } & { [K in EnabledMacros]?: true } = {} as any,
  ): Hedystia<
    [
      ...Routes,
      {
        method: "POST";
        path: Path;
        params: Params extends ValidationSchema ? InferOutput<Params> : {};
        query: Query extends ValidationSchema ? InferOutput<Query> : {};
        body: Body extends ValidationSchema ? InferOutput<Body> : unknown;
        headers: Headers extends ValidationSchema
          ? InferOutput<Headers>
          : Record<string, string | null>;
        response: ResponseSchema extends ValidationSchema ? InferOutput<ResponseSchema> : unknown;
      },
    ],
    Macros
  > {
    const fullPath = this.prefix + path;

    const hasMacros = Object.keys(schema).some(
      (key) =>
        !["params", "query", "body", "headers", "response", "description", "tags"].includes(key) &&
        schema[key as keyof typeof schema] === true,
    );

    const wrappedHandler = hasMacros
      ? this.createWrappedHandler(handler, schema)
      : async function (ctx: any) {
          const result = handler(ctx);
          const finalResult = result instanceof Promise ? await result : result;
          return finalResult instanceof Response
            ? finalResult
            : Hedystia.createResponse(finalResult);
        };

    this.routes.push({
      method: "POST",
      path: fullPath,
      handler: wrappedHandler,
      schema: {
        params: schema.params || ({} as any),
        query: schema.query || ({} as any),
        body: schema.body,
        headers: schema.headers || ({} as any),
        response: schema.response,
        description: schema.description,
        tags: schema.tags,
      },
    });

    return this as any;
  }

  put<
    Path extends string,
    Params extends ValidationSchema,
    Query extends ValidationSchema,
    Body extends ValidationSchema,
    Headers extends ValidationSchema,
    ResponseSchema extends ValidationSchema,
    EnabledMacros extends keyof Macros = never,
  >(
    path: Path,
    handler: (
      ctx: InferRouteContext<
        { params: Params; query: Query; body: Body; headers: Headers },
        Macros,
        EnabledMacros
      >,
    ) => Response | any,
    schema: {
      params?: Params;
      query?: Query;
      body?: Body;
      headers?: Headers;
      response?: ResponseSchema;
      description?: string;
      tags?: string[];
    } & { [K in EnabledMacros]?: true } = {} as any,
  ): Hedystia<
    [
      ...Routes,
      {
        method: "PUT";
        path: Path;
        params: Params extends ValidationSchema ? InferOutput<Params> : {};
        query: Query extends ValidationSchema ? InferOutput<Query> : {};
        body: Body extends ValidationSchema ? InferOutput<Body> : unknown;
        headers: Headers extends ValidationSchema
          ? InferOutput<Headers>
          : Record<string, string | null>;
        response: ResponseSchema extends ValidationSchema ? InferOutput<ResponseSchema> : unknown;
      },
    ],
    Macros
  > {
    const fullPath = this.prefix + path;

    const hasMacros = Object.keys(schema).some(
      (key) =>
        !["params", "query", "body", "headers", "response", "description", "tags"].includes(key) &&
        schema[key as keyof typeof schema] === true,
    );

    const wrappedHandler = hasMacros
      ? this.createWrappedHandler(handler, schema)
      : async function (ctx: any) {
          const result = handler(ctx);
          const finalResult = result instanceof Promise ? await result : result;
          return finalResult instanceof Response
            ? finalResult
            : Hedystia.createResponse(finalResult);
        };

    this.routes.push({
      method: "PUT",
      path: fullPath,
      handler: wrappedHandler,
      schema: {
        params: schema.params || ({} as any),
        query: schema.query || ({} as any),
        body: schema.body,
        headers: schema.headers || ({} as any),
        response: schema.response,
        description: schema.description,
        tags: schema.tags,
      },
    });

    return this as any;
  }

  delete<
    Path extends string,
    Params extends ValidationSchema,
    Query extends ValidationSchema,
    Body extends ValidationSchema,
    Headers extends ValidationSchema,
    ResponseSchema extends ValidationSchema,
    EnabledMacros extends keyof Macros = never,
  >(
    path: Path,
    handler: (
      ctx: InferRouteContext<
        { params: Params; query: Query; body: Body; headers: Headers },
        Macros,
        EnabledMacros
      >,
    ) => Response | any,
    schema: {
      params?: Params;
      query?: Query;
      body?: Body;
      headers?: Headers;
      response?: ResponseSchema;
      description?: string;
      tags?: string[];
    } & { [K in EnabledMacros]?: true } = {} as any,
  ): Hedystia<
    [
      ...Routes,
      {
        method: "DELETE";
        path: Path;
        params: Params extends ValidationSchema ? InferOutput<Params> : {};
        query: Query extends ValidationSchema ? InferOutput<Query> : {};
        body: Body extends ValidationSchema ? InferOutput<Body> : unknown;
        headers: Headers extends ValidationSchema
          ? InferOutput<Headers>
          : Record<string, string | null>;
        response: ResponseSchema extends ValidationSchema ? InferOutput<ResponseSchema> : unknown;
      },
    ],
    Macros
  > {
    const fullPath = this.prefix + path;

    const hasMacros = Object.keys(schema).some(
      (key) =>
        !["params", "query", "body", "headers", "response", "description", "tags"].includes(key) &&
        schema[key as keyof typeof schema] === true,
    );

    const wrappedHandler = hasMacros
      ? this.createWrappedHandler(handler, schema)
      : async function (ctx: any) {
          const result = handler(ctx);
          const finalResult = result instanceof Promise ? await result : result;
          return finalResult instanceof Response
            ? finalResult
            : Hedystia.createResponse(finalResult);
        };

    this.routes.push({
      method: "DELETE",
      path: fullPath,
      handler: wrappedHandler,
      schema: {
        params: schema.params || ({} as any),
        query: schema.query || ({} as any),
        body: schema.body,
        headers: schema.headers || ({} as any),
        response: schema.response,
        description: schema.description,
        tags: schema.tags,
      },
    });

    return this as any;
  }

  static<
    Path extends string,
    ResponseSchema extends ValidationSchema = ValidationSchema,
    Headers extends ValidationSchema = ValidationSchema,
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
          headers?: Headers;
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
        response: ResponseSchema extends ValidationSchema ? InferOutput<ResponseSchema> : unknown;
      },
    ],
    Macros
  > {
    let finalResponse: Response;

    if (response instanceof Response) {
      finalResponse = response;
    } else {
      const { body, contentType, status = 200, headers = {} } = response;

      const result = schema.response?.["~standard"]?.validate?.(body);
      if (result && typeof (result as any).then === "function") {
        (result as Promise<any>).then((validationResult) => {
          if ("issues" in validationResult) {
            throw new Error(
              `Static route response validation failed: ${JSON.stringify(validationResult.issues)}`,
            );
          }
        });
      } else if (result && "issues" in result) {
        throw new Error(
          `Static route response validation failed: ${JSON.stringify(result.issues)}`,
        );
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

  handle(handler: GenericRequestHandler): this {
    this.genericHandlers.push(handler);
    return this;
  }

  use<ChildRoutes extends RouteDefinition[], ChildMacros extends MacroData = {}>(
    childFramework: Hedystia<ChildRoutes, ChildMacros>,
  ): Hedystia<[...Routes, ...ChildRoutes], Macros & ChildMacros>;
  use<
    Prefix extends string,
    ChildRoutes extends RouteDefinition[],
    ChildMacros extends MacroData = {},
  >(
    prefix: Prefix,
    childFramework: Hedystia<ChildRoutes, ChildMacros>,
  ): Hedystia<[...Routes, ...PrefixRoutes<Prefix, ChildRoutes>], Macros & ChildMacros>;
  use<
    PrefixOrChild extends string | Hedystia<any, any>,
    MaybeChild extends Hedystia<any, any> | undefined = undefined,
  >(
    prefixOrChildFramework: PrefixOrChild,
    maybeChildFramework?: MaybeChild,
  ): PrefixOrChild extends Hedystia<infer ChildRoutes, infer ChildMacros>
    ? Hedystia<[...Routes, ...ChildRoutes], Macros & ChildMacros>
    : MaybeChild extends Hedystia<infer ChildRoutes, infer ChildMacros>
      ? Hedystia<
          [...Routes, ...PrefixRoutes<PrefixOrChild & string, ChildRoutes>],
          Macros & ChildMacros
        >
      : never {
    let prefix = "";
    let childFramework: Hedystia<any>;

    if (prefixOrChildFramework instanceof Hedystia) {
      childFramework = prefixOrChildFramework;
    } else {
      prefix = prefixOrChildFramework;
      childFramework = maybeChildFramework as Hedystia<any>;
    }

    for (const [key, macro] of Object.entries(childFramework.macros)) {
      if (this.macros[key] && !Object.is(this.macros[key], macro)) {
        console.warn(
          `Warning: Macro '${key}' already exists in parent framework and is being overwritten.`,
        );
      }
      this.macros[key] = macro;
    }

    for (const route of childFramework.routes) {
      if (route.path === "/" && prefix !== "") {
        this.routes.push({
          ...route,
          path: prefix,
        });
      } else {
        this.routes.push({
          ...route,
          path: prefix + route.path,
        });
      }
    }

    for (const staticRoute of childFramework.staticRoutes) {
      if (staticRoute.path === "/" && prefix !== "") {
        this.staticRoutes.push({
          path: prefix,
          response: staticRoute.response,
        });
      } else {
        this.staticRoutes.push({
          path: prefix + staticRoute.path,
          response: staticRoute.response,
        });
      }
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

  ws<Path extends string, Params extends ValidationSchema = ValidationSchema>(
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
        params: Params extends ValidationSchema ? ValidationSchema : {};
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

      bunRoutes[routePath][route.method] = async (req: Request) => {
        try {
          let modifiedReq = req;
          for (const handler of self.onRequestHandlers) {
            const reqResult = handler(modifiedReq);
            modifiedReq = reqResult instanceof Promise ? await reqResult : reqResult;
          }

          const url = new URL(req.url);
          const queryParams = Object.fromEntries(url.searchParams.entries());

          const rawParams = matchRoute(url.pathname, routePath);
          if (!rawParams) {
            return new Response("Invalid route parameters", { status: 400 });
          }

          let paramsValidationResult;
          if (route.schema.params?.["~standard"]?.validate) {
            paramsValidationResult = await route.schema.params["~standard"].validate(rawParams);
            if ("issues" in paramsValidationResult) {
              return new Response(
                "Invalid params: " + JSON.stringify(paramsValidationResult.issues),
                { status: 400 },
              );
            }
          } else {
            paramsValidationResult = { value: rawParams };
          }

          let queryValidationResult;
          if (route.schema.query?.["~standard"]?.validate) {
            queryValidationResult = await route.schema.query["~standard"].validate(queryParams);
            if ("issues" in queryValidationResult) {
              return new Response(
                "Invalid query parameters: " + JSON.stringify(queryValidationResult.issues),
                { status: 400 },
              );
            }
          } else {
            queryValidationResult = { value: queryParams };
          }

          const rawHeaders: Record<string, string | null> = {};
          for (const [key, value] of modifiedReq.headers.entries()) {
            rawHeaders[key.toLowerCase()] = value;
          }

          let headersValidationResult;
          if (route.schema.headers?.["~standard"]?.validate) {
            headersValidationResult = await route.schema.headers["~standard"].validate(rawHeaders);
            if ("issues" in headersValidationResult) {
              return new Response(
                "Invalid headers: " + JSON.stringify(headersValidationResult.issues),
                { status: 400 },
              );
            }
          } else {
            headersValidationResult = { value: rawHeaders };
          }

          let body = undefined;
          let bodyValidationResult: StandardSchemaV1.Result<any> = { value: undefined };

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

              if (route.schema.body?.["~standard"]?.validate) {
                bodyValidationResult = await route.schema.body["~standard"].validate(body);
                if ("issues" in bodyValidationResult) {
                  return new Response(
                    "Invalid body: " + JSON.stringify(bodyValidationResult.issues),
                    { status: 400 },
                  );
                }
                body = bodyValidationResult.value;
              }
            } catch (e) {
              if (route.schema.body) {
                return new Response("Invalid body format", { status: 400 });
              }
            }
          }

          let ctx = {
            req: modifiedReq,
            params: "value" in paramsValidationResult ? paramsValidationResult.value : {},
            query: "value" in queryValidationResult ? queryValidationResult.value : {},
            headers:
              "value" in headersValidationResult ? headersValidationResult.value : rawHeaders,
            body: "value" in bodyValidationResult ? bodyValidationResult.value : body,
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

    const serve = globalThis.Bun?.serve;

    if (!serve) {
      throw new Error(
        "Listen only works in Bun runtime, please use @hedystia/adapter to work with other environments",
      );
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
        if (self.genericHandlers.length > 0) {
          return self.processGenericHandlers(req, self.genericHandlers, 0);
        }
        return new Response("Not found", { status: 404 });
      },
      ...wsConfig,
    });

    return this;
  }

  private async processGenericHandlers(
    req: Request,
    handlers: GenericRequestHandler[],
    index: number,
  ): Promise<Response> {
    if (index >= handlers.length) {
      return new Response("Not found", { status: 404 });
    }
    try {
      const handler = handlers[index];
      if (!handler) {
        return new Response("Not found", { status: 404 });
      }
      const responseResult = handler(req);
      const response = responseResult instanceof Promise ? await responseResult : responseResult;
      if (response instanceof Response) {
        return response;
      }
      return this.processGenericHandlers(req, handlers, index + 1);
    } catch (error) {
      console.error(`Error in generic handler: ${error}`);
      return this.processGenericHandlers(req, handlers, index + 1);
    }
  }

  private createWrappedHandler(
    handler: (ctx: any) => Response | Promise<Response> | any,
    schema: Record<string, any>,
  ): RequestHandler {
    const macros = Object.entries(schema)
      .filter(
        ([key]) =>
          !["params", "query", "body", "headers", "response", "description", "tags"].includes(
            key,
          ) && schema[key] === true,
      )
      .map(([key]) => ({ key, macro: this.macros[key] }));

    return async function (ctx: any): Promise<Response> {
      if (macros.length > 0) {
        for (const { key, macro } of macros) {
          try {
            const macroResult = macro?.resolve(ctx);
            ctx[key] = macroResult instanceof Promise ? await macroResult : macroResult;
          } catch (err: any) {
            if (err.isMacroError) {
              return new Response(err.message, { status: err.statusCode });
            }
            throw err;
          }
        }
      }

      const result = handler(ctx);
      const finalResult = result instanceof Promise ? await result : result;
      return finalResult instanceof Response ? finalResult : Hedystia.createResponse(finalResult);
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

async function parseRequestBody(req: Request): Promise<any> {
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
