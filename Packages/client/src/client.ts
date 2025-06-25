import type { Hedystia, RouteDefinition } from "hedystia";

type ResponseFormat = "json" | "text" | "formData" | "bytes" | "arrayBuffer" | "blob";

type SubscriptionCallback = (event: { data: any }) => void;
type SubscriptionOptions = { headers?: Record<string, any>; query?: Record<string, any> };
type Subscription = { unsubscribe: () => void };

type PathParts<Path extends string> = Path extends `/${infer Rest}`
  ? Rest extends ""
    ? [""]
    : Rest extends `${infer Head}/${infer Tail}`
      ? Tail extends ""
        ? [Head]
        : [Head, ...PathParts<`/${Tail}`>]
      : [Rest]
  : [];

type HasRequiredKeys<T> = T extends undefined | null | never ? false : {} extends T ? false : true;

type OptionalPart<Key extends string, T> = T extends undefined | never
  ? {}
  : HasRequiredKeys<T> extends true
    ? { [K in Key]: T }
    : { [K in Key]?: T };

type RequestOptions<B, Q, H> = {
  responseFormat?: ResponseFormat;
} & OptionalPart<"body", B> &
  OptionalPart<"query", Q> &
  OptionalPart<"headers", H>;

type OptionsArgumentRequired<B, Q, H> = [
  HasRequiredKeys<B>,
  HasRequiredKeys<Q>,
  HasRequiredKeys<H>,
] extends [false, false, false]
  ? false
  : true;

type RequestFunction<B, Q, H, ResponseType> = OptionsArgumentRequired<B, Q, H> extends true
  ? (
      options: RequestOptions<B, Q, H>,
    ) => Promise<{ error: any | null; data: ResponseType | null; status: number; ok: boolean }>
  : (
      options?: RequestOptions<B, Q, H>,
    ) => Promise<{ error: any | null; data: ResponseType | null; status: number; ok: boolean }>;

type RouteToTreeInner<T extends string[], Params, Methods> = T extends [
  infer H extends string,
  ...infer R extends string[],
]
  ? H extends `:${infer Param}`
    ? {
        [K in Param]: (value: Params[K & keyof Params]) => RouteToTreeInner<R, Params, Methods>;
      }
    : H extends ""
      ? Methods & RouteToTreeInner<R, Params, Methods>
      : {
          [K in H]: RouteToTreeInner<R, Params, Methods>;
        }
  : Methods;

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void
  ? I
  : never;

type MergeMethodObjects<T> = {
  [K in keyof T as T[K] extends never ? never : K]: T[K];
};

type RouteDefinitionsToMethodsObjects<Routes> = Routes extends {
  path: infer P extends string;
  params: infer Params;
  method: infer M;
  query?: infer Query;
  body?: infer Body;
  response?: infer Response;
  headers?: infer Headers;
}
  ? [M, P, Params, Query, Body, Response, Headers]
  : never;

type FindRoute<Method extends string, Path extends string, RoutesTupleUnion> = Extract<
  RoutesTupleUnion,
  [Method, Path, ...any[]]
>;

type RouteToFunction<RouteTuple> = [RouteTuple] extends [never]
  ? never
  : RouteTuple extends [any, any, any, infer Q, infer B, infer R, infer H]
    ? RequestFunction<B, Q, H, R>
    : never;

type RouteToSubscription<RouteTuple> = [RouteTuple] extends [never]
  ? never
  : (callback: SubscriptionCallback, options?: SubscriptionOptions) => Subscription;

type GroupedRoutes<Routes> = {
  [P in RouteDefinitionsToMethodsObjects<Routes>[1]]: {
    params: Extract<RouteDefinitionsToMethodsObjects<Routes>, [any, P, ...any[]]>[2];
    methods: MergeMethodObjects<{
      get: RouteToFunction<FindRoute<"GET", P & string, RouteDefinitionsToMethodsObjects<Routes>>>;
      patch: RouteToFunction<
        FindRoute<"PATCH", P & string, RouteDefinitionsToMethodsObjects<Routes>>
      >;
      post: RouteToFunction<
        FindRoute<"POST", P & string, RouteDefinitionsToMethodsObjects<Routes>>
      >;
      put: RouteToFunction<FindRoute<"PUT", P & string, RouteDefinitionsToMethodsObjects<Routes>>>;
      delete: RouteToFunction<
        FindRoute<"DELETE", P & string, RouteDefinitionsToMethodsObjects<Routes>>
      >;
      subscribe: RouteToSubscription<
        FindRoute<"SUB", P & string, RouteDefinitionsToMethodsObjects<Routes>>
      >;
    }>;
  };
};

type RouteToTree<Path extends string, Params, Methods> = PathParts<Path> extends [
  infer H extends string,
  ...infer T extends string[],
]
  ? H extends `:${infer Param}`
    ? {
        [K in Param]: (value: Params[K & keyof Params]) => RouteToTreeInner<T, Params, Methods>;
      }
    : H extends ""
      ? Methods & RouteToTreeInner<T, Params, Methods>
      : {
          [K in H]: RouteToTreeInner<T, Params, Methods>;
        }
  : {};

