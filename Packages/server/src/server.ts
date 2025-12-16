import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { HeadersInit } from "bun";
import { writeFile } from "fs/promises";
import Core from "./core";
import generateCorsHeaders from "./handlers/cors";
import processGenericHandlers from "./handlers/generic";
import { Router } from "./router";
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
import { parseRequestBody, schemaToTypeString } from "./utils";

interface FrameworkOptions {
  reusePort?: boolean;
  cors?: CorsOptions | boolean;
  idleTimeout?: number;
}

export class Hedystia<
  Routes extends RouteDefinition[] = [],
  _Macros extends MacroData = {},
> extends Core<Routes, _Macros> {
  private reusePort: boolean;
  private idleTimeout: number;
  private router = new Router();
  private staticRoutesFast: Map<string, (req: Request) => any> = new Map();
  private isCompiled = false;

  constructor(options?: FrameworkOptions) {
    super();
    this.reusePort = options?.reusePort ?? false;
    this.cors = options?.cors === false ? undefined : options?.cors === true ? {} : options?.cors ?? {};
    this.idleTimeout = options?.idleTimeout ?? 10;
  }

  static createResponse(data: any, contentType?: string): Response {
    if (data instanceof Response) {
      return data;
    }

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

  private composeHandler(route: any) {
    const hasBody = ["PATCH", "POST", "PUT", "DELETE"].includes(route.method);
    const hooks = {
      onRequest: this.onRequestHandlers,
      onTransform: this.onTransformHandlers,
      onBeforeHandle: this.onBeforeHandleHandlers,
      onAfterHandle: this.onAfterHandleHandlers,
      onMapResponse: this.onMapResponseHandlers,
      onAfterResponse: this.onAfterResponseHandlers,
      onError: this.onErrorHandlers,
      onParse: this.onParseHandlers,
    };

    const paramsSchema = route.schema.params?.["~standard"];
    const querySchema = route.schema.query?.["~standard"];
    const headersSchema = route.schema.headers?.["~standard"];
    const bodySchema = route.schema.body;
    const errorSchema = route.schema.error?.["~standard"];

    return async (req: Request, params: Record<string, string>) => {
      let ctx: any;
      try {
        const urlStr = req.url;
        const qIndex = urlStr.indexOf("?");
        let query =
          qIndex !== -1
            ? Object.fromEntries(new URLSearchParams(urlStr.substring(qIndex)).entries())
            : {};

        for (let i = 0; i < hooks.onRequest.length; i++) {
          const handler = hooks.onRequest[i];
          if (handler) {
            const res = handler(req);
            if (res instanceof Promise) {
              req = await res;
            } else {
              req = res as Request;
            }
          }
        }

        if (paramsSchema) {
          const result = paramsSchema.validate(params);
          if (result.issues) {
            throw { statusCode: 400, message: "Invalid params" };
          }
          if ("value" in result) {
            params = result.value;
          }
        }

        if (querySchema) {
          const result = querySchema.validate(query);
          if (result.issues) {
            throw { statusCode: 400, message: "Invalid query parameters" };
          }
          if ("value" in result) {
            query = result.value;
          }
        }

        const rawHeaders: Record<string, string> = {};
        if (headersSchema) {
          req.headers.forEach((v, k) => {
            rawHeaders[k.toLowerCase()] = v;
          });
          const result = headersSchema.validate(rawHeaders);
          if (result.issues) {
            throw { statusCode: 400, message: "Invalid header value" };
          }
        }

        let body: any;
        let rawBody: any;

        if (hasBody) {
          try {
            let parsed = false;
            if (hooks.onParse.length > 0) {
              const cloned = req.clone() as unknown as Request;
              for (let i = 0; i < hooks.onParse.length; i++) {
                const handler = hooks.onParse[i];
                if (handler) {
                  const res = handler(cloned);
                  const r = res instanceof Promise ? await res : res;
                  if (r !== undefined) {
                    body = r;
                    parsed = true;
                    break;
                  }
                }
              }
            }

            if (!parsed) {
              body = await parseRequestBody(req);
            }

            if (body === "") {
              body = undefined;
            }

            if (bodySchema?.["~standard"]) {
              const result = bodySchema["~standard"].validate(body);
              if (result instanceof Promise ? (await result).issues : result.issues) {
                throw { statusCode: 400, message: "Invalid body" };
              }
              if ("value" in result) {
                body = result.value;
              }
            }
          } catch {
            if (bodySchema) {
              throw { statusCode: 400, message: "Invalid body format" };
            }
          }
        }

        ctx = {
          req,
          params,
          query,
          headers: rawHeaders,
          body,
          rawBody,
          route: route.path,
          method: route.method,
          error: (statusCode: number, message?: string) => {
            throw { statusCode, message: message || "Error" };
          },
          set: this.createResponseContext(),
        };

        for (let i = 0; i < hooks.onTransform.length; i++) {
          const handler = hooks.onTransform[i];
          if (handler) {
            const res = handler(ctx);
            const transformed = res instanceof Promise ? await res : res;
            if (transformed && typeof transformed === "object") {
              Object.assign(ctx, transformed);
            }
          }
        }

        let result;

        const runMain = async () => {
          return route.handler(ctx);
        };

        if (hooks.onBeforeHandle.length > 0) {
          let idx = 0;
          const next = async (): Promise<any> => {
            if (idx >= hooks.onBeforeHandle.length) {
              return runMain();
            }
            const handler = hooks.onBeforeHandle[idx++];
            if (handler) {
              return handler(ctx, next);
            }
            return next();
          };
          result = await next();
        } else {
          result = await runMain();
        }

        if (hooks.onMapResponse.length > 0) {
          for (let i = 0; i < hooks.onMapResponse.length; i++) {
            const handler = hooks.onMapResponse[i];
            if (handler) {
              const res = handler(result, ctx);
              const r = res instanceof Promise ? await res : res;
              if (r instanceof Response) {
                result = r;
                break;
              }
            }
          }
        }

        if (!(result instanceof Response)) {
          result = Hedystia.createResponse(result);
        }

        result = this.applyResponseContext(result, ctx.set);

        if (hooks.onAfterHandle.length > 0) {
          for (let i = 0; i < hooks.onAfterHandle.length; i++) {
            const handler = hooks.onAfterHandle[i];
            if (handler) {
              const res = handler(result, ctx);
              const r = res instanceof Promise ? await res : res;
              if (r instanceof Response) {
                result = r;
              }
            }
          }
        }

        if (hooks.onAfterResponse.length > 0) {
          setTimeout(() => {
            for (let i = 0; i < hooks.onAfterResponse.length; i++) {
              const handler = hooks.onAfterResponse[i];
              if (handler) {
                handler(result, ctx);
              }
            }
          }, 0);
        }

        return result;
      } catch (err: any) {
        if (hooks.onError.length > 0) {
          for (let i = 0; i < hooks.onError.length; i++) {
            try {
              const handler = hooks.onError[i];
              if (handler) {
                const res = handler(err, ctx);
                const r = res instanceof Promise ? await res : res;
                if (r instanceof Response) {
                  return r;
                }
              }
            } catch {}
          }
        }

        const status = err.statusCode || 500;
        const msg = err.message || "Internal Server Error";

        let finalRes;
        if (errorSchema) {
          finalRes = new Response(JSON.stringify({ message: msg, code: status }), {
            status,
            headers: { "Content-Type": "application/json" },
          });
        } else {
          finalRes = new Response(JSON.stringify({ message: msg, code: status }), {
            status,
            headers: { "Content-Type": "application/json" },
          });
        }

        return finalRes;
      }
    };
  }

  private compile() {
    if (this.isCompiled) {
      return;
    }
    for (const staticRoute of this.staticRoutes) {
      const handler = async (req: Request): Promise<Response> => {
        if (this.cors && req.method === "OPTIONS") {
          const headers = await generateCorsHeaders(this.cors, req);
          return new Response(null, { status: 204, headers: headers as HeadersInit });
        }
        let res = (staticRoute.response as Response).clone() as Response;
        if (this.cors) {
          res = (await this.applyCorsHeaders(res, req)) as Response;
        }
        return res;
      };
      this.staticRoutesFast.set(staticRoute.path, handler);
      this.router.add("GET", staticRoute.path, handler);
    }

    for (const route of this.routes) {
      const compiledHandler = this.composeHandler(route);
      this.router.add(route.method, route.path, compiledHandler);
    }

    this.isCompiled = true;
  }

  public async fetch(req: Request): Promise<Response> {
    this.compile();
    const url = req.url;
    const s = url.indexOf("/", 11);
    const q = url.indexOf("?", s + 1);
    const path = q === -1 ? url.substring(s) : url.substring(s, q);
    const method = req.method;

    if (this.cors && method === "OPTIONS") {
      const corsHeaders = await generateCorsHeaders(this.cors, req);
      return new Response(null, {
        status: 204,
        headers: corsHeaders as HeadersInit,
      });
    }

    const fastStatic = this.staticRoutesFast.get(path);
    if (fastStatic && method === "GET") {
      const response = await fastStatic(req);
      if (this.cors) {
        return await this.applyCorsHeaders(response, req);
      }
      return response;
    }

    const match = this.router.find(method, path);
    if (match) {
      const response = await match.handler(req, match.params);
      if (this.cors) {
        return await this.applyCorsHeaders(response, req);
      }
      return response;
    }

    if (this.genericHandlers.length > 0) {
      const response = await processGenericHandlers(req, this.genericHandlers, 0);
      if (this.cors) {
        return await this.applyCorsHeaders(response, req);
      }
      return response;
    }

    const notFoundResponse = new Response("Not Found", { status: 404 });
    if (this.cors) {
      return await this.applyCorsHeaders(notFoundResponse, req);
    }
    return notFoundResponse;
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

    if (hasWebSocket) {
      type WebSocketData = {
        __wsPath?: string;
        request?: Request;
        subscribedTopics?: Set<string>;
      };
      this.server = serve<WebSocketData>({
        port,
        reusePort: this.reusePort,
        idleTimeout: this.idleTimeout,
        fetch: (req, server) => {
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
        },

        websocket: this.createWebSocketHandlers(),
      });
    } else {
      this.server = serve({
        port,
        reusePort: this.reusePort,
        idleTimeout: this.idleTimeout,
        fetch: (req) => this.fetch(req),
      });
    }

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
        let rawParams: Record<string, string> = {};

        const pathParts = path.split("/").filter(Boolean);
        for (const [routePath, handlerData] of this.subscriptionHandlers.entries()) {
          const routeParts = routePath.split("/").filter(Boolean);
          if (pathParts.length === routeParts.length) {
            let match = true;
            const tempParams: any = {};
            for (let i = 0; i < routeParts.length; i++) {
              const rp = routeParts[i];
              const pp = pathParts[i];
              if (!rp || !pp) {
                match = false;
                break;
              }

              if (rp.startsWith(":")) {
                tempParams[rp.slice(1)] = pp;
              } else if (rp !== pp) {
                match = false;
                break;
              }
            }
            if (match) {
              matchedSub = handlerData;
              rawParams = tempParams;
              break;
            }
          }
        }

        if (!matchedSub) {
          return;
        }

        const topic = path;

        if (type === "subscribe") {
          let validatedParams = rawParams || {};
          if (matchedSub.schema.params) {
            const result = matchedSub.schema.params["~standard"].validate(
              rawParams,
            ) as StandardSchemaV1.Result<any>;
            if ("issues" in result) {
              return;
            }
            validatedParams = result.value;
          }

          let validatedQuery = query || {};
          if (matchedSub.schema.query && query) {
            const result = matchedSub.schema.query["~standard"].validate(
              query,
            ) as StandardSchemaV1.Result<any>;
            if ("issues" in result) {
              console.error("Validation error (query):", result.issues);
              return;
            }
            validatedQuery = result.value;
          }

          let validatedHeaders = headers || {};
          if (matchedSub.schema.headers && headers) {
            const result = matchedSub.schema.headers["~standard"].validate(
              headers,
            ) as StandardSchemaV1.Result<any>;
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
