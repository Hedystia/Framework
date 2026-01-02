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
  private pendingMessages: string[] = [];

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
              handler.callback({
                data,
                error,
                unsubscribe: handler.unsubscribe,
                send: handler.send,
              });
            }
          } else {
            for (const h of pathHandlers ?? []) {
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

    const id = generateUUID();

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

    const sendData = (data: any) => {
      this.send({ type: "message", path, data, subscriptionId: id });
    };

    if (!this.handlers.has(path)) {
      this.handlers.set(path, []);
    }
    this.handlers.get(path)!.push({ id, callback, options, unsubscribe, send: sendData });

    this.send({ type: "subscribe", path, ...options, subscriptionId: id });

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
    this.ws?.close();
  }
}
