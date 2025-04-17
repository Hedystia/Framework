import Hedystia, { z } from "hedystia";
import { createClient } from "@hedystia/client";

const app = new Hedystia()
  .get(
    "/",
    (context) => {
      return Response.json({
        query: context.query,
      });
    },
    {
      query: z.object({
        id: z.coerce.number(),
      }),
      response: z.object({
        query: z.object({ id: z.number() }),
      }),
    },
  )
  .listen(3000);

const client = createClient<typeof app>("http://localhost:3000");

const { error, data } = await client.index.get({
  id: 123,
});

console.log(`Error: ${error}`);
console.log(`Data: ${data?.query?.id}`);

app.close();
