import type { ServeInfo } from "@hedystia/ws";
import { serve } from "@hedystia/ws";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let server: ServeInfo;

beforeAll(async () => {
  server = await serve<{ room: string }>(
    {
      open: (ws) => {
        ws.subscribe(`room:${ws.data.room}`);
      },
      message: (ws, message) => {
        if (message === "who") {
          ws.send(`room:${ws.data.room}`);
          return;
        }
        if (message === "binary-length") {
          const size = ws.send(new Uint8Array([9, 8, 7]));
          ws.send(String(size));
          return;
        }
        if (typeof message === "string" && message.startsWith("publish:")) {
          ws.publish(message.slice(8), "peer-message");
          return;
        }
        ws.send(message);
      },
    },
    {
      port: 0,
      hostname: "127.0.0.1",
      resolveData: (request) => ({
        room: new URL(request.url ?? "/", "http://localhost").searchParams.get("room") ?? "none",
      }),
    },
  );
});

afterAll(async () => {
  await server.stop(true);
});

function open(room: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${server.port}?room=${room}`);
    ws.onopen = () => resolve(ws);
    ws.onerror = () => reject(new Error("websocket connection failed"));
  });
}

function waitForMessage(ws: WebSocket, predicate: (value: string) => boolean): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("message timeout")), 2000);
    ws.onmessage = (event) => {
      const value = typeof event.data === "string" ? event.data : String(event.data);
      if (predicate(value)) {
        clearTimeout(timer);
        resolve(value);
      }
    };
  });
}

describe("WebSocket protocol regression coverage", () => {
  it("resolves per-connection data and reports binary byte lengths", async () => {
    const ws = await open("alpha");
    try {
      const roomMessage = waitForMessage(ws, (value) => value === "room:alpha");
      ws.send("who");
      expect(await roomMessage).toBe("room:alpha");
      const binaryLength = waitForMessage(ws, (value) => value === "3");
      ws.send("binary-length");
      expect(await binaryLength).toBe("3");
    } finally {
      ws.close();
    }
  });

  it("broadcasts only to peers in the same resolved topic", async () => {
    const alpha = await open("alpha");
    const beta = await open("beta");
    const alphaPeer = await open("alpha");
    try {
      const alphaPeerMessage = waitForMessage(alphaPeer, (value) => value === "peer-message");
      alpha.send("publish:room:alpha");
      await expect(alphaPeerMessage).resolves.toBe("peer-message");

      let betaReceived = false;
      beta.onmessage = () => {
        betaReceived = true;
      };
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(betaReceived).toBe(false);
    } finally {
      alpha.close();
      alphaPeer.close();
      beta.close();
    }
  });
});
