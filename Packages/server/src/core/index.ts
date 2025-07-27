import createWrappedHandler from "../handlers/wrapped";
import { Hedystia } from "../server";
import type {
  ContextTypes,
  CorsOptions,
  GenericRequestHandler,
  InferOutput,
  InferRouteContext,
  MacroData,
  MacroErrorFunction,
  MacroResolveFunction,
  PrefixRoutes,
  RequestHandler,
  RouteSchema,
  SubscriptionContext,
  SubscriptionHandler,
  ValidationSchema,
  WebSocketHandler,
  WebSocketOptions,
} from "../types";
import type { RouteDefinition } from "../types/routes";
import { determineContentType } from "../utils";

type NextFunction = () => Promise<Response>;

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

export default class Core<Routes extends RouteDefinition[] = [], Macros extends MacroData = {}> {
  protected onRequestHandlers: OnRequestHandler[] = [];
  protected onParseHandlers: OnParseHandler[] = [];
  protected onTransformHandlers: OnTransformHandler[] = [];
  protected onBeforeHandleHandlers: OnBeforeHandleHandler[] = [];
  protected onAfterHandleHandlers: OnAfterHandleHandler[] = [];
  protected onMapResponseHandlers: OnMapResponseHandler[] = [];
  protected onErrorHandlers: OnErrorHandler[] = [];
  protected onAfterResponseHandlers: OnAfterResponseHandler[] = [];

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

  public macros: Record<string, { resolve: MacroResolveFunction<any> }> = {};

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

  public routes: {
    method: "GET" | "PATCH" | "POST" | "PUT" | "DELETE";
    path: string;
    schema: RouteSchema;
    handler: RequestHandler;
  }[] = [];
  public cors: CorsOptions | undefined = undefined;
  public prefix = "";

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
    const groupApp = new Hedystia({ cors: this.cors });
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

    for (const [path, handlerData] of configuredApp.subscriptionHandlers.entries()) {
      if (path === "/" && fullPrefix !== "") {
        this.subscriptionHandlers.set(fullPrefix, handlerData);
      } else {
        this.subscriptionHandlers.set(fullPrefix + path, handlerData);
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

  public subscriptionHandlers: Map<string, { handler: SubscriptionHandler; schema: RouteSchema }> =
    new Map();
  public server: any = null;

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
    DataSchema extends ValidationSchema,
    ErrorSchema extends ValidationSchema,
    Handler extends (
      ctx: SubscriptionContext<{
        params: Params;
        query: Query;
        headers: Headers;
        data: DataSchema;
        error: ErrorSchema;
      }>,
    ) => any,
  >(
    path: Path,
    handler: Handler,
    schema: {
      params?: Params;
      query?: Query;
      headers?: Headers;
      data?: DataSchema;
      error?: ErrorSchema;
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
        data: DataSchema extends ValidationSchema ? InferOutput<DataSchema> : any;
        error: ErrorSchema extends ValidationSchema ? InferOutput<ErrorSchema> : undefined;
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

  public staticRoutes: { path: string; response: Response }[] = [];

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
    ErrorSchema extends ValidationSchema,
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
      error?: ErrorSchema;
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
        error: ErrorSchema extends ValidationSchema ? InferOutput<ErrorSchema> : undefined;
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
      ? createWrappedHandler(handler, schema, this.macros)
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
      ? createWrappedHandler(handler, schema, this.macros)
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
      ? createWrappedHandler(handler, schema, this.macros)
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
      ? createWrappedHandler(handler, schema, this.macros)
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
      ? createWrappedHandler(handler, schema, this.macros)
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
            "Content-Type": contentType || determineContentType(body),
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

  public genericHandlers: GenericRequestHandler[] = [];

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

    if (this.cors && !childFramework.cors) {
      childFramework.cors = this.cors;
    } else if (!this.cors && childFramework.cors) {
      this.cors = childFramework.cors;
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

    for (const [path, handlerData] of childFramework.subscriptionHandlers.entries()) {
      if (path === "/" && prefix !== "") {
        this.subscriptionHandlers.set(fullPrefix, handlerData);
      } else {
        this.subscriptionHandlers.set(fullPrefix + path, handlerData);
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

  public wsRoutes: Map<string, WebSocketHandler & WebSocketOptions> = new Map();

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
}
