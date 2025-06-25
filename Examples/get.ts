import { createClient } from "@hedystia/client";
import Hedystia, { h } from "hedystia";

const app = new Hedystia()
  .get(
    "/:id",
    (context) => {
      return Response.json({
        params: context.params,
      });
    },
    {
      params: h.object({
        id: h.number().coerce(),
      }),
      response: h.object({
        params: h.object({ id: h.number() }),
      }),
    },
  )
  .listen(3000);

const client = createClient<typeof app>("http://localhost:3000");

const { error, data } = await client.id(123).get();

console.log(`Error: ${error}`);
console.log(`Data: ${data?.params?.id}`);

app.close();