type ClientTree<R> = UnionToIntersection<
  {
    [P in keyof GroupedRoutes<R>]: RouteToTree<
      P & string,
      GroupedRoutes<R>[P]["params"],
      GroupedRoutes<R>[P]["methods"]
    >;
  }[keyof GroupedRoutes<R>]
>;

type ExtractRoutes<T extends RouteDefinition[]> = T[number];

type ExtractRoutesFromFramework<T> = T extends Hedystia<infer R>
  ? ExtractRoutes<R>
  : T extends RouteDefinition[]
    ? T[number]
    : never;

class WebSocketManager {
  private ws?: WebSocket;
  private handlers = new Map<
    string,
    Array<{ id: string; callback: SubscriptionCallback; options?: SubscriptionOptions }>
  >();

  private isConnected = false;
  private isPermanentlyClosed = false;
  private connectionPromise: Promise<void> | null = null;
  private pendingMessages: string[] = [];

  private reconnectAttempts = 0;
  private nextId = 0;
  private wsUrl: string;

  constructor(baseUrl: string) {
    this.wsUrl = baseUrl.replace(/^http/, "ws");
  }

  private connect(): Promise<void> {
    if (this.isPermanentlyClosed) {
      return Promise.reject("WebSocket manager permanently closed.");
    }

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;

        if (this.reconnectAttempts > 0) {
          this.handlers.forEach((pathHandlers, path) => {
            pathHandlers.forEach((handler) => {
              this.send({
                type: "subscribe",
                path,
                ...handler.options,
                subscriptionId: handler.id,
              });
            });
          });
        }

        this.reconnectAttempts = 0;

        while (this.pendingMessages.length > 0) {
          const message = this.pendingMessages.shift();
          if (message) {
            this.ws?.send(message);
          }
        }
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          const { path, data, subscriptionId } = message;

          if (!path || !this.handlers.has(path)) {
            return;
          }

          const pathHandlers = this.handlers.get(path);

          if (subscriptionId) {
            const handler = pathHandlers?.find((h) => h.id === subscriptionId);
            if (handler) {
              handler.callback({ data });
            }
          } else {
            pathHandlers?.forEach((h) => h.callback({ data }));
          }
        } catch (error) {
          console.error("[WS] Error processing the message:", error);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.connectionPromise = null;
        if (!this.isPermanentlyClosed) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (err) => {
        console.error("[WS] Connection error:", err);
        this.connectionPromise = null;
        this.ws?.close();
        reject(err);
      };
    });
  }

  private ensureConnected() {
    if (!this.connectionPromise) {
      this.connectionPromise = this.connect();
    }
  }

  private send(message: object) {
    const stringifiedMessage = JSON.stringify(message);
    if (this.isConnected) {
      this.ws?.send(stringifiedMessage);
    } else {
      this.pendingMessages.push(stringifiedMessage);
      this.ensureConnected();
    }
  }

  public subscribe(
    path: string,
    callback: SubscriptionCallback,
    options?: SubscriptionOptions,
  ): Subscription {
    this.ensureConnected();

    const id = (this.nextId++).toString();

    if (!this.handlers.has(path)) {
      this.handlers.set(path, []);
    }
    this.handlers.get(path)!.push({ id, callback, options });

    this.send({ type: "subscribe", path, ...options, subscriptionId: id });

    const unsubscribe = () => {
      const currentHandlers = this.handlers.get(path);
      if (!currentHandlers) {
        return;
      }

      const newHandlers = currentHandlers.filter((h) => h.id !== id);

      if (newHandlers.length > 0) {
        this.handlers.set(path, newHandlers);
      } else {
        this.handlers.delete(path);
        this.send({ type: "unsubscribe", path });
      }
    };

    return { unsubscribe };
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= 5) {
      console.error("[WS] Maximum reconnect attempts reached. Closing permanently.");
      this.close();
      return;
    }

    const delay = 2 ** this.reconnectAttempts * 1000;
    this.reconnectAttempts++;

    console.log(`[WS] Connection lost. Attempting to reconnect in ${delay / 1000}s...`);

    setTimeout(() => {
      this.ensureConnected();
    }, delay);
  }

  public close() {
    this.isPermanentlyClosed = true;
    this.ws?.close();
  }
}

