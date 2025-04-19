const { Hedystia: Framework, h } = require("hedystia");
const { createClient } = require("@hedystia/client");

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
      response: h.object({ status: h.literal("ok") }),
    },
  )
  .get(
    "/slug/:name",
    (context) => {
      return Response.json(context.params);
    },
    {
      params: h.object({
        name: h.string(),
      }),
      response: h.object({ name: h.string() }),
    },
  )
  .get(
    "/test/test/new/random/:name/:id",
    (context) => {
      return Response.json(context.params);
    },
    {
      params: h.object({
        id: h.number().coerce(),
        name: h.string(),
      }),
      response: h.object({ id: h.number(), name: h.string() }),
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
