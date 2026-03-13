import { createClient } from "@hedystia/client";
import Hedystia from "hedystia";
import html from "./static.html";

const app = new Hedystia()
  .static("/static", "Hello from static string")
  .static("/", html)
  .listen(3015);

const client = createClient<typeof app>("http://localhost:3015");

const { error, data } = await client.get({
  responseFormat: "text",
});

console.log(`Error: ${error}`);
console.log(`Data: ${data}`);

app.close();
