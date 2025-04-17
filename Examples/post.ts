import Hedystia, { z } from "hedystia";
import { createClient } from "@hedystia/client";

const app = new Hedystia()
  .post(
    "/",
    (context) => {
      return Response.json({
        body: context.body,
      });
    },
    {
      body: z.object({
        id: z.coerce.number(),
      }),
      response: z.object({
        body: z.object({ id: z.number() }),
      }),
    },
  )
  .listen(3000);

const client = createClient<typeof app>("http://localhost:3000");

const { error, data } = await client.index.post({ id: 123 });

console.log(`Error: ${error}`);
console.log(`Data: ${data?.body?.id}`);

app.close();
