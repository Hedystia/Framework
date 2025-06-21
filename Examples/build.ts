import { createClient } from "@hedystia/client";
import Hedystia, { h } from "hedystia";
import path from "path";
import type { AppRoutes } from "./server";

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

await app.buildTypes(path.join(__dirname, "server.d.ts"));

const client = createClient<AppRoutes>("http://localhost:3000");

const { error, data } = await client.id(123).get();

console.log(`Error: ${error}`);
console.log(`Data: ${data?.params?.id}`);

app.close();
