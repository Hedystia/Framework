import { createClient } from "@hedystia/client";
import Hedystia from "hedystia";

const app = new Hedystia()
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
  .listen(3000);

// Create type-safe client
const client = createClient<typeof app>("http://localhost:3000");

// Connect to WebSocket using the client
client.chat.ws((ws) => {
  ws.onConnect(() => {
    console.log("✓ WebSocket connection opened");
    ws.send("Hello from client!");
  });

  ws.onMessage((message) => {
    console.log(`✓ Received message: ${message}`);

    if (message.includes("You said")) {
      // Close the connection after receiving echo
      ws.disconnect();
      app.close();
    }
  });

  ws.onError((error) => {
    console.error("✗ WebSocket error:", error);
    app.close();
  });

  ws.onDisconnect(() => {
    console.log("✓ WebSocket disconnected");
  });
});
