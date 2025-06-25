import { createClient } from "@hedystia/client";
import Hedystia, { h } from "hedystia";

const app = new Hedystia()
  .post(
    "/",
    (context) => {
      return Response.json({
        body: context.body,
      });
    },
    {
      body: h.object({
        id: h.number().coerce(),
      }),
      response: h.object({
        body: h.object({ id: h.number() }),
      }),
    },
  )
  .listen(3000);

const client = createClient<typeof app>("http://localhost:3000");

const { error, data } = await client.post({ body: { id: 123 } });

console.log(`Error: ${error}`);
console.log(`Data: ${data?.body?.id}`);

app.close();
