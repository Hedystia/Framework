import Hedystia, { h } from "hedystia";
import { createClient } from "@hedystia/client";

const app = new Hedystia().get(
  "/",
  () => {
    return Response.json({
      message: "Hello, world!",
    });
  },
  {
    response: h.object({
      message: h.string(),
    }),
  },
);

const app_1 = new Hedystia().use("/api", app).listen(3000);

const client = createClient<typeof app_1>("http://localhost:3000");

const { error, data } = await client.api.index.get();

console.log(`Error: ${error}`);
console.log(`Data: ${data?.message}`);

app_1.close();
