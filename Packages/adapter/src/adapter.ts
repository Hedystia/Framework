import { Hedystia, type RouteDefinition, type MacroData } from "hedystia";

interface AdapterOptions {
  prefix?: string;
}

export class HedystiaAdapter<Routes extends RouteDefinition[] = [], Macros extends MacroData = {}> {
  private app: Hedystia<Routes, Macros>;

  constructor(app: Hedystia<Routes, Macros>) {
    this.app = app;
  }

  toCloudflareWorker(options: AdapterOptions = {}) {
    const prefix = options.prefix || "";

    return {
      fetch: async (request: Request, env: any, ctx: any) => {
        try {
          let modifiedReq = request;

          for (const handler of this.app["onRequestHandlers"]) {
            const reqResult = handler(modifiedReq);
            modifiedReq = reqResult instanceof Promise ? await reqResult : reqResult;
          }

          const url = new URL(modifiedReq.url);
          const path = prefix + url.pathname;

          const route = this.app["routes"].find(
            (r) => r.method === modifiedReq.method && this.matchRoute(path, r.path),
          );

          if (route) {
            return await this.processRouteWithMiddleware(modifiedReq, route, path);
          }

          const staticRoute = this.app["staticRoutes"].find((r) => r.path === path);
          if (staticRoute) {
            return staticRoute.response.clone();
          }

          if (this.app["genericHandlers"].length > 0) {
            return this.processGenericHandlers(modifiedReq, this.app["genericHandlers"], 0);
          }

          return new Response("Not found", { status: 404 });
        } catch (error) {
          console.error("Server error:", error);
          return new Response(`Internal Server Error: ${(error as Error).message}`, {
            status: 500,
          });
        }
      },
    };
  }

  toNodeHandler(options: AdapterOptions = {}) {
    const prefix = options.prefix || "";

    return async (req: any, res: any) => {
      try {
        const request = this.nodeToRequest(req);

        let modifiedReq = request;
        for (const handler of this.app["onRequestHandlers"]) {
          const reqResult = handler(modifiedReq);
          modifiedReq = reqResult instanceof Promise ? await reqResult : reqResult;
        }

        const url = new URL(modifiedReq.url);
        const path = prefix + url.pathname;

        const route = this.app["routes"].find(
          (r) => r.method === modifiedReq.method && this.matchRoute(path, r.path),
        );

        let response: Response;

        if (route) {
          response = await this.processRouteWithMiddleware(modifiedReq, route, path);
        } else {
          const staticRoute = this.app["staticRoutes"].find((r) => r.path === path);
          if (staticRoute) {
            response = staticRoute.response.clone() as Response;
          } else if (this.app["genericHandlers"].length > 0) {
            response = await this.processGenericHandlers(
              modifiedReq,
              this.app["genericHandlers"],
              0,
            );
          } else {
            response = new Response("Not found", { status: 404 });
          }
        }

        await this.responseToNode(response, res);
      } catch (error) {
        console.error("Server error:", error);
        res.status(500).send(`Internal Server Error: ${(error as Error).message}`);
      }
    };
  }

  toFastlyCompute(options: AdapterOptions = {}) {
    const prefix = options.prefix || "";

    return async (request: Request) => {
      try {
        let modifiedReq = request;
        for (const handler of this.app["onRequestHandlers"]) {
          const reqResult = handler(modifiedReq);
          modifiedReq = reqResult instanceof Promise ? await reqResult : reqResult;
        }

        const url = new URL(modifiedReq.url);
        const path = prefix + url.pathname;

        const route = this.app["routes"].find(
          (r) => r.method === modifiedReq.method && this.matchRoute(path, r.path),
        );

        if (route) {
          return await this.processRouteWithMiddleware(modifiedReq, route, path);
        }

        const staticRoute = this.app["staticRoutes"].find((r) => r.path === path);
        if (staticRoute) {
          return staticRoute.response.clone();
        }

        if (this.app["genericHandlers"].length > 0) {
          return this.processGenericHandlers(modifiedReq, this.app["genericHandlers"], 0);
        }

        return new Response("Not found", { status: 404 });
      } catch (error) {
        console.error("Server error:", error);
        return new Response(`Internal Server Error: ${(error as Error).message}`, { status: 500 });
      }
    };
  }

  toDeno(options: AdapterOptions = {}) {
    const prefix = options.prefix || "";

    return async (request: Request) => {
      try {
        let modifiedReq = request;
        for (const handler of this.app["onRequestHandlers"]) {
          const reqResult = handler(modifiedReq);
          modifiedReq = reqResult instanceof Promise ? await reqResult : reqResult;
        }

        const url = new URL(modifiedReq.url);
        const path = prefix + url.pathname;

        const route = this.app["routes"].find(
          (r) => r.method === modifiedReq.method && this.matchRoute(path, r.path),
        );

        if (route) {
          return await this.processRouteWithMiddleware(modifiedReq, route, path);
        }

        const staticRoute = this.app["staticRoutes"].find((r) => r.path === path);
        if (staticRoute) {
          return staticRoute.response.clone();
        }

        if (this.app["genericHandlers"].length > 0) {
          return this.processGenericHandlers(modifiedReq, this.app["genericHandlers"], 0);
        }

        return new Response("Not found", { status: 404 });
      } catch (error) {
        console.error("Server error:", error);
        return new Response(`Internal Server Error: ${(error as Error).message}`, { status: 500 });
      }
    };
  }

