import type { Subscription, SubscriptionCallback, SubscriptionOptions } from "../types";
import { generateUUID } from "../utils";

type DebugLevel = "none" | "debug" | "warn" | "log" | "error";

type HandlerEntry = {
  id: string;
  callback: SubscriptionCallback;
  unsubscribe: () => void;
  send: (data: any) => void;
};

/**
 * SubscriptionManager handles both Server-Sent Events (SSE) and WebSocket connections
 * for real-time data subscriptions
 */
export class SubscriptionManager {
  private static readonly pathSubscriptionIds = new Map<string, string>();

  private connections = new Map<
    string,
    {
      abortController?: AbortController;
      socket?: WebSocket;
      handlers: Array<HandlerEntry>;
      serverSubscriptionId?: string;
      manuallyClosed?: boolean;
      reconnectAttempts?: number;
      reconnectTimeout?: ReturnType<typeof setTimeout>;
      heartbeatInterval?: ReturnType<typeof setInterval>;
      clientSubscriptionId: string;
    }
  >();
  private baseUrl: string;
  private credentials?: "omit" | "same-origin" | "include";
  private sse: boolean;
  private readonly MIN_RECONNECT_DELAY = 100;
  private readonly HEARTBEAT_INTERVAL = 25000;
  private debugLevel: DebugLevel;

  constructor(
    baseUrl: string,
    credentials?: "omit" | "same-origin" | "include",
    sse = false,
    debugLevel: DebugLevel = "none",
  ) {
    this.baseUrl = baseUrl;
    this.credentials = credentials;
    this.sse = sse;
    this.debugLevel = debugLevel;
  }

  private log(level: Exclude<DebugLevel, "none">, message: string, data?: any) {
    if (this.debugLevel === "none") {
      return;
    }

    const levels: Record<Exclude<DebugLevel, "none">, number> = {
      debug: 0,
      log: 1,
      warn: 2,
      error: 3,
    };
    const currentLevel = levels[this.debugLevel];
    const messageLevel = levels[level];

    if (messageLevel < currentLevel) {
      return;
    }

    const prefix = `[${level.toUpperCase()}]`;
    if (data !== undefined) {
      console[level === "debug" ? "log" : level](prefix, message, data);
    } else {
      console[level === "debug" ? "log" : level](prefix, message);
    }
  }

  private static getOrCreatePathSubscriptionId(path: string): string {
    if (!SubscriptionManager.pathSubscriptionIds.has(path)) {
      SubscriptionManager.pathSubscriptionIds.set(path, generateUUID());
    }
    return SubscriptionManager.pathSubscriptionIds.get(path)!;
  }

  public subscribe(
    path: string,
    callback: SubscriptionCallback,
    options?: SubscriptionOptions,
  ): Subscription {
    const transport = options?.sse || this.sse;

    if (transport) {
      return this.subscribeWithSSE(path, callback, options);
    }
    return this.subscribeWithWebSocket(path, callback, options);
  }

  private subscribeWithWebSocket(
    path: string,
    callback: SubscriptionCallback,
    options?: SubscriptionOptions,
  ): Subscription {
    const id = generateUUID();
    const wsUrl = this.baseUrl.replace(/^http/, "ws") + path;
    const clientSubscriptionId = SubscriptionManager.getOrCreatePathSubscriptionId(path);

    let connection = this.connections.get(path);
    if (!connection) {
      const socket = new WebSocket(wsUrl);
      connection = { socket, handlers: [], reconnectAttempts: 0, clientSubscriptionId };
      this.connections.set(path, connection);

      const connRef = connection;

      socket.onopen = () => {
        this.log("debug", "WebSocket connected", {
          path,
          subscriptionId: connRef.clientSubscriptionId,
        });
        connRef.reconnectAttempts = 0;
        if (connRef.heartbeatInterval) {
          clearInterval(connRef.heartbeatInterval);
        }
        connRef.heartbeatInterval = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            try {
              socket.send(JSON.stringify({ type: "ping" }));
            } catch {
              clearInterval(connRef.heartbeatInterval);
            }
          } else {
            clearInterval(connRef.heartbeatInterval);
          }
        }, this.HEARTBEAT_INTERVAL);

