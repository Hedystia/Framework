import { createClient } from "@hedystia/client";
import Hedystia, { h } from "hedystia";

const app = new Hedystia()
  .macro({
    auth: () => ({
      resolve: async (ctx) => {
        const authHeader = ctx.req.headers.get("Authorization");
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          ctx.error(401, "Unauthorized");
        }
        const token = authHeader?.substring(7);
        return { userId: 1, token };
      },
    }),
  })
  .get(
    "/me",
    async (ctx) => {
      return {
        message: "Hello, world!",
        user: (await ctx.auth).userId,
        token: (await ctx.auth).token,
      };
    },
    {
      auth: true,
      response: h.object({
        message: h.string(),
        user: h.number(),
        token: h.string(),
      }),
      error: h.object({
        message: h.string(),
        code: h.number(),
      }),
    },
  )
  .listen(3000);

const client = createClient<typeof app>("http://localhost:3000");

const { error, data } = await client.me.get();

console.log(`Error: ${error?.message}`);
console.log(`Data: ${data?.message}`);

const { error: error2, data: data2 } = await client.me.get({
  headers: {
    Authorization: "Bearer test-token",
  },
});

console.log(`Error: ${error2?.message}`);
console.log(`Data: ${data2?.message}`);

app.close();