  toLambda(options: AdapterOptions = {}) {
    const prefix = options.prefix || "";

    return async (event: any, context: any) => {
      try {
        const request = this.lambdaToRequest(event);

        let modifiedReq = request;
        for (const handler of this.app["onRequestHandlers"]) {
          const reqResult = handler(modifiedReq);
          modifiedReq = reqResult instanceof Promise ? await reqResult : reqResult;
        }

        const url = new URL(modifiedReq.url);
        const path = prefix + url.pathname;

        const route = this.app["routes"].find(
          (r) => r.method === modifiedReq.method && this.matchRoute(path, r.path),
        );

        let response: Response;

        if (route) {
          response = await this.processRouteWithMiddleware(modifiedReq, route, path);
        } else {
          const staticRoute = this.app["staticRoutes"].find((r) => r.path === path);
          if (staticRoute) {
            response = staticRoute.response.clone() as Response;
          } else if (this.app["genericHandlers"].length > 0) {
            response = await this.processGenericHandlers(
              modifiedReq,
              this.app["genericHandlers"],
              0,
            );
          } else {
            response = new Response("Not found", { status: 404 });
          }
        }

        return this.responseToLambda(response);
      } catch (error) {
        console.error("Server error:", error);
        return {
          statusCode: 500,
          body: `Internal Server Error: ${(error as Error).message}`,
          headers: { "Content-Type": "text/plain" },
        };
      }
    };
  }

  toVercel(options: AdapterOptions = {}) {
    const prefix = options.prefix || "";

    return async (req: any, res: any) => {
      try {
        const request = new Request(
          `${req.headers.host ? `https://${req.headers.host}` : "http://localhost"}${req.url}`,
          {
            method: req.method,
            headers: new Headers(req.headers),
            body: req.body ? JSON.stringify(req.body) : null,
          },
        );

        let modifiedReq = request;
        for (const handler of this.app["onRequestHandlers"]) {
          const reqResult = handler(modifiedReq);
          modifiedReq = reqResult instanceof Promise ? await reqResult : reqResult;
        }

        const url = new URL(modifiedReq.url);
        const path = prefix + url.pathname;

        const route = this.app["routes"].find(
          (r) => r.method === modifiedReq.method && this.matchRoute(path, r.path),
        );

        let response: Response;

        if (route) {
          response = await this.processRouteWithMiddleware(modifiedReq, route, path);
        } else {
          const staticRoute = this.app["staticRoutes"].find((r) => r.path === path);
          if (staticRoute) {
            response = staticRoute.response.clone() as Response;
          } else if (this.app["genericHandlers"].length > 0) {
            response = await this.processGenericHandlers(
              modifiedReq,
              this.app["genericHandlers"],
              0,
            );
          } else {
            response = new Response("Not found", { status: 404 });
          }
        }

        res.status(response.status);
        response.headers.forEach((value, key) => {
          res.setHeader(key, value);
        });

        const body = await response.arrayBuffer();
        res.send(Buffer.from(body));
      } catch (error) {
        console.error("Server error:", error);
        res.status(500).send(`Internal Server Error: ${(error as Error).message}`);
      }
    };
  }

