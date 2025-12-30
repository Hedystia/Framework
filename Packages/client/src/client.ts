import type { Hedystia, RouteDefinition } from "hedystia";

type ResponseFormat = "json" | "text" | "formData" | "bytes" | "arrayBuffer" | "blob";

type SubscriptionCallback = (event: { data?: any; error?: any }) => void;
type SubscriptionOptions = { headers?: Record<string, any>; query?: Record<string, any> };
type Subscription = { unsubscribe: () => void };

type PathParts<Path extends string> = Path extends `/${infer Rest}`
  ? Rest extends ""
    ? []
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

type RequestOptions<B, Q, H, M extends string> = {
  responseFormat?: ResponseFormat;
  credentials?: "omit" | "same-origin" | "include";
} & (M extends "GET" ? {} : OptionalPart<"body", B>) &
  OptionalPart<"query", Q> &
  OptionalPart<"headers", H>;

type OptionsArgumentRequired<B, Q, H> = [
  HasRequiredKeys<B>,
  HasRequiredKeys<Q>,
  HasRequiredKeys<H>,
] extends [false, false, false]
  ? false
  : true;

type RequestFunction<B, Q, H, M extends string, ResponseType, ErrorType> = OptionsArgumentRequired<
  M extends "GET" ? never : B,
  Q,
  H
> extends true
  ? (options: RequestOptions<B, Q, H, M>) => Promise<{
      error: ErrorType | null;
      data: ResponseType | null;
      status: number;
      ok: boolean;
    }>
  : (options?: RequestOptions<B, Q, H, M>) => Promise<{
      error: ErrorType | null;
      data: ResponseType | null;
      status: number;
      ok: boolean;
    }>;

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void
  ? I
  : never;

type MergeMethodObjects<T> = {
  [K in keyof T as T[K] extends never ? never : K]: T[K];
};

type RouteTuple<R extends RouteDefinition> = [
  R["method"],
  R["path"],
  R["params"],
  R["query"],
  R["body"],
  R["response"],
  R["headers"],
  R["data"],
  R["error"],
];

type RouteToFunction<RouteInfo> = RouteInfo extends [
  infer M extends string,
  any,
  any,
  infer Q,
  infer B,
  infer R,
  infer H,
  infer E,
]
  ? RequestFunction<B, Q, H, M, R, E>
  : never;

type RouteToSubscription<RouteInfo> = RouteInfo extends [
  infer M,
  any,
  any,
  any,
  any,
  any,
  any,
  infer D,
  infer E,
]
  ? M extends "SUB"
    ? (
        callback: (event: { data?: D; error?: E }) => void,
        options?: SubscriptionOptions,
      ) => Subscription
    : never
  : never;

type RouteMetadata<R extends RouteDefinition> = {
  path: R["path"];
  params: R["params"];
  methods: MergeMethodObjects<
    {
      [M in R["method"] as M extends "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
        ? Lowercase<M>
        : never]: RouteToFunction<
        [M, R["path"], R["params"], R["query"], R["body"], R["response"], R["headers"], R["error"]]
      >;
    } & {
      [M in R["method"] as M extends "SUB" ? "subscribe" : never]: RouteToSubscription<
        RouteTuple<R>
      >;
    }
  >;
};

type SegmentsToNode<Segments extends string[], R extends RouteDefinition> = Segments extends [
  infer Head extends string,
  ...infer Tail extends string[],
]
  ? { [K in Head]: SegmentsToNode<Tail, R> }
  : { __meta: RouteMetadata<R> };

type RouteToTree<R extends RouteDefinition> = SegmentsToNode<PathParts<R["path"]>, R>;

type RoutesToTree<R extends RouteDefinition> = R extends any ? RouteToTree<R> : never;

type TreeToClient<Node> = (Node extends { __meta: { methods: infer M } } ? M : {}) & {
  [K in keyof Node as K extends `__${string}`
    ? never
    : K extends `:${infer Param}`
      ? Param
      : K]: K extends `:${infer Param}`
    ? (
        value: Node[K] extends { __meta: { params: infer P } }
          ? P[Param & keyof P]
          : string | number,
      ) => TreeToClient<Node[K]>
    : TreeToClient<Node[K]>;
};

type ClientTree<R extends RouteDefinition> = TreeToClient<UnionToIntersection<RoutesToTree<R>>>;

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
          if (message.type === "ping") {
            this.send({ type: "pong" });
            return;
          }
          const { path, data, error, subscriptionId } = message;

          if (!path || !this.handlers.has(path)) {
            return;
          }

          const pathHandlers = this.handlers.get(path);

          if (subscriptionId) {
            const handler = pathHandlers?.find((h) => h.id === subscriptionId);
            if (handler) {
              handler.callback({ data, error });
            }
          } else {
            pathHandlers?.forEach((h) => h.callback({ data, error }));
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
  clientOptions?: {
    credentials?: "omit" | "same-origin" | "include";
  },
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
          const { body, query, headers, responseFormat = "json", credentials } = options;

          if (query && typeof query === "object") {
            url.search = new URLSearchParams(query as any).toString();
          }

          const init: RequestInit = {
            method,
            credentials: credentials ?? clientOptions?.credentials,
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
