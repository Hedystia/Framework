import { createClient } from "@hedystia/client";
import Hedystia, { h } from "hedystia";

const app = new Hedystia()
  .patch(
    "/:id",
    (context) => {
      return Response.json({
        body: context.body,
      });
    },
    {
      body: h.object({
        id: h.number().coerce(),
      }),
      params: h.object({
        id: h.number().coerce(),
      }),
      response: h.object({
        body: h.object({ id: h.number() }),
      }),
    },
  )
  .listen(3000);

const client = createClient<typeof app>("http://localhost:3000");

const { error, data } = await client.id(123).patch({ body: { id: 456 } });

console.log(`Error: ${error}`);
console.log(`Data: ${data?.body?.id}`);

app.close();