  private async processRouteWithMiddleware(
    request: Request,
    route: any,
    path: string,
  ): Promise<Response> {
    try {
      const url = new URL(request.url);
      const queryParams = Object.fromEntries(url.searchParams.entries());

      const rawParams = this.matchRoute(path, route.path) || {};

      let paramsValidationResult;
      if (route.schema.params?.["~standard"]?.validate) {
        paramsValidationResult = await route.schema.params["~standard"].validate(rawParams);
        if ("issues" in paramsValidationResult) {
          return new Response("Invalid params: " + JSON.stringify(paramsValidationResult.issues), {
            status: 400,
          });
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
      for (const [key, value] of request.headers.entries()) {
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
      let bodyValidationResult: { value: any; issues?: any } = { value: undefined };

      if (
        route.method === "PATCH" ||
        route.method === "POST" ||
        route.method === "PUT" ||
        route.method === "DELETE"
      ) {
        try {
          for (const parseHandler of this.app["onParseHandlers"]) {
            const parsedResult = await parseHandler(request);
            if (parsedResult !== undefined) {
              body = parsedResult;
              break;
            }
          }

          if (body === undefined) {
            body = await this.parseRequestBody(request);
          }

          if (route.schema.body?.["~standard"]?.validate) {
            bodyValidationResult = await route.schema.body["~standard"].validate(body);
            if ("issues" in bodyValidationResult) {
              return new Response("Invalid body: " + JSON.stringify(bodyValidationResult.issues), {
                status: 400,
              });
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
        req: request,
        params: "value" in paramsValidationResult ? paramsValidationResult.value : {},
        query: "value" in queryValidationResult ? queryValidationResult.value : {},
        headers: "value" in headersValidationResult ? headersValidationResult.value : rawHeaders,
        body: "value" in bodyValidationResult ? bodyValidationResult.value : body,
        route: route.path,
        method: route.method,
      };

      for (const transformHandler of this.app["onTransformHandlers"]) {
        const transformedCtx = await transformHandler(ctx);
        if (transformedCtx) {
          ctx = transformedCtx;
        }
      }

      try {
        let mainHandlerExecuted = false;
        let processResult: Response | null = null;

        const executeMainHandler = async () => {
          mainHandlerExecuted = true;
          let result = await route.handler(ctx);

          if (!(result instanceof Response)) {
            for (const mapHandler of this.app["onMapResponseHandlers"]) {
              const mappedResponse = await mapHandler(result, ctx);
              if (mappedResponse instanceof Response) {
                result = mappedResponse;
                break;
              }
            }

            if (!(result instanceof Response)) {
              result = this.createResponse(result);
            }
          }

          let finalResponse = result;
          for (const afterHandler of this.app["onAfterHandleHandlers"]) {
            const afterResult = await afterHandler(finalResponse, ctx);
            if (afterResult instanceof Response) {
              finalResponse = afterResult;
            }
          }

          setTimeout(async () => {
            for (const afterResponseHandler of this.app["onAfterResponseHandlers"]) {
              await afterResponseHandler(finalResponse, ctx);
            }
          }, 0);

          return finalResponse;
        };

        let i = 0;
        const executeBeforeHandlers = async (): Promise<Response> => {
          if (i >= this.app["onBeforeHandleHandlers"].length) {
            return executeMainHandler();
          }

          const beforeHandler = this.app["onBeforeHandleHandlers"][i++];
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
            for (const afterHandler of this.app["onAfterHandleHandlers"]) {
              const afterResult = await afterHandler(finalResponse, ctx);
              if (afterResult instanceof Response) {
                finalResponse = afterResult;
              }
            }

            setTimeout(async () => {
              for (const afterResponseHandler of this.app["onAfterResponseHandlers"]) {
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

        if (this.app["onBeforeHandleHandlers"].length > 0) {
          const result = await executeBeforeHandlers();
          if (result) return result;
        }

        if (!mainHandlerExecuted) {
          return await executeMainHandler();
        }

        return new Response("Internal Server Error", { status: 500 });
      } catch (error) {
        for (const errorHandler of this.app["onErrorHandlers"]) {
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
  }

  private async parseRequestBody(req: Request): Promise<any> {
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

  private createResponse(data: any, contentType?: string): Response {
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

  private matchRoute(pathname: string, routePath: string): Record<string, string> | null {
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

  private async processGenericHandlers(
    req: Request,
    handlers: Array<(request: Request) => Response | Promise<Response>>,
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

  private nodeToRequest(req: any): Request {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) headers.set(key, value as string);
    }

    let body = null;
    if (req.body) {
      if (typeof req.body === "string") {
        body = req.body;
      } else if (req.body instanceof Buffer) {
        body = req.body;
      } else {
        body = JSON.stringify(req.body);
      }
    }

    return new Request(url.toString(), {
      method: req.method,
      headers,
      body,
    });
  }

  private async responseToNode(response: Response, res: any) {
    res.status(response.status);

    response.headers.forEach((value, key) => {
      res.set(key, value);
    });

    const contentType = response.headers.get("Content-Type");

    if (contentType && contentType.includes("application/json")) {
      const json = await response.json();
      res.json(json);
    } else {
      const body = await response.arrayBuffer();
      res.send(Buffer.from(body));
    }
  }

  private lambdaToRequest(event: any): Request {
    const protocol = event.headers["X-Forwarded-Proto"] || "https";
    const host = event.headers["Host"] || "localhost";
    const url = new URL(event.path, `${protocol}://${host}`);

    if (event.queryStringParameters) {
      Object.entries(event.queryStringParameters).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    const headers = new Headers();
    if (event.headers) {
      Object.entries(event.headers).forEach(([key, value]) => {
        if (value) headers.set(key, String(value));
      });
    }

    let body = event.body;
    if (event.isBase64Encoded && body) {
      body = Buffer.from(body, "base64");
    }

    return new Request(url.toString(), {
      method: event.httpMethod,
      headers,
      body,
    });
  }

  private async responseToLambda(response: Response) {
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const contentType = response.headers.get("Content-Type");
    let body = "";
    let isBase64Encoded = false;

    if (
      contentType &&
      (contentType.includes("image/") || contentType.includes("application/octet-stream"))
    ) {
      const buffer = await response.arrayBuffer();
      body = Buffer.from(buffer).toString("base64");
      isBase64Encoded = true;
    } else {
      body = await response.text();
    }

    return {
      statusCode: response.status,
      headers,
      body,
      isBase64Encoded,
    };
  }
}

export function adapter<Routes extends RouteDefinition[] = [], Macros extends MacroData = {}>(
  app: Hedystia<Routes, Macros>,
) {
  return new HedystiaAdapter(app);
}
