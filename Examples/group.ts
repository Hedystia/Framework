import Hedystia, { z } from "hedystia";
import { createClient } from "@hedystia/client";

const app = new Hedystia()
  .group("/users", (app) => {
    return app.get(
      "/:id",
      (context) => {
        return Response.json({
          params: context.params,
        });
      },
      {
        params: z.object({
          id: z.coerce.number(),
        }),
        response: z.object({
          params: z.object({ id: z.number() }),
        }),
      },
    );
  })
  .listen(3000);

const client = createClient<typeof app>("http://localhost:3000");

const { error, data } = await client.users.id(123).get();

console.log(`Error: ${error}`);
console.log(`Data: ${data?.params?.id}`);

app.close();
