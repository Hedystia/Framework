import { afterAll, describe, expect, it } from "bun:test";
import Framework from "hedystia";

const app = new Framework()
  .ws("/chat", {
    message: (ws, message) => {
      const data = typeof message === "string" ? message : new TextDecoder().decode(message);
      ws.send(`You said: ${data}`);
    },
    open: (ws) => {
      console.log("WebSocket connection opened", ws.remoteAddress);
      ws.send("Welcome to the chat server!");
    },
    close: (_ws, code, reason) => {
      console.log(`WebSocket closed with code ${code}`, reason);
    },
  })
  .listen(3009);

describe("WebSocket Tests", () => {
  const ws = new WebSocket("ws://localhost:3009/chat");

  it("should connect to WebSocket endpoint", async () => {
    return new Promise<void>((resolve, reject) => {
      ws.onopen = () => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
        resolve();
      };

      ws.onerror = (err) => {
        reject(new Error(`Failed to connect: ${err}`));
      };

      setTimeout(() => reject(new Error("Connection timeout")), 1000);
    });
  });

  it("should receive welcome message", async () => {
    return new Promise<void>((resolve, reject) => {
      ws.onmessage = (event) => {
        expect(event.data).toBe("Welcome to the chat server!");
        resolve();
      };

      setTimeout(() => reject(new Error("Message timeout")), 1000);
    });
  });

  it("should echo messages", async () => {
    return new Promise<void>((resolve, reject) => {
      const testMessage = "Hello WebSocket!";

      ws.onmessage = (event) => {
        if (event.data === `You said: ${testMessage}`) {
          expect(event.data).toBe(`You said: ${testMessage}`);
          resolve();
        }
      };

      ws.send(testMessage);

      setTimeout(() => reject(new Error("Echo timeout")), 1000);
    });
  });

  afterAll(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
    app.close();
  });
});
