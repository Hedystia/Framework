import { createClient } from "@hedystia/client";
import { file } from "bun";
import Hedystia from "hedystia";
import html from "./static.html";

const app = new Hedystia()
  .static(
    "/",
    new Response(await file(html.index).text(), {
      headers: { "Content-Type": "text/html" },
    }),
  )
  .listen(3000);

const client = createClient<typeof app>("http://localhost:3000");

const { error, data } = await client.get({
  responseFormat: "text",
});

console.log(`Error: ${error}`);
console.log(`Data: ${data}`);

app.close();
