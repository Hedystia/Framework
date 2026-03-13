type DebugLevel = "none" | "debug" | "warn" | "log" | "error";

type WebSocketEventHandlers = {
  onConnect?: () => void;
  onMessage?: (message: any) => void;
  onError?: (error: Error) => void;
  onDisconnect?: () => void;
};

export type WebSocketCallback = (ws: WebSocketConnection) => void;

export interface WebSocketConnection {
  send(message: any): void;
  disconnect(): void;
  onConnect(callback: () => void): void;
  onMessage(callback: (message: any) => void): void;
  onError(callback: (error: Error) => void): void;
  onDisconnect(callback: () => void): void;
}

export class WebSocketManager {
  private baseUrl: string;
  private debugLevel: DebugLevel;
  private headers?: Record<string, string>;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(baseUrl: string, debugLevel: DebugLevel = "none", headers?: Record<string, string>) {
    this.baseUrl = baseUrl;
    this.debugLevel = debugLevel;
    this.headers = headers;
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

  connect(path: string, callback: WebSocketCallback): { disconnect: () => void } {
    const wsUrl = this.baseUrl.replace(/^http/, "ws") + path;
    const handlers: WebSocketEventHandlers = {};
    let socket: WebSocket | null = null;
    let manuallyClosed = false;
    let reconnectAttempts = 0;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    const messageQueue: any[] = [];

    const connection: WebSocketConnection = {
      send: (message: any) => {
        const payload = typeof message === "string" ? message : JSON.stringify(message);
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(payload);
        } else {
          messageQueue.push(payload);
        }
      },
      disconnect: () => {
        manuallyClosed = true;
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
        }
        if (socket) {
          socket.close();
          socket = null;
        }
      },
      onConnect: (cb) => {
        handlers.onConnect = cb;
      },
      onMessage: (cb) => {
        handlers.onMessage = cb;
      },
      onError: (cb) => {
        handlers.onError = cb;
      },
      onDisconnect: (cb) => {
        handlers.onDisconnect = cb;
      },
    };

    const attemptConnect = () => {
      if (manuallyClosed) {
        return;
      }

      this.log("debug", "WebSocket connecting", { path, attempt: reconnectAttempts });
      const options = this.headers ? { headers: this.headers } : undefined;
      socket = new WebSocket(wsUrl, options);

      socket.onopen = () => {
        reconnectAttempts = 0;
        this.log("debug", "WebSocket connected", { path });

        while (messageQueue.length > 0) {
          const msg = messageQueue.shift();
          if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(msg);
          }
        }

        handlers.onConnect?.();
      };

      socket.onmessage = (event) => {
        try {
          const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
          handlers.onMessage?.(data);
        } catch {
          handlers.onMessage?.(event.data);
        }
      };

      socket.onerror = () => {
        this.log("error", "WebSocket error", { path });
        handlers.onError?.(new Error("WebSocket error"));
      };

      socket.onclose = () => {
        this.log("warn", "WebSocket closed", { path, attempts: reconnectAttempts });
        handlers.onDisconnect?.();

        if (!manuallyClosed && reconnectAttempts < this.maxReconnectAttempts) {
          reconnectAttempts++;
          const delay = Math.min(this.reconnectDelay * 2 ** (reconnectAttempts - 1), 30000);
          this.log("debug", "WebSocket reconnecting", { path, attempt: reconnectAttempts, delay });
          reconnectTimeout = setTimeout(attemptConnect, delay);
        }
      };
    };

    callback(connection);
    attemptConnect();

    return {
      disconnect: () => connection.disconnect(),
    };
  }
}