async function parseFormData(response: Response): Promise<FormData> {
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }
  const contentType = response.headers.get("Content-Type") || "";
  if (contentType.includes("multipart/form-data")) {
    const text = await response.text();
    const formData = new FormData();
    const boundary = contentType.split("boundary=")[1];
    if (boundary) {
      const parts = text.split(`--${boundary}`);
      for (const part of parts) {
        if (part.trim() && !part.includes("--\r\n")) {
          const [headerPart, bodyPart] = part.split("\r\n\r\n");
          if (headerPart && bodyPart) {
            const nameMatch = headerPart.match(/name="([^"]+)"/);
            const filenameMatch = headerPart.match(/filename="([^"]+)"/);
            if (nameMatch) {
              const name = nameMatch[1];
              if (filenameMatch) {
                const filename = filenameMatch[1];
                const contentTypeMatch = headerPart.match(/Content-Type: (.+)/);
                const type = contentTypeMatch ? contentTypeMatch[1]?.trim() : "";

                const blob = new Blob([bodyPart.slice(0, -2)], { type });
                const file = new File([blob], String(filename), { type });

                formData.append(String(name), file);
              } else {
                formData.append(String(name), bodyPart.slice(0, -2));
              }
            }
          }
        }
      }
    }
    return formData;
  }
  const text = await response.text();
  const formData = new FormData();
  const params = new URLSearchParams(text);
  for (const [key, value] of params.entries()) {
    formData.append(key, value);
  }
  return formData;
}

async function processResponse(response: Response, format: ResponseFormat = "json") {
  try {
    const contentType = response.headers.get("Content-Type") || "";

    if (
      ((format === "text" || contentType.includes("text/plain")) && format !== "blob") ||
      (contentType.includes("text/html") && format !== "blob")
    ) {
      return await response.text();
    }

    switch (format) {
      case "json":
        return await response.json().catch(() => null);
      case "formData":
        return await parseFormData(response);
      case "bytes":
        return new Uint8Array(await response.arrayBuffer());
      case "arrayBuffer":
        return await response.arrayBuffer();
      case "blob":
        return await response.blob();
      default:
        return await response.json().catch(() => null);
    }
  } catch (error) {
    console.error(`Error processing ${format} response:`, error);
    return null;
  }
}

/**
 * Create client for Hedystia framework
 * @param {string} baseUrl - Base URL for client
 * @returns {ClientTree<ExtractRoutesFromFramework<T>>} Client instance
 */
export function createClient<T extends Hedystia<any> | RouteDefinition[]>(
  baseUrl: string,
): ClientTree<ExtractRoutesFromFramework<T>> {
  const HTTP_METHODS = ["get", "put", "post", "patch", "delete"];
  const wsManager = new WebSocketManager(baseUrl);

  const createProxy = (segments: string[] = []): any => {
    const proxyTarget = () => {};
    return new Proxy(proxyTarget, {
      get(_target, prop: string | symbol, receiver) {
        if (typeof prop !== "string") {
          return Reflect.get(_target, prop, receiver);
        }
        if (prop === "then") {
          return undefined;
        }
        if (prop.toLowerCase() === "subscribe") {
          const fullPath = `/${segments.filter(Boolean).join("/")}`;
          return (callback: SubscriptionCallback, options?: SubscriptionOptions) => {
            return wsManager.subscribe(fullPath, callback, options);
          };
        }
        if (HTTP_METHODS.includes(prop.toLowerCase())) {
          return createProxy([...segments, prop]);
        }
        return createProxy([...segments, prop]);
      },
      apply(_target, _thisArg, args) {
        const lastSegment = segments[segments.length - 1];
        if (lastSegment && HTTP_METHODS.includes(lastSegment.toLowerCase())) {
          const method = lastSegment.toUpperCase() as "GET" | "PATCH" | "POST" | "PUT" | "DELETE";
          const pathSegments = segments.slice(0, segments.length - 1);
          const fullPath =
            pathSegments.length === 0 || (pathSegments.length === 1 && pathSegments[0] === "")
              ? "/"
              : `/${pathSegments.filter((s) => s !== "").join("/")}`;
          const url = new URL(fullPath, baseUrl);

          const options = args[0] || {};
          const { body, query, headers, responseFormat = "json" } = options;

          if (query && typeof query === "object") {
            url.search = new URLSearchParams(query as any).toString();
          }

          const init: RequestInit = {
            method,
            headers: {
              ...(body && !(body instanceof FormData)
                ? { "Content-Type": "application/json" }
                : {}),
              ...headers,
            },
          };
          if (body !== undefined && method !== "GET") {
            if (body instanceof FormData) {
              init.body = body;
            } else {
              init.body = JSON.stringify(body);
            }
          }

          return (async () => {
            try {
              const res = await fetch(url.toString(), init);
              const status = res.status;
              const ok = res.ok;

              if (!ok) {
                const errorData = await processResponse(res, responseFormat);
                return { error: errorData, data: null, status, ok };
              }

              const data = await processResponse(res, responseFormat);
              return { error: null, data, status, ok };
            } catch (error) {
              return { error, data: null, status: 0, ok: false };
            }
          })();
        }
        const value = args[0];
        const newSegments = segments.slice(0, segments.length - 1).concat(String(value));
        return createProxy(newSegments);
      },
    });
  };

  return createProxy();
}
