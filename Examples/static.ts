import Hedystia from "hedystia";
import { createClient } from "@hedystia/client";
import html from "./static.html";

const app = new Hedystia()
  .static(
    "/",
    new Response(await Bun.file(html.index).text(), {
      headers: { "Content-Type": "text/html" },
    }),
  )
  .listen(3000);

const client = createClient<typeof app>("http://localhost:3000");

const { error, data } = await client.get(undefined, {
  responseFormat: "text",
});

console.log(`Error: ${error}`);
console.log(`Data: ${data}`);

app.close();
