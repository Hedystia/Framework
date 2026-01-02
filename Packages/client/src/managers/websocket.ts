import type { Subscription, SubscriptionCallback, SubscriptionOptions } from "../types";
import { generateUUID } from "../utils";

type HandlerEntry = {
  id: string;
  callback: SubscriptionCallback;
  options?: SubscriptionOptions;
  unsubscribe: () => void;
  send: (data: any) => void;
};

export class WebSocketManager {
  private ws?: WebSocket;
  private handlers = new Map<string, Array<HandlerEntry>>();

  private isConnected = false;
  private isPermanentlyClosed = false;
  private connectionPromise: Promise<void> | null = null;

  private reconnectAttempts = 0;
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
            for (const handler of pathHandlers) {
              this.sendMessage({
                type: "subscribe",
                path,
                ...handler.options,
                subscriptionId: handler.id,
              });
            }
          });
        }

        this.reconnectAttempts = 0;
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === "ping") {
            this.sendMessage({ type: "pong" });
            return;
          }

          const { path, data, error, subscriptionId } = message;

          if (!path) {
            return;
          }

          const pathHandlers = this.handlers.get(path);
          if (!pathHandlers || pathHandlers.length === 0) {
            return;
          }

          const snapshot = pathHandlers.slice();

          if (subscriptionId) {
            const handler = snapshot.find((h) => h.id === subscriptionId);
            if (handler) {
              handler.callback({
                data,
                error,
                unsubscribe: handler.unsubscribe,
                send: handler.send,
              });
            }
          } else {
            for (const h of snapshot) {
              h.callback({ data, error, unsubscribe: h.unsubscribe, send: h.send });
            }
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

  private ensureConnected(): Promise<void> {
    if (!this.connectionPromise) {
      this.connectionPromise = this.connect();
    }
    return this.connectionPromise;
  }

  private sendMessage(message: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  public subscribe(
    path: string,
    callback: SubscriptionCallback,
    options?: SubscriptionOptions,
  ): Subscription {
    const id = generateUUID();

    const unsubscribe = () => {
      const currentHandlers = this.handlers.get(path);
      if (!currentHandlers) {
        return;
      }

      const index = currentHandlers.findIndex((h) => h.id === id);
      if (index !== -1) {
        currentHandlers.splice(index, 1);
      }

      if (currentHandlers.length === 0) {
        this.handlers.delete(path);
        if (this.isConnected) {
          this.sendMessage({ type: "unsubscribe", path });
        }
      }
    };

    const sendData = (data: any) => {
      if (this.isConnected) {
        this.sendMessage({ type: "message", path, data, subscriptionId: id });
      }
    };

    const handlerEntry: HandlerEntry = { id, callback, options, unsubscribe, send: sendData };

    if (!this.handlers.has(path)) {
      this.handlers.set(path, []);
    }
    this.handlers.get(path)!.push(handlerEntry);

    this.ensureConnected().then(() => {
      this.sendMessage({ type: "subscribe", path, ...options, subscriptionId: id });
    });

    return { unsubscribe, send: sendData };
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
    this.handlers.clear();
    this.ws?.close();
  }
}
