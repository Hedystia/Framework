import type { Subscription, SubscriptionCallback, SubscriptionOptions } from "../types";
import { generateUUID } from "../utils";

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
  private connections = new Map<
    string,
    {
      abortController?: AbortController;
      socket?: WebSocket;
      handlers: Array<HandlerEntry>;
      serverSubscriptionId?: string;
      manuallyClosed?: boolean;
      reconnectAttempts?: number;
    }
  >();
  private baseUrl: string;
  private credentials?: "omit" | "same-origin" | "include";
  private sse: boolean;

  constructor(baseUrl: string, credentials?: "omit" | "same-origin" | "include", sse = false) {
    this.baseUrl = baseUrl;
    this.credentials = credentials;
    this.sse = sse;
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

    let connection = this.connections.get(path);
    if (!connection) {
      const socket = new WebSocket(wsUrl);
      connection = { socket, handlers: [] };
      this.connections.set(path, connection);

      socket.onopen = () => {
        const payload = {
          type: "subscribe",
          path,
          headers: options?.headers,
          query: options?.query,
          subscriptionId: id,
        };
        socket.send(JSON.stringify(payload));
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === "activity_check" && message.checkId) {
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
            if (subscriptionId) {
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
          console.error("Error parsing WS message:", e);
        }
      };

      socket.onclose = () => {
        if (connection && !connection.manuallyClosed) {
          const delay = Math.min(1000 * 2 ** (connection.reconnectAttempts || 0), 30000);
          connection.reconnectAttempts = (connection.reconnectAttempts || 0) + 1;

          setTimeout(() => {
            this.connections.delete(path);
            this.subscribeWithWebSocket(path, callback, options);
          }, delay);
        }
      };

      socket.onerror = (_error) => {
      };
    }

    const send = (data: any) => {
      const conn = this.connections.get(path);
      const targetId = conn?.serverSubscriptionId || id;

      if (conn?.socket && conn.socket.readyState === WebSocket.OPEN) {
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
      const conn = this.connections.get(path);
      if (!conn) {
        return;
      }

      conn.handlers = conn.handlers.filter((h) => h.id !== id);
      if (conn.handlers.length === 0) {
        if (conn.socket && conn.socket.readyState === WebSocket.OPEN) {
          const payload = {
            type: "unsubscribe",
            path,
            subscriptionId: conn.serverSubscriptionId,
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
      }).catch((e) => console.error("[SSE] Failed to send message:", e));
    };

    let url = `${this.baseUrl}${path}`;
    if (options?.query) {
      url += `?${new URLSearchParams(options.query as Record<string, string>).toString()}`;
    }

    let connection = this.connections.get(path);
    if (!connection) {
      const abortController = new AbortController();
      connection = { abortController, handlers: [] };
      this.connections.set(path, connection);

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
            console.error("[SSE] Connection failed", response.status, response.statusText);
            const text = await response.text();
            console.error("[SSE] Response:", text);
            return;
          }

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
                    if (subscriptionId) {
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
                  console.error("[SSE] Error processing message:", e);
                }
              }
            }
          }
        } catch (e: any) {
          if (e.name !== "AbortError") {
            console.error("[SSE] Connection error:", e);
          }
        }
      })();
    }

    const unsubscribe = () => {
      const conn = this.connections.get(path);
      if (!conn) {
        return;
      }

      conn.handlers = conn.handlers.filter((h) => h.id !== id);

      if (conn.handlers.length === 0) {
        if (conn.abortController) {
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
