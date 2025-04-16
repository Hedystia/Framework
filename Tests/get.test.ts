import { Framework, createClient, z } from "../Package/src";

import { afterAll, describe, expect, it } from "bun:test";

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
  .listen(3000);

const client = createClient<typeof app>("http://localhost:3000");

describe("Test get route", () => {
  it("should return a response", async () => {
    const { data: slug } = await client.slug.name("sally").get();

    expect(slug).toEqual({ name: "sally" });
  });

  it("should return a response with params", async () => {
    const { data: test } = await client.test.test.new.random.name("sally").id(123).get();

    expect(test).toEqual({ id: 123, name: "sally" });
  });

  it("should return a response for path ending in 'get'", async () => {
    const { data: response } = await client.users.get.get();
    expect(response).toEqual({ status: "ok" });
  });

  afterAll(() => {
    app.close();
  });
});