        const subscriptionId = connRef.serverSubscriptionId || connRef.clientSubscriptionId;
        const payload = {
          type: "subscribe",
          path,
          headers: options?.headers,
          query: options?.query,
          subscriptionId,
        };
        this.log("debug", "Subscribing", { path, subscriptionId });
        socket.send(JSON.stringify(payload));
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === "activity_check" && message.checkId) {
            this.log("debug", "Activity check received", { path, checkId: message.checkId });
            const response = {
              type: "activity_check_response",
              checkId: message.checkId,
            };
            socket.send(JSON.stringify(response));
            return;
          }

          const { data, error, subscriptionId } = message;
          const conn = this.connections.get(path);
          if (conn) {
            if (subscriptionId && !conn.serverSubscriptionId) {
              this.log("debug", "Received subscription ID from server", { path, subscriptionId });
              conn.serverSubscriptionId = subscriptionId;
            }
            for (const h of conn.handlers) {
              if (options?.onMessage) {
                options.onMessage(message);
              }
              h.callback({ data, error, unsubscribe: h.unsubscribe, send: h.send });
            }
          }
        } catch (e) {
          this.log("error", "Error parsing WS message", e);
        }
      };

      socket.onclose = () => {
        this.log("warn", "WebSocket closed", { path, attempts: connRef.reconnectAttempts });
        if (connRef.heartbeatInterval) {
          clearInterval(connRef.heartbeatInterval);
        }
        if (connRef.reconnectTimeout) {
          clearTimeout(connRef.reconnectTimeout);
        }
        if (connRef && !connRef.manuallyClosed) {
          connRef.reconnectAttempts = (connRef.reconnectAttempts || 0) + 1;
          const delay = Math.max(
            this.MIN_RECONNECT_DELAY,
            Math.min(1000 * 2 ** (connRef.reconnectAttempts - 1), 30000),
          );
          this.log("debug", "WebSocket reconnecting", {
            path,
            attempt: connRef.reconnectAttempts,
            delay,
          });
          connRef.reconnectTimeout = setTimeout(() => {
            this.connections.delete(path);
            this.subscribeWithWebSocket(path, callback, options);
          }, delay);
        }
      };

      socket.onerror = (error) => {
        this.log("error", "WebSocket error", { path, error });
      };
    }

    const send = (data: any) => {
      const conn = this.connections.get(path);
      const targetId = conn?.serverSubscriptionId || id;

      if (conn?.socket && conn.socket.readyState === WebSocket.OPEN) {
        this.log("debug", "Sending message on subscription", { path, subscriptionId: targetId });
        const payload = {
          type: "message",
          path,
          data,
          subscriptionId: targetId,
        };
        conn.socket.send(JSON.stringify(payload));
      }
    };

    const unsubscribe = () => {
      this.log("debug", "Unsubscribing", { path });
      const conn = this.connections.get(path);
      if (!conn) {
        return;
      }

      conn.handlers = conn.handlers.filter((h) => h.id !== id);
      if (conn.handlers.length === 0) {
        if (conn.heartbeatInterval) {
          clearInterval(conn.heartbeatInterval);
        }
        if (conn.reconnectTimeout) {
          clearTimeout(conn.reconnectTimeout);
        }
        if (conn.socket && conn.socket.readyState === WebSocket.OPEN) {
          const subscriptionId = conn.serverSubscriptionId || conn.clientSubscriptionId;
          this.log("debug", "Sending unsubscribe message", { path, subscriptionId });
          const payload = {
            type: "unsubscribe",
            path,
            subscriptionId,
          };
          conn.socket.send(JSON.stringify(payload));
          conn.manuallyClosed = true;
          conn.socket.close();
        }
        this.connections.delete(path);
      }
    };

    connection.handlers.push({ id, callback, unsubscribe, send });

    return { unsubscribe, send };
  }

  private subscribeWithSSE(
    path: string,
    callback: SubscriptionCallback,
    options?: SubscriptionOptions,
  ): Subscription {
    const id = generateUUID();

    const send = (data: any) => {
      const conn = this.connections.get(path);

      const payload = data || {};

      let url = `${this.baseUrl}${path}`;
      if (options?.query) {
        url += `?${new URLSearchParams(options.query as Record<string, string>).toString()}`;
      }

      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-hedystia-subscription-id": conn?.serverSubscriptionId || "",
          ...options?.headers,
        },
        body: JSON.stringify(payload),
        credentials: this.credentials,
      }).catch((e) => this.log("error", "SSE Failed to send message", e));
    };

    let url = `${this.baseUrl}${path}`;
    if (options?.query) {
      url += `?${new URLSearchParams(options.query as Record<string, string>).toString()}`;
    }

    let connection = this.connections.get(path);
    if (!connection) {
      const abortController = new AbortController();
      const clientSubscriptionId = SubscriptionManager.getOrCreatePathSubscriptionId(path);
      connection = { abortController, handlers: [], reconnectAttempts: 0, clientSubscriptionId };
      this.connections.set(path, connection);

      const connRef = connection;
      const attemptConnect = () => {
        if (connRef.manuallyClosed) {
          return;
        }

        (async () => {
          try {
            const response = await fetch(url, {
              headers: {
                Accept: "text/event-stream",
                ...options?.headers,
              },
              credentials: this.credentials,
              signal: abortController.signal,
            });

            if (!response.ok || !response.body) {
              connRef.reconnectAttempts = (connRef.reconnectAttempts || 0) + 1;
              const delay = Math.max(
                this.MIN_RECONNECT_DELAY,
                Math.min(1000 * 2 ** (connRef.reconnectAttempts - 1), 30000),
              );
              this.log("warn", "SSE connection failed, reconnecting", {
                path,
                status: response.status,
                delay,
              });
              if (connRef.reconnectTimeout) {
                clearTimeout(connRef.reconnectTimeout);
              }
              connRef.reconnectTimeout = setTimeout(attemptConnect, delay);
              return;
            }

            this.log("debug", "SSE connected", {
              path,
              subscriptionId: connRef.clientSubscriptionId,
            });
            connRef.reconnectAttempts = 0;
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                break;
              }

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() || "";

              for (const line of lines) {
                if (line.startsWith("data: ")) {
                  try {
                    const jsonData = line.slice(6);
                    const message = JSON.parse(jsonData);
                    const { data, error, subscriptionId } = message;
                    const conn = this.connections.get(path);
                    if (conn) {
                      if (subscriptionId && !conn.serverSubscriptionId) {
                        this.log("debug", "Received subscription ID from SSE server", {
                          path,
                          subscriptionId,
                        });
                        conn.serverSubscriptionId = subscriptionId;
                      }
                      for (const h of conn.handlers) {
                        if (options?.onMessage) {
                          options.onMessage(message);
                        }
                        h.callback({ data, error, unsubscribe: h.unsubscribe, send: h.send });
                      }
                    }
                  } catch (e) {
                    this.log("error", "SSE Error processing message", e);
                  }
                }
              }
            }

            if (!connRef.manuallyClosed) {
              connRef.reconnectAttempts = 0;
              const delay = this.MIN_RECONNECT_DELAY;
              this.log("debug", "SSE stream ended, reconnecting", { path, delay });
              if (connRef.reconnectTimeout) {
                clearTimeout(connRef.reconnectTimeout);
              }
              connRef.reconnectTimeout = setTimeout(attemptConnect, delay);
            }
          } catch (e: any) {
            if (e.name !== "AbortError" && !connRef.manuallyClosed) {
              connRef.reconnectAttempts = (connRef.reconnectAttempts || 0) + 1;
              const delay = Math.max(
                this.MIN_RECONNECT_DELAY,
                Math.min(1000 * 2 ** (connRef.reconnectAttempts - 1), 30000),
              );
              this.log("error", "SSE error", {
                path,
                error: e.message,
                attempt: connRef.reconnectAttempts,
                delay,
              });
              if (connRef.reconnectTimeout) {
                clearTimeout(connRef.reconnectTimeout);
              }
              connRef.reconnectTimeout = setTimeout(attemptConnect, delay);
            }
          }
        })();
      };

      attemptConnect();
    }

    const unsubscribe = () => {
      const conn = this.connections.get(path);
      if (!conn) {
        return;
      }

      conn.handlers = conn.handlers.filter((h) => h.id !== id);

      if (conn.handlers.length === 0) {
        if (conn.heartbeatInterval) {
          clearInterval(conn.heartbeatInterval);
        }
        if (conn.reconnectTimeout) {
          clearTimeout(conn.reconnectTimeout);
        }
        if (conn.abortController) {
          conn.manuallyClosed = true;
          conn.abortController.abort();
        }
        this.connections.delete(path);
      }
    };

    connection.handlers.push({ id, callback, unsubscribe, send });

    return { unsubscribe, send };
  }

  public close() {
    for (const [, conn] of this.connections) {
      if (conn.heartbeatInterval) {
        clearInterval(conn.heartbeatInterval);
      }
      if (conn.reconnectTimeout) {
        clearTimeout(conn.reconnectTimeout);
      }
      if (conn.abortController) {
        conn.abortController.abort();
      }
      if (conn.socket) {
        conn.socket.close();
      }
    }
    this.connections.clear();
  }
}
