import type { Subscription, SubscriptionCallback, SubscriptionOptions } from "../types";
import { generateUUID } from "../utils";

export class SSEManager {
  private connections = new Map<
    string,
    {
      abortController: AbortController;
      handlers: Array<{ id: string; callback: SubscriptionCallback }>;
    }
  >();
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  public subscribe(
    path: string,
    callback: SubscriptionCallback,
    options?: SubscriptionOptions,
  ): Subscription {
    const id = generateUUID();

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
            signal: abortController.signal,
          });

          if (!response.ok || !response.body) {
            console.error("[SSE] Connection failed");
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
                  const { data, error } = message;
                  const conn = this.connections.get(path);
                  if (conn) {
                    for (const h of conn.handlers) {
                      h.callback({ data, error });
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

    connection.handlers.push({ id, callback });

    const unsubscribe = () => {
      const conn = this.connections.get(path);
      if (!conn) {
        return;
      }

      conn.handlers = conn.handlers.filter((h) => h.id !== id);

      if (conn.handlers.length === 0) {
        conn.abortController.abort();
        this.connections.delete(path);
      }
    };

    const send = () => {
      throw new Error("Cannot send data in SSE mode. Use WebSocket mode to send data to server.");
    };

    return { unsubscribe, send };
  }

  public close() {
    this.connections.forEach((conn) => {
      conn.abortController.abort();
    });
    this.connections.clear();
  }
}
