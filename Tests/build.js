const { Framework, createClient } = require("../Package/dist/index.js");
const { z } = require("zod");

console.time("test-time");

const app = new Framework()
  .get(
    "/users/get",
    () => {
      return Response.json({
        status: "ok",
      });
    },
    {
      response: z.object({ status: z.literal("ok") }),
    },
  )
  .get(
    "/slug/:name",
    (context) => {
      return Response.json(context.params);
    },
    {
      params: z.object({
        name: z.string(),
      }),
      response: z.object({ name: z.string() }),
    },
  )
  .get(
    "/test/test/new/random/:name/:id",
    (context) => {
      return Response.json(context.params);
    },
    {
      params: z.object({
        id: z.coerce.number(),
        name: z.string(),
      }),
      response: z.object({ id: z.coerce.number(), name: z.string() }),
    },
  )
  .listen(3021);

const client = createClient("http://localhost:3021");

(async () => {
  const { data: slug } = await client.slug.name("sally").get();
  if (slug.name !== "sally") {
    throw new Error("Failed to get slug");
  }

  const { data: test } = await client.test.test.new.random.name("sally").id(123).get();
  if (test.id !== 123 || test.name !== "sally") {
    throw new Error("Failed to get test");
  }

  const { data: response } = await client.users.get.get();
  if (response.status !== "ok") {
    throw new Error("Failed to get response");
  }

  console.timeEnd("test-time");

  app.close();
})();
