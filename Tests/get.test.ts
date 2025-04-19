import Framework, { h } from "hedystia";
import { createClient } from "@hedystia/client";

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
  .listen(3000);

const client = createClient<typeof app>("http://localhost:3000");

describe("Test get route", () => {
  it("should return a response", async () => {
    const { data: slug } = await client.slug.name("sally").get();

    expect(slug).toEqual({ name: "sally" });
  });

  it("should return a response with params", async () => {
    const { data: test, error } = await client.test.test.new.random.name("sally").id(123).get();

    expect(error).toBeNull();

    expect(test).toEqual({ id: 123, name: "sally" });
  });

  it("should return a response for path ending in 'get'", async () => {
    const { error, data: response } = await client.users.get.get();

    expect(error).toBeNull();

    expect(response).toEqual({ status: "ok" });
  });

  afterAll(() => {
    app.close();
  });
});
