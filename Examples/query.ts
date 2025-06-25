import { createClient } from "@hedystia/client";
import Hedystia, { h } from "hedystia";

const app = new Hedystia()
  .get(
    "/",
    (context) => {
      return Response.json({
        query: context.query,
      });
    },
    {
      query: h.object({
        id: h.number().coerce(),
      }),
      response: h.object({
        query: h.object({ id: h.number() }),
      }),
    },
  )
  .listen(3000);

const client = createClient<typeof app>("http://localhost:3000");

const { error, data } = await client.get({
  query: { id: 123 },
});

console.log(`Error: ${error}`);
console.log(`Data: ${data?.query?.id}`);

app.close();
