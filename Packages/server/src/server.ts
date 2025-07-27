import type { StandardSchemaV1 } from "@standard-schema/spec";
import { writeFile } from "fs/promises";
import Core from "./core";
import generateCorsHeaders from "./handlers/cors";
import processGenericHandlers from "./handlers/generic";
import type {
  CorsOptions,
  MacroData,
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
}

export class Hedystia<
  Routes extends RouteDefinition[] = [],
  _Macros extends MacroData = {},
> extends Core<Routes, _Macros> {
  private reusePort: boolean;

  constructor(options?: FrameworkOptions) {
    super();
    this.reusePort = options?.reusePort ?? false;
    this.cors = options?.cors ?? undefined;
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
    const addCorsHeaders = async (response: Response, request: Request): Promise<Response> => {
      if (!this.cors) {
        return response;
      }
      const corsHeaders = await generateCorsHeaders(this.cors, request);
      if (Object.keys(corsHeaders).length === 0) {
        return response;
      }
      const finalHeaders = new Headers();
      for (const [key, value] of response.headers.entries()) {
        finalHeaders.append(key, value);
      }
      Object.entries(corsHeaders).forEach(([key, value]) => {
        finalHeaders.set(key, String(value));
      });
      if (corsHeaders["Access-Control-Allow-Origin"] && !finalHeaders.has("Vary")) {
        finalHeaders.append("Vary", "Origin");
      }
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: finalHeaders,
      });
    };

    const handleRequest = async (request: Request): Promise<Response> => {
      const url = new URL(request.url);
      const path = url.pathname;

      if (this.cors && request.method === "OPTIONS") {
        const requestedMethod = request.headers.get("access-control-request-method")?.toUpperCase();
        const routeExists = this.routes.some(
          (r) => r.method === requestedMethod && matchRoute(path, r.path),
        );
        if (routeExists) {
          return new Response(null, { status: 204 });
        }
        return new Response(null, { status: 404 });
      }

      const route = this.routes.find(
        (r) => r.method === request.method && matchRoute(path, r.path),
      );

      if (route) {
        const routePath = route.path;
        try {
          let modifiedReq = request;
          for (const handler of this.onRequestHandlers) {
            const reqResult = handler(modifiedReq);
            modifiedReq = reqResult instanceof Promise ? await reqResult : reqResult;
          }

          const queryParams = Object.fromEntries(url.searchParams.entries());

          const rawParams = matchRoute(path, routePath);
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
              for (const parseHandler of this.onParseHandlers) {
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
                    {
                      status: 400,
                    },
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
            error: (statusCode: number, message?: string): never => {
              throw { statusCode, message: message || "Error" };
            },
          };

          for (const transformHandler of this.onTransformHandlers) {
            const transformedCtx = await transformHandler(ctx);
            if (transformedCtx) {
              ctx = transformedCtx;
            }
          }

          try {
            let mainHandlerExecuted = false;
            let finalResponse: Response | undefined;
            const executeMainHandler = async () => {
              mainHandlerExecuted = true;
              let result = await route.handler(ctx);

              if (!(result instanceof Response)) {
                for (const mapHandler of this.onMapResponseHandlers) {
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

              finalResponse = result;
              for (const afterHandler of this.onAfterHandleHandlers) {
                const afterResult = await afterHandler(finalResponse, ctx);
                if (afterResult instanceof Response) {
                  finalResponse = afterResult;
                }
              }

              setTimeout(async () => {
                if (finalResponse) {
                  for (const afterResponseHandler of this.onAfterResponseHandlers) {
                    await afterResponseHandler(finalResponse, ctx);
                  }
                }
              }, 0);
              return finalResponse;
            };

            let i = 0;
            const executeBeforeHandlers = async (): Promise<Response | undefined> => {
              if (i >= this.onBeforeHandleHandlers.length) {
                return executeMainHandler();
              }

              const beforeHandler = this.onBeforeHandleHandlers[i++];
              if (!beforeHandler) {
                return executeMainHandler();
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

              if (nextCalled) {
                if (finalResponse) {
                  return finalResponse;
                }
              }
              return executeBeforeHandlers();
            };

            const response = await executeBeforeHandlers();
            if (response) {
              return response;
            }

            if (!mainHandlerExecuted) {
              const final = await executeMainHandler();
              if (final) {
                return final;
              }
            }

            return new Response("Internal Server Error", { status: 500 });
          } catch (error) {
            for (const errorHandler of this.onErrorHandlers) {
              try {
                const errorResponse = await errorHandler(error as Error, ctx);
                if (errorResponse instanceof Response) {
                  return errorResponse;
                }
              } catch {}
            }

            if (typeof error === "object" && error !== null && "statusCode" in error) {
              const contextError = error as { statusCode: number; message: string };
              const status = contextError.statusCode;
              const ok = status >= 200 && status < 300;

              if (!ok) {
                let errorData;

                if (route.schema.error?.["~standard"]?.validate) {
                  const errorObj = {
                    message: contextError.message,
                    code: contextError.statusCode,
                  };
                  const errorValidation = await route.schema.error["~standard"].validate(errorObj);
                  if ("value" in errorValidation) {
                    errorData = errorValidation.value;
                  } else {
                    errorData = errorObj;
                  }
                } else {
                  errorData = {
                    message: contextError.message,
                    code: contextError.statusCode,
                  };
                }

                return new Response(JSON.stringify(errorData), {
                  status,
                  headers: { "Content-Type": "application/json" },
                });
              }
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
      }

      const staticRoute = this.staticRoutes.find((r) => r.path === path);
      if (staticRoute) {
        return staticRoute.response;
      }

      if (this.genericHandlers.length > 0) {
        return processGenericHandlers(request, this.genericHandlers, 0);
      }

      return new Response("Not Found", { status: 404 });
    };

    return handleRequest(req).then((res) => addCorsHeaders(res, req));
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

    this.server = serve({
      port,
      reusePort: this.reusePort,
      fetch: (req, server) => {
        const url = new URL(req.url);
        if (req.headers.get("upgrade")?.toLowerCase() === "websocket") {
          const path = url.pathname;
          const wsRoute = this.wsRoutes.get(path);
          if (wsRoute) {
            const upgraded = server.upgrade(req, {
              data: { __wsPath: path },
            });
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
      websocket:
        this.wsRoutes.size > 0 || this.subscriptionHandlers.size > 0
          ? this.createWebSocketHandlers()
          : undefined,
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
        return `{method:"${route.method}";path:"${route.path}";params:${paramsType};query:${queryType};body:${bodyType};headers:${headersType};response:${responseType}}`;
      })
      .join(",");
    return `// Automatic Hedystia type generation\nexport type AppRoutes=[${routeTypes}];`;
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
