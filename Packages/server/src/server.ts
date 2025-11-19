import type { HeadersInit } from "bun";
import { writeFile } from "fs/promises";
import Core from "./core";
import generateCorsHeaders from "./handlers/cors";
import processGenericHandlers from "./handlers/generic";
import type {
  CookieOptions,
  CorsOptions,
  MacroData,
  ResponseContext,
  RouteSchema,
  ServerWebSocket,
  SubscriptionContext,
  SubscriptionHandler,
} from "./types";
import type { RouteDefinition } from "./types/routes";
import { matchRoute, parseRequestBody, schemaToTypeString } from "./utils";

interface FrameworkOptions {
  reusePort?: boolean;
  cors?: CorsOptions;
  idleTimeout?: number;
}

export class Hedystia<
  Routes extends RouteDefinition[] = [],
  _Macros extends MacroData = {},
> extends Core<Routes, _Macros> {
  private reusePort: boolean;
  private idleTimeout: number;
  private routeCache: Map<string, (typeof this.routes)[0] | null> = new Map();

  constructor(options?: FrameworkOptions) {
    super();
    this.reusePort = options?.reusePort ?? false;
    this.cors = options?.cors ?? undefined;
    this.idleTimeout = options?.idleTimeout ?? 10;
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

  public async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    if (this.cors && method === "OPTIONS") {
      const corsHeaders = await generateCorsHeaders(this.cors, req);
      return new Response(null, {
        status: 204,
        headers: corsHeaders as HeadersInit,
      });
    }

    const staticRoute = this.staticRoutesMap.get(path);
    if (staticRoute) {
      return staticRoute;
    }

    const route = this.findRoute(method, path);

    if (!route) {
      if (this.genericHandlers.length > 0) {
        return processGenericHandlers(req, this.genericHandlers, 0);
      }
      return new Response("Not Found", { status: 404 });
    }

    try {
      let modifiedReq = req;
      const onRequestLen = this.onRequestHandlers.length;
      for (let i = 0; i < onRequestLen; i++) {
        const handler = this.onRequestHandlers[i];
        if (handler) {
          const reqResult = handler(modifiedReq);
          modifiedReq = reqResult instanceof Promise ? await reqResult : reqResult;
        }
      }

      const rawParams = matchRoute(path, route.path);
      if (!rawParams) {
        return new Response("Invalid route parameters", { status: 400 });
      }

      const queryParams = Object.fromEntries(url.searchParams.entries());

      const rawHeaders: Record<string, string | null> = {};
      modifiedReq.headers.forEach((value, key) => {
        rawHeaders[key.toLowerCase()] = value;
      });

      let params = rawParams;
      const paramsSchema = route.schema.params?.["~standard"];
      if (paramsSchema) {
        const result = await paramsSchema.validate(rawParams);
        if ("issues" in result) {
          return new Response(`Invalid params: ${JSON.stringify(result.issues)}`, { status: 400 });
        }
        params = result.value;
      }

      let query = queryParams;
      const querySchema = route.schema.query?.["~standard"];
      if (querySchema) {
        const result = await querySchema.validate(queryParams);
        if ("issues" in result) {
          return new Response(`Invalid query parameters: ${JSON.stringify(result.issues)}`, {
            status: 400,
          });
        }
        query = result.value;
      }

      let validatedHeaders = rawHeaders;
      const headersSchema = route.schema.headers?.["~standard"];
      if (headersSchema) {
        const result = await headersSchema.validate(rawHeaders);
        if ("issues" in result) {
          return new Response(`Invalid headers: ${JSON.stringify(result.issues)}`, { status: 400 });
        }
        validatedHeaders = result.value;
      }

      let body;
      let rawBody: string | ArrayBuffer | Uint8Array | undefined;
      const hasBody =
        method === "PATCH" || method === "POST" || method === "PUT" || method === "DELETE";

      if (hasBody) {
        const bodySchema = route.schema.body;
        try {
          const clonedRequest = modifiedReq.clone();
          rawBody = await clonedRequest.text();

          let parsedByHandler = false;
          const onParseLen = this.onParseHandlers.length;
          for (let i = 0; i < onParseLen; i++) {
            const handler = this.onParseHandlers[i];
            if (handler) {
              const parsedResult = await handler(modifiedReq);
              if (parsedResult !== undefined) {
                body = parsedResult;
                parsedByHandler = true;
                break;
              }
            }
          }

          if (!parsedByHandler) {
            body = await parseRequestBody(modifiedReq);
          }

          if (body === "") {
            body = undefined;
          }

          if (bodySchema?.["~standard"]) {
            const result = await bodySchema["~standard"].validate(body);
            if ("issues" in result) {
              return new Response(`Invalid body: ${JSON.stringify(result.issues)}`, {
                status: 400,
              });
            }
            body = result.value;
          }
        } catch {
          if (bodySchema) {
            return new Response("Invalid body format", { status: 400 });
          }
        }
      }

      let ctx = {
        req: modifiedReq,
        params,
        query,
        headers: validatedHeaders,
        body,
        rawBody,
        route: route.path,
        method: route.method,
        error: (statusCode: number, message?: string): never => {
          throw { statusCode, message: message || "Error" };
        },
        set: this.createResponseContext(),
      };

      const onTransformLen = this.onTransformHandlers.length;
      for (let i = 0; i < onTransformLen; i++) {
        const handler = this.onTransformHandlers[i];
        if (handler) {
          const transformedCtx = await handler(ctx);
          if (transformedCtx) {
            ctx = transformedCtx;
          }
        }
      }

      try {
        const beforeHandlersLen = this.onBeforeHandleHandlers.length;
        const afterHandlersLen = this.onAfterHandleHandlers.length;
        const mapResponseLen = this.onMapResponseHandlers.length;
        const afterResponseLen = this.onAfterResponseHandlers.length;

        if (beforeHandlersLen === 0) {
          let result = await route.handler(ctx);

          if (!(result instanceof Response)) {
            if (mapResponseLen > 0) {
              for (let i = 0; i < mapResponseLen; i++) {
                const handler = this.onMapResponseHandlers[i];
                if (handler) {
                  const mappedResponse = await handler(result, ctx);
                  if (mappedResponse instanceof Response) {
                    result = mappedResponse;
                    break;
                  }
                }
              }
            }

            if (!(result instanceof Response)) {
              result = Hedystia.createResponse(result);
            }
          }

          result = this.applyResponseContext(result, ctx.set);
          let finalResponse = result;

          if (afterHandlersLen > 0) {
            for (let i = 0; i < afterHandlersLen; i++) {
              const handler = this.onAfterHandleHandlers[i];
              if (handler) {
                const afterResult = await handler(finalResponse, ctx);
                if (afterResult instanceof Response) {
                  finalResponse = afterResult;
                }
              }
            }
          }

          if (afterResponseLen > 0) {
            setTimeout(() => {
              for (let i = 0; i < afterResponseLen; i++) {
                const handler = this.onAfterResponseHandlers[i];
                if (handler) {
                  handler(finalResponse, ctx);
                }
              }
            }, 0);
          }

          if (this.cors) {
            return await this.applyCorsHeaders(finalResponse, req);
          }

          return finalResponse;
        }

        let finalResponse: Response | undefined;
        let mainHandlerExecuted = false;

        const executeMainHandler = async () => {
          mainHandlerExecuted = true;
          let result = await route.handler(ctx);

          if (!(result instanceof Response)) {
            if (mapResponseLen > 0) {
              for (let i = 0; i < mapResponseLen; i++) {
                const handler = this.onMapResponseHandlers[i];
                if (handler) {
                  const mappedResponse = await handler(result, ctx);
                  if (mappedResponse instanceof Response) {
                    result = mappedResponse;
                    break;
                  }
                }
              }
            }

            if (!(result instanceof Response)) {
              result = Hedystia.createResponse(result);
            }
          }

          result = this.applyResponseContext(result, ctx.set);
          finalResponse = result;

          if (afterHandlersLen > 0) {
            for (let i = 0; i < afterHandlersLen; i++) {
              const handler = this.onAfterHandleHandlers[i];
              if (handler) {
                const afterResult = await handler(finalResponse, ctx);
                if (afterResult instanceof Response) {
                  finalResponse = afterResult;
                }
              }
            }
          }

          if (afterResponseLen > 0) {
            setTimeout(() => {
              for (let i = 0; i < afterResponseLen; i++) {
                const handler = this.onAfterResponseHandlers[i];
                if (handler) {
                  handler(finalResponse!, ctx);
                }
              }
            }, 0);
          }

          return finalResponse;
        };

        let i = 0;
        const executeBeforeHandlers = async (): Promise<Response | undefined> => {
          if (i >= beforeHandlersLen) {
            return executeMainHandler();
          }

          const beforeHandler = this.onBeforeHandleHandlers[i++];
          if (!beforeHandler) {
            return executeBeforeHandlers();
          }

          let nextCalled = false;
          const next = async () => {
            nextCalled = true;
            return (await executeBeforeHandlers()) || new Response("");
          };

          const earlyResponse = await beforeHandler(ctx, next);

          if (earlyResponse instanceof Response) {
            return earlyResponse;
          }

          if (nextCalled && finalResponse) {
            return finalResponse;
          }

          return executeBeforeHandlers();
        };

        const response = await executeBeforeHandlers();
        if (response) {
          if (this.cors) {
            return await this.applyCorsHeaders(response, req);
          }
          return response;
        }

        if (!mainHandlerExecuted) {
          const final = await executeMainHandler();
          if (final) {
            if (this.cors) {
              return await this.applyCorsHeaders(final, req);
            }
            return final;
          }
        }

        return new Response("Internal Server Error", { status: 500 });
      } catch (error) {
        const onErrorLen = this.onErrorHandlers.length;
        for (let i = 0; i < onErrorLen; i++) {
          const handler = this.onErrorHandlers[i];
          if (handler) {
            try {
              const errorResponse = await handler(error as Error, ctx);
              if (errorResponse instanceof Response) {
                if (this.cors) {
                  return await this.applyCorsHeaders(errorResponse, req);
                }
                return errorResponse;
              }
            } catch {}
          }
        }

        if (typeof error === "object" && error !== null && "statusCode" in error) {
          const contextError = error as { statusCode: number; message: string };
          const status = contextError.statusCode;
          const ok = status >= 200 && status < 300;

          if (!ok) {
            let errorData;
            const errorSchema = route.schema.error?.["~standard"];

            if (errorSchema) {
              const errorObj = { message: contextError.message, code: contextError.statusCode };
              const errorValidation = await errorSchema.validate(errorObj);
              errorData = "value" in errorValidation ? errorValidation.value : errorObj;
            } else {
              errorData = { message: contextError.message, code: contextError.statusCode };
            }

            const response = new Response(JSON.stringify(errorData), {
              status,
              headers: { "Content-Type": "application/json" },
            });

            if (this.cors) {
              return await this.applyCorsHeaders(response, req);
            }

            return response;
          }
        }

        console.error(`Error processing request: ${error}`);
        return new Response(`Internal Server Error: ${(error as Error).message}`, { status: 500 });
      }
    } catch (error) {
      console.error(`Unhandled server error: ${error}`);
      return new Response("Internal Server Error", { status: 500 });
    }
  }

  private findRoute(method: string, path: string) {
    const cacheKey = `${method}:${path}`;
    const cached = this.routeCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    const routesLen = this.routes.length;
    for (let i = 0; i < routesLen; i++) {
      const route = this.routes[i];
      if (route) {
        if (route.method === method) {
          const match = matchRoute(path, route.path);
          if (match) {
            this.routeCache.set(cacheKey, route);
            return route;
          }
        }
      }
    }

    this.routeCache.set(cacheKey, null);
    return null;
  }

  /**
   * Start HTTP server
   * @param {number} port - Server port number
   * @returns {this} Current instance
   * @throws {Error} If not running in Bun runtime
   */
  listen(port: number): this {
    const serve = globalThis.Bun?.serve;

    if (!serve) {
      throw new Error(
        "Listen only works in Bun runtime, please use @hedystia/adapter to work with other environments",
      );
    }

    const hasWebSocket = this.wsRoutes.size > 0 || this.subscriptionHandlers.size > 0;

    this.server = serve({
      port,
      reusePort: this.reusePort,
      idleTimeout: this.idleTimeout,
      fetch: hasWebSocket
        ? (req, server) => {
            const upgradeHeader = req.headers.get("upgrade");
            if (upgradeHeader?.toLowerCase() === "websocket") {
              const url = new URL(req.url);
              const path = url.pathname;
              const wsRoute = this.wsRoutes.get(path);
              if (wsRoute) {
                const upgraded = server.upgrade(req, { data: { __wsPath: path } });
                if (upgraded) {
                  return new Response(null, { status: 101 });
                }
                return new Response("WebSocket upgrade failed", { status: 400 });
              }
              if (this.subscriptionHandlers.size > 0) {
                const upgraded = server.upgrade(req, {
                  data: { request: req, subscribedTopics: new Set() },
                });
                if (upgraded) {
                  return new Response(null, { status: 101 });
                }
              }
            }
            return this.fetch(req);
          }
        : (req) => this.fetch(req),
      websocket: hasWebSocket ? this.createWebSocketHandlers() : undefined,
    });

    return this;
  }

  private createWebSocketHandlers() {
    return {
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

        for (const [routePath, handlerData] of this.subscriptionHandlers.entries()) {
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
            data: undefined,
            errorData: undefined,
            error: (statusCode: number, message?: string): never => {
              throw { statusCode, message: message || "Error" };
            },
            sendData: (data: any) => {
              ws.send(JSON.stringify({ path: topic, data, subscriptionId }));
            },
            sendError: (error: any) => {
              ws.send(JSON.stringify({ path: topic, error, subscriptionId }));
            },
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
  }

  private generateTypesString(): string {
    const routeTypes = this.routes
      .map((route) => {
        const responseType = schemaToTypeString(route.schema.response);
        const paramsType = schemaToTypeString(route.schema.params);
        const queryType = schemaToTypeString(route.schema.query);
        const bodyType = schemaToTypeString(route.schema.body);
        const headersType = schemaToTypeString(route.schema.headers);
        const dataType = schemaToTypeString(route.schema.data);
        const errorType = schemaToTypeString(route.schema.error);
        return `{method:"${route.method}";path:"${route.path}";params:${paramsType};query:${queryType};body:${bodyType};headers:${headersType};response:${responseType};data:${dataType};error:${errorType}}`;
      })
      .join(",");

    const subscriptionTypes = Array.from(this.subscriptionHandlers.entries())
      .map(([path, { schema }]) => {
        const responseType = schemaToTypeString(schema.response);
        const paramsType = schemaToTypeString(schema.params);
        const queryType = schemaToTypeString(schema.query);
        const bodyType = schemaToTypeString(schema.body);
        const headersType = schemaToTypeString(schema.headers);
        const dataType = schemaToTypeString(schema.data);
        const errorType = schemaToTypeString(schema.error);
        return `{method:"SUB";path:"${path}";params:${paramsType};query:${queryType};body:${bodyType};headers:${headersType};response:${responseType};data:${dataType};error:${errorType}}`;
      })
      .join(",");

    const allTypes = [routeTypes, subscriptionTypes].filter(Boolean).join(",");

    return `// Automatic Hedystia type generation\nexport type AppRoutes=[${allTypes}];`;
  }

  private createResponseContext(): ResponseContext {
    const responseData = {
      statusCode: 200,
      responseHeaders: new Headers(),
      cookies: new Map<string, { value: string; options?: CookieOptions }>(),
      modified: false,
    };

    const headersAPI = {
      set: (key: string, value: string) => {
        responseData.responseHeaders.set(key, value);
        responseData.modified = true;
        return context;
      },
      get: (key: string) => responseData.responseHeaders.get(key),
      delete: (key: string) => {
        responseData.responseHeaders.delete(key);
        responseData.modified = true;
        return context;
      },
      add: (key: string, value: string) => {
        const existing = responseData.responseHeaders.get(key);
        if (existing) {
          responseData.responseHeaders.set(key, `${existing}, ${value}`);
        } else {
          responseData.responseHeaders.set(key, value);
        }
        responseData.modified = true;
        return context;
      },
    };

    const cookiesAPI = {
      get: (name: string) => responseData.cookies.get(name)?.value,
      set: (name: string, value: string, options?: CookieOptions) => {
        responseData.cookies.set(name, { value, options });
        responseData.modified = true;
        return context;
      },
      delete: (name: string, options?: Omit<CookieOptions, "expires">) => {
        responseData.cookies.set(name, {
          value: "",
          options: { ...options, expires: new Date(0) },
        });
        responseData.modified = true;
        return context;
      },
    };

    const context: ResponseContext = {
      status: (code: number) => {
        responseData.statusCode = code;
        responseData.modified = true;
        return context;
      },
      headers: headersAPI,
      cookies: cookiesAPI,
    };

    (context as any).__responseData = responseData;
    return context;
  }

  private async applyCorsHeaders(response: Response, req: Request): Promise<Response> {
    if (!this.cors) {
      return response;
    }

    const corsHeaders = await generateCorsHeaders(this.cors, req);

    if (Object.keys(corsHeaders).length === 0) {
      return response;
    }

    const finalHeaders = new Headers(response.headers);
    for (const key in corsHeaders) {
      finalHeaders.set(key, String(corsHeaders[key]));
    }

    if (corsHeaders["Access-Control-Allow-Origin"] && !finalHeaders.has("Vary")) {
      finalHeaders.append("Vary", "Origin");
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: finalHeaders,
    });
  }

  private applyResponseContext(response: Response, setContext: ResponseContext): Response {
    const responseData = (setContext as any).__responseData;
    if (!responseData?.modified) {
      return response;
    }

    const newHeaders = new Headers(response.headers);

    responseData.responseHeaders.forEach((value: string, key: string) => {
      newHeaders.set(key, value);
    });

    const cookiesSize = responseData.cookies.size;
    if (cookiesSize > 0) {
      responseData.cookies.forEach(
        (cookieData: { value: string; options?: CookieOptions }, name: string) => {
          const { value, options } = cookieData;
          let cookieString = `${name}=${value}`;

          if (options?.path) {
            cookieString += `; Path=${options.path}`;
          }
          if (options?.domain) {
            cookieString += `; Domain=${options.domain}`;
          }
          if (options?.expires) {
            cookieString += `; Expires=${options.expires.toUTCString()}`;
          }
          if (options?.maxAge) {
            cookieString += `; Max-Age=${options.maxAge}`;
          }
          if (options?.httpOnly) {
            cookieString += "; HttpOnly";
          }
          if (options?.secure) {
            cookieString += "; Secure";
          }
          if (options?.sameSite) {
            cookieString += `; SameSite=${options.sameSite}`;
          }

          newHeaders.append("Set-Cookie", cookieString);
        },
      );
    }

    return new Response(response.body, {
      status: responseData.statusCode !== 200 ? responseData.statusCode : response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
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
