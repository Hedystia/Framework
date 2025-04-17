import Hedystia from "hedystia";

const app = new Hedystia()
  .ws("/client", {
    message: (ws, message) => {
      const data = typeof message === "string" ? message : new TextDecoder().decode(message);
      ws.send(`You said: ${data}`);
    },
    open: (ws) => {
      console.log("WebSocket connection opened", ws.remoteAddress);
      ws.send("Welcome to the chat server!");
    },
    close: (ws, code, reason) => {
      console.log(`WebSocket closed with code ${code}`, reason);
    },
  })
  .listen(3000);

const ws = new WebSocket("ws://localhost:3000/client");

ws.onopen = () => {
  console.log("WebSocket connection opened");
  ws.send("Hello WebSocket!");
};

ws.onmessage = (event) => {
  console.log(`Received message: ${event.data}`);
  ws.close();
  app.close();
};

ws.onclose = (event) => {
  console.log(`WebSocket closed with code ${event.code}`, event.reason);
};

