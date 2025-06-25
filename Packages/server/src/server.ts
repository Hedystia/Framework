import {
  AnySchemaType,
  ArraySchema,
  BaseSchema,
  BooleanSchemaType,
  EnumSchema,
  LiteralSchema,
  NullSchemaType,
  NumberSchemaType,
  ObjectSchemaType,
  OptionalSchema,
  StringSchemaType,
  UnionSchema,
} from "@hedystia/validations";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { writeFile } from "fs/promises";
import type { RouteDefinition } from "./types/routes";

type ValidationSchema = StandardSchemaV1<any, any>;

type InferOutput<T extends ValidationSchema> = StandardSchemaV1.InferOutput<T>;

export type RouteSchema = {
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
        headers: T[K]["headers"];
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

export type WebSocketHandler = {
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

export interface ServerWebSocket {
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

type SubscriptionContext<T extends RouteSchema = {}> = ContextTypes<T> & { ws: ServerWebSocket };
export type SubscriptionHandler = (ctx: SubscriptionContext) => any | Promise<any>;

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
  private prefix = "";
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

  private subscriptionHandlers: Map<string, { handler: SubscriptionHandler; schema: RouteSchema }> =
    new Map();
  private wsRoutes: Map<string, WebSocketHandler & WebSocketOptions> = new Map();

  constructor(options?: FrameworkOptions) {
    this.reusePort = options?.reusePort ?? false;
  }

  /**
   * Register a macro configuration to extend request context
   * @param {T} config - Macro configuration object
   * @returns {Hedystia<Routes, Macros & { [K in keyof T]: ReturnType<ReturnType<T[K]>["resolve"]> }>} Instance with extended macros
   */
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

  /**
   * Group routes with a common prefix
   * @param {Prefix} prefix - Path prefix for the group
   * @param {(app: Hedystia<[]>)} callback - Function defining group routes
   * @returns {Hedystia<[...Routes, ...PrefixRoutes<Prefix, GroupRoutes>]>} Instance with grouped routes
   */
  group<Prefix extends string, GroupRoutes extends RouteDefinition[]>(
    prefix: Prefix,
    callback: (app: Hedystia<[]>) => Hedystia<GroupRoutes>,
  ): Hedystia<[...Routes, ...PrefixRoutes<Prefix, GroupRoutes>]> {
    const groupApp = new Hedystia();
    groupApp.prefix = "";

    const configuredApp = callback(groupApp);
    const fullPrefix = this.prefix + prefix;

    for (const route of configuredApp.routes) {
      if (route.path === "/") {
        this.routes.push({
          ...route,
          path: fullPrefix,
        });
      } else {
        this.routes.push({
          ...route,
          path: fullPrefix + route.path,
        });
      }
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

  /**
   * Register a handler for the 'request' lifecycle event
   * @param {OnRequestHandler} handler - Function to handle request event
   * @returns {this} Current instance
   */
  onRequest(handler: OnRequestHandler): this {
    this.onRequestHandlers.push(handler);
    return this;
  }

  /**
   * Register a handler for the 'parse' lifecycle event
   * @param {OnParseHandler} handler - Function to handle parse event
   * @returns {this} Current instance
   */
  onParse(handler: OnParseHandler): this {
    this.onParseHandlers.push(handler);
    return this;
  }

  /**
   * Register a handler for the 'transform' lifecycle event
   * @param {OnTransformHandler<T>} handler - Function to handle transform event
   * @returns {this} Current instance
   */
  onTransform<T extends RouteSchema = {}>(handler: OnTransformHandler<T>): this {
    this.onTransformHandlers.push(handler as OnTransformHandler);
    return this;
  }

  /**
   * Register a handler for the 'beforeHandle' lifecycle event
   * @param {OnBeforeHandleHandler<T>} handler - Function to handle beforeHandle event
   * @returns {this} Current instance
   */
  onBeforeHandle<T extends RouteSchema = {}>(handler: OnBeforeHandleHandler<T>): this {
    this.onBeforeHandleHandlers.push(handler as OnBeforeHandleHandler);
    return this;
  }

  /**
   * Register a handler for the 'afterHandle' lifecycle event
   * @param {OnAfterHandleHandler<T>} handler - Function to handle afterHandle event
   * @returns {this} Current instance
   */
  onAfterHandle<T extends RouteSchema = {}>(handler: OnAfterHandleHandler<T>): this {
    this.onAfterHandleHandlers.push(handler as OnAfterHandleHandler);
    return this;
  }

  /**
   * Register a handler for the 'mapResponse' lifecycle event
   * @param {OnMapResponseHandler<T>} handler - Function to handle mapResponse event
   * @returns {this} Current instance
   */
  onMapResponse<T extends RouteSchema = {}>(handler: OnMapResponseHandler<T>): this {
    this.onMapResponseHandlers.push(handler as OnMapResponseHandler);
    return this;
  }

  /**
   * Register a handler for the 'error' lifecycle event
   * @param {OnErrorHandler<T>} handler - Function to handle error event
   * @returns {this} Current instance
   */
  onError<T extends RouteSchema = {}>(handler: OnErrorHandler<T>): this {
    this.onErrorHandlers.push(handler as OnErrorHandler);
    return this;
  }

  /**
   * Register a handler for the 'afterResponse' lifecycle event
   * @param {OnAfterResponseHandler<T>} handler - Function to handle afterResponse event
   * @returns {this} Current instance
   */
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

  /**
   * Register a subscription handler for a WebSocket topic.
   * @param {Path} path - The subscription topic path, can include parameters like /users/:id
   * @param {(ctx: SubscriptionContext)} handler - Function to handle the subscription. Can return initial data.
   * @param {Object} schema - Validation schemas for params, query, and headers.
   * @returns {this} Current instance
   */
  subscription<
    Path extends string,
    Params extends ValidationSchema,
    Query extends ValidationSchema,
    Headers extends ValidationSchema,
    Handler extends (
      ctx: SubscriptionContext<{ params: Params; query: Query; headers: Headers }>,
    ) => any,
  >(
    path: Path,
    handler: Handler,
    schema: {
      params?: Params;
      query?: Query;
      headers?: Headers;
    } = {},
  ): Hedystia<
    [
      ...Routes,
      {
        method: "SUB";
        path: Path;
        params: Params extends ValidationSchema ? InferOutput<Params> : {};
        query: Query extends ValidationSchema ? InferOutput<Query> : {};
        headers: Headers extends ValidationSchema ? InferOutput<Headers> : {};
        response: Awaited<ReturnType<Handler>>;
      },
    ],
    Macros
  > {
    const fullPath = this.prefix + path;
    this.subscriptionHandlers.set(fullPath, { handler: handler as SubscriptionHandler, schema });
    return this as any;
  }

  /**
   * Publish a message to a WebSocket topic.
   * @param {string} topic - The topic to publish to.
   * @param {any} data - The data to send.
   * @param {boolean} [compress] - Whether to compress the message.
   * @returns {void}
   */
  publish(topic: string, data: any, compress?: boolean): void {
    if (!this.server) {
      console.warn("Server is not running. Cannot publish message.");
      return;
    }
    this.server.publish(topic, JSON.stringify({ path: topic, data }), compress);
  }

  /**
   * Register a GET route handler
   * @param {Path} path - Route path
   * @param {(ctx: InferRouteContext)} handler - Request handler function
   * @param {Object} schema - Validation schemas configuration
   * @param {Params} [schema.params] - Path parameters schema
   * @param {Query} [schema.query] - Query parameters schema
   * @param {Headers} [schema.headers] - Headers schema
   * @param {ResponseSchema} [schema.response] - Response schema
   * @param {string} [schema.description] - Route description
   * @param {string[]} [schema.tags] - Route tags
   * @returns {Hedystia<[...Routes, ...], Macros>} Instance with new route
   */
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
      : async (ctx: any) => {
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

  /**
   * Register a PATCH route handler
   * @param {Path} path - Route path
   * @param {(ctx: InferRouteContext)} handler - Request handler function
   * @param {Object} schema - Validation schemas configuration
   * @param {Params} [schema.params] - Path parameters schema
   * @param {Query} [schema.query] - Query parameters schema
   * @param {Body} [schema.body] - Body schema
   * @param {Headers} [schema.headers] - Headers schema
   * @param {ResponseSchema} [schema.response] - Response schema
   * @param {string} [schema.description] - Route description
   * @param {string[]} [schema.tags] - Route tags
   * @returns {Hedystia<[...Routes, ...], Macros>} Instance with new route
   */
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
      : async (ctx: any) => {
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

  /**
   * Register a POST route handler
   * @param {Path} path - Route path
   * @param {(ctx: InferRouteContext)} handler - Request handler function
   * @param {Object} schema - Validation schemas configuration
   * @param {Params} [schema.params] - Path parameters schema
   * @param {Query} [schema.query] - Query parameters schema
   * @param {Body} [schema.body] - Body schema
   * @param {Headers} [schema.headers] - Headers schema
   * @param {ResponseSchema} [schema.response] - Response schema
   * @param {string} [schema.description] - Route description
   * @param {string[]} [schema.tags] - Route tags
   * @returns {Hedystia<[...Routes, ...], Macros>} Instance with new route
   */
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
      : async (ctx: any) => {
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

  /**
   * Register a PUT route handler
   * @param {Path} path - Route path
   * @param {(ctx: InferRouteContext)} handler - Request handler function
   * @param {Object} schema - Validation schemas configuration
   * @param {Params} [schema.params] - Path parameters schema
   * @param {Query} [schema.query] - Query parameters schema
   * @param {Body} [schema.body] - Body schema
   * @param {Headers} [schema.headers] - Headers schema
   * @param {ResponseSchema} [schema.response] - Response schema
   * @param {string} [schema.description] - Route description
   * @param {string[]} [schema.tags] - Route tags
   * @returns {Hedystia<[...Routes, ...], Macros>} Instance with new route
   */
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
      : async (ctx: any) => {
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

  /**
   * Register a DELETE route handler
   * @param {Path} path - Route path
   * @param {(ctx: InferRouteContext)} handler - Request handler function
   * @param {Object} schema - Validation schemas configuration
   * @param {Params} [schema.params] - Path parameters schema
   * @param {Query} [schema.query] - Query parameters schema
   * @param {Body} [schema.body] - Body schema
   * @param {Headers} [schema.headers] - Headers schema
   * @param {ResponseSchema} [schema.response] - Response schema
   * @param {string} [schema.description] - Route description
   * @param {string[]} [schema.tags] - Route tags
   * @returns {Hedystia<[...Routes, ...], Macros>} Instance with new route
   */
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
      : async (ctx: any) => {
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

  /**
   * Register a static route handler
   * @param {Path} path - Route path
   * @param {Response | Object} response - Static response configuration
   * @param {Object} schema - Response validation schema
   * @param {ResponseSchema} [schema.response] - Response schema
   * @returns {Hedystia<[...Routes, ...], Macros>} Instance with static route
   */
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

  /**
   * Register a generic request handler
   * @param {GenericRequestHandler} handler - Fallback request handler
   * @returns {this} Current instance
   */
  handle(handler: GenericRequestHandler): this {
    this.genericHandlers.push(handler);
    return this;
  }

  /**
   * Mount child framework instance
   * @param {Hedystia<ChildRoutes, ChildMacros>} childFramework - Child framework instance
   * @returns {Hedystia<[...Routes, ...ChildRoutes], Macros & ChildMacros>} Combined instance
   */
  use<ChildRoutes extends RouteDefinition[], ChildMacros extends MacroData = {}>(
    childFramework: Hedystia<ChildRoutes, ChildMacros>,
  ): Hedystia<[...Routes, ...ChildRoutes], Macros & ChildMacros>;
  /**
   * Mount child framework instance with prefix
   * @param {Prefix} prefix - Path prefix
   * @param {Hedystia<ChildRoutes, ChildMacros>} childFramework - Child framework instance
   * @returns {Hedystia<[...Routes, ...], Macros & ChildMacros>} Combined instance
   */
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

    const fullPrefix = this.prefix + prefix;

    for (const route of childFramework.routes) {
      if (route.path === "/") {
        this.routes.push({
          ...route,
          path: fullPrefix,
        });
      } else {
        this.routes.push({
          ...route,
          path: fullPrefix + route.path,
        });
      }
    }

    for (const staticRoute of childFramework.staticRoutes) {
      if (staticRoute.path === "/" && prefix !== "") {
        this.staticRoutes.push({
          path: fullPrefix,
          response: staticRoute.response,
        });
      } else {
        this.staticRoutes.push({
          path: fullPrefix + staticRoute.path,
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

  /**
   * Register WebSocket handler
   * @param {Path} path - WebSocket path
   * @param {WebSocketHandler} handler - WebSocket event handlers
   * @param {WebSocketOptions & { params?: Params }} [options] - WebSocket configuration
   * @returns {Hedystia<[...Routes, ...], Macros>} Instance with WebSocket route
   */
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

  /**
   * Generates a type definition file (.d.ts) for all registered routes.
   * @param {string} filePath - The path to the file where the types will be saved (e.g., "./server.d.ts").
   * @returns {this} The current instance of the framework for chaining.
   */
  async buildTypes(filePath: string): Promise<this> {
    const typesContent = this.generateTypesString();
    await writeFile(filePath, typesContent, "utf8");
    return this;
  }

  /**
   * Get all registered routes in the current application
   * @returns {Routes} The list of all route definitions
   */
  get allRoutes(): Routes {
    return this.routes as unknown as Routes;
  }

  /**
   * Start HTTP server
   * @param {number} port - Server port number
   * @returns {this} Current instance
   * @throws {Error} If not running in Bun runtime
   */
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
                `Invalid params: ${JSON.stringify(paramsValidationResult.issues)}`,
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
                `Invalid query parameters: ${JSON.stringify(queryValidationResult.issues)}`,
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
                `Invalid headers: ${JSON.stringify(headersValidationResult.issues)}`,
                { status: 400 },
              );
            }
          } else {
            headersValidationResult = { value: rawHeaders };
          }

          let body;
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
                    `Invalid body: ${JSON.stringify(bodyValidationResult.issues)}`,
                    { status: 400 },
                  );
                }
                body = bodyValidationResult.value;
              }
            } catch {
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
            const processResult: Response | null = null;

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
              if (result) {
                return result;
              }
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
    if (this.wsRoutes.size > 0 || this.subscriptionHandlers.size > 0) {
      wsConfig.websocket = {
        message: async (ws: ServerWebSocket, message: string | ArrayBuffer | Uint8Array) => {
          const standardWsHandler = this.wsRoutes.get(ws.data?.__wsPath);
          if (standardWsHandler?.message) {
            standardWsHandler.message(ws, message);
          }

          let subMessage;
          try {
            subMessage = JSON.parse(message.toString());
          } catch {
            return;
          }

          const { type, path, headers, query, body, subscriptionId } = subMessage;
          if (!type || !path) {
            return;
          }

          let matchedSub: { handler: SubscriptionHandler; schema: RouteSchema } | undefined;
          let rawParams: Record<string, string> | null = null;

          for (const [routePath, handlerData] of self.subscriptionHandlers.entries()) {
            const params = matchRoute(path, routePath);
            if (params) {
              matchedSub = handlerData;
              rawParams = params;
              break;
            }
          }

          if (!matchedSub) {
            return;
          }

          const topic = path;

          if (type === "subscribe") {
            let validatedParams = rawParams || {};
            if (matchedSub.schema.params && rawParams) {
              const result = await matchedSub.schema.params["~standard"].validate(rawParams);
              if ("issues" in result) {
                console.error("Validation error (params):", result.issues);
                return;
              }
              validatedParams = result.value;
            }

            let validatedQuery = query || {};
            if (matchedSub.schema.query && query) {
              const result = await matchedSub.schema.query["~standard"].validate(query);
              if ("issues" in result) {
                console.error("Validation error (query):", result.issues);
                return;
              }
              validatedQuery = result.value;
            }

            let validatedHeaders = headers || {};
            if (matchedSub.schema.headers && headers) {
              const result = await matchedSub.schema.headers["~standard"].validate(headers);
              if ("issues" in result) {
                console.error("Validation error (headers):", result.issues);
                return;
              }
              validatedHeaders = result.value;
            }

            ws.subscribe(topic);
            ws.data.subscribedTopics?.add(topic);

            const ctx: SubscriptionContext<any> = {
              ws,
              req: ws.data.request,
              params: validatedParams,
              query: validatedQuery,
              headers: validatedHeaders,
              body: body,
              route: path,
              method: "SUB",
            };

            const result = await matchedSub.handler(ctx);
            if (result !== undefined) {
              ws.send(JSON.stringify({ path: topic, data: result, subscriptionId }));
            }
          } else if (type === "unsubscribe") {
            ws.unsubscribe(topic);
            ws.data.subscribedTopics?.delete(topic);
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
        if (options.maxPayloadLength) {
          wsConfig.websocket.maxPayloadLength = options.maxPayloadLength;
        }
        if (options.idleTimeout) {
          wsConfig.websocket.idleTimeout = options.idleTimeout;
        }
        if (options.backpressureLimit) {
          wsConfig.websocket.backpressureLimit = options.backpressureLimit;
        }
        if (options.closeOnBackpressureLimit) {
          wsConfig.websocket.closeOnBackpressureLimit = options.closeOnBackpressureLimit;
        }
        if (options.sendPings !== undefined) {
          wsConfig.websocket.sendPings = options.sendPings;
        }
        if (options.publishToSelf !== undefined) {
          wsConfig.websocket.publishToSelf = options.publishToSelf;
        }
        if (options.perMessageDeflate !== undefined) {
          wsConfig.websocket.perMessageDeflate = options.perMessageDeflate;
        }
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

        if (req.headers.get("upgrade")?.toLowerCase() === "websocket") {
          const wsRoute = self.wsRoutes.get(path);
          if (wsRoute) {
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
            if (upgraded) {
              return new Response(null, { status: 101 });
            }
            return new Response("WebSocket upgrade failed", { status: 400 });
          }
          if (self.subscriptionHandlers.size > 0) {
            const upgraded = server.upgrade(req, {
              data: {
                request: req,
                subscribedTopics: new Set(),
              },
            });
            if (upgraded) {
              return new Response(null, { status: 101 });
            }
          }
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

    return async (ctx: any): Promise<Response> => {
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

  private schemaToTypeString(schema: any): string {
    if (
      !schema ||
      (typeof schema === "object" && !schema.constructor.name) ||
      (typeof schema === "object" &&
        Object.keys(schema).length === 0 &&
        !(schema instanceof BaseSchema))
    ) {
      return "any";
    }

    if (schema && typeof schema === "object" && schema.def) {
      const def = schema.def;

      if (def.type === "literal" && Array.isArray(def.values) && def.values.length > 0) {
        const val = def.values[0];
        return typeof val === "string" ? `'${val}'` : String(val);
      }

      if (def.const !== undefined) {
        const val = def.const;
        return typeof val === "string" ? `'${val}'` : String(val);
      }

      if (typeof def.type === "string") {
        switch (def.type) {
          case "object": {
            const shape = def.shape;
            if (!shape || Object.keys(shape).length === 0) {
              return "{}";
            }
            const validIdentifierRegex = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
            const properties = Object.entries(shape)
              .map(([key, value]: [string, any]) => {
                const finalKey = validIdentifierRegex.test(key) ? key : `"${key}"`;
                const isOptional =
                  value.def && (value.def.type === "optional" || value.def.type === "default");
                const optionalMarker = isOptional ? "?" : "";
                return `${finalKey}${optionalMarker}:${this.schemaToTypeString(value)}`;
              })
              .join(";");
            return `{${properties}}`;
          }
          case "string":
            return "string";
          case "number":
            return "number";
          case "boolean":
            return "boolean";
          case "null":
            return "null";
          case "any":
            return "any";
          case "unknown":
            return "unknown";
          case "optional":
          case "default":
            return this.schemaToTypeString(def.innerType);
          case "array":
            if (def.items) {
              return `(${this.schemaToTypeString(def.items)})[]`;
            }
            if (def.type) {
              return `(${this.schemaToTypeString(def.type)})[]`;
            }
            return "any[]";
          case "union":
            return def.options.map((s: any) => this.schemaToTypeString(s)).join("|");
          case "enum":
            return def.values.map((v: any) => (typeof v === "string" ? `'${v}'` : v)).join("|");
          default:
            return "any";
        }
      }
    }

    if (schema instanceof OptionalSchema) {
      return `${this.schemaToTypeString((schema as any).innerSchema)}|undefined`;
    }
    if (schema instanceof ArraySchema) {
      return `(${this.schemaToTypeString((schema as any).innerSchema)})[]`;
    }
    if (schema instanceof UnionSchema) {
      return (schema as any).schemas.map((s: any) => this.schemaToTypeString(s)).join("|");
    }
    if (schema instanceof EnumSchema) {
      return (schema as any).values
        .map((v: any) => (typeof v === "string" ? `'${v}'` : v))
        .join("|");
    }
    if (schema instanceof LiteralSchema) {
      const val = (schema as any).value;
      return typeof val === "string" ? `'${val}'` : String(val);
    }
    if (schema instanceof ObjectSchemaType) {
      const definition = (schema as any).definition;
      if (!definition || Object.keys(definition).length === 0) {
        return "{}";
      }
      const validIdentifierRegex = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
      const properties = Object.entries(definition)
        .map(([key, value]) => {
          const finalKey = validIdentifierRegex.test(key) ? key : `"${key}"`;
          const isOptional = value instanceof OptionalSchema;
          const optionalMarker = isOptional ? "?" : "";
          return `${finalKey}${optionalMarker}:${this.schemaToTypeString(value)}`;
        })
        .join(";");
      return `{${properties}}`;
    }
    if (schema instanceof StringSchemaType) {
      return "string";
    }
    if (schema instanceof NumberSchemaType) {
      return "number";
    }
    if (schema instanceof BooleanSchemaType) {
      return "boolean";
    }
    if (schema instanceof NullSchemaType) {
      return "null";
    }
    if (schema instanceof AnySchemaType) {
      return "any";
    }

    return "any";
  }

  private generateTypesString(): string {
    const routeTypes = this.routes
      .map((route) => {
        const responseType = this.schemaToTypeString(route.schema.response);
        const paramsType = this.schemaToTypeString(route.schema.params);
        const queryType = this.schemaToTypeString(route.schema.query);
        const bodyType = this.schemaToTypeString(route.schema.body);
        const headersType = this.schemaToTypeString(route.schema.headers);
        return `{method:"${route.method}";path:"${route.path}";params:${paramsType};query:${queryType};body:${bodyType};headers:${headersType};response:${responseType}}`;
      })
      .join(",");
    return `// Automatic Hedystia type generation\nexport type AppRoutes=[${routeTypes}];`;
  }

  private determineContentType(body: any): string {
    if (typeof body === "string") {
      return "text/plain";
    }
    if (body instanceof Uint8Array || body instanceof ArrayBuffer) {
      return "application/octet-stream";
    }
    if (body instanceof Blob) {
      return body.type || "application/octet-stream";
    }
    if (body instanceof FormData) {
      return "multipart/form-data";
    }
    return "application/json";
  }

  /**
   * Stop HTTP server
   * @returns {void}
   */
  close(): void {
    if (this.server) {
      this.server.stop();
      this.server = null;
    }
  }

  /**
   * Throw error with status code and message
   * @param {number} statusCode - Error status code
   * @param {string} message - Error message
   * @returns {never} Never type
   */
  error(statusCode: number, message: string): never {
    throw { statusCode, message };
  }
}

function matchRoute(pathname: string, routePath: string): Record<string, string> | null {
  const pathParts = pathname.split("/").filter(Boolean);
  const routeParts = routePath.split("/").filter(Boolean);

  if (pathParts.length !== routeParts.length) {
    return null;
  }

  const params: Record<string, string> = {};
  for (let i = 0; i < routeParts.length; i++) {
    const routePart = routeParts[i];
    const pathPart = pathParts[i];
    if (!routePart) {
      return null;
    }
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
  if (contentType.includes("application/json")) {
    return req.json();
  }
  if (contentType.includes("multipart/form-data")) {
    return req.formData();
  }
  if (contentType.includes("text/")) {
    return req.text();
  }
  try {
    return await req.json();
  } catch {
    return req.text();
  }
}
