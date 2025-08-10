import { createClient } from "@hedystia/client";
import Hedystia, { h } from "hedystia";

export const app = new Hedystia()
  .subscription(
    "/guild/:id",
    async ({ params }) => {
      const defaultLang = "en";
      return {
        id: params.id,
        lang: defaultLang,
      };
    },
    {
      params: h.object({
        id: h.string(),
      }),
      data: h.object({
        id: h.string(),
        lang: h.options(h.literal("en"), h.literal("es")),
      }),
      error: h.object({
        id: h.string(),
      }),
    },
  )
  .post(
    "/guild/:id",
    ({ body, params }) => {
      app.publish(`/guild/${params.id}`, {
        data: { id: params.id, lang: body.lang },
      });
      return "ok";
    },
    {
      params: h.object({
        id: h.string(),
      }),
      body: h.object({
        lang: h.options(h.literal("en"), h.literal("es")),
      }),
    },
  )
  .listen(3000);

const client = createClient<typeof app>("http://localhost:3000");

client.guild.id("902265905638150164").subscribe(({ data, error }) => {
  console.log(data);
  console.log(error);
});

setTimeout(async () => {
  await client.guild.id("902265905638150164").post({
    body: { lang: "es" },
  });
  await client.guild.id("111111111111111111").post({
    body: { lang: "es" },
  });
}, 3000);
