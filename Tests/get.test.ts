import { Framework, createClient, type ExtractRoutes } from "../Package/src";
import { z } from "zod";

import { describe, expect, it } from "bun:test";

describe("Test get route", () => {
  const app = new Framework()
    .get(
      "/users/:id",
      (context) => {
        context.params.id;
        return Response.json(context.params);
      },
      {
        params: z.object({
          id: z.number(),
        }),
      },
    )
    .get(
      "/slug/:name",
      (context) => {
        context.params.name;
        return Response.json(context.params);
      },
      {
        params: z.object({
          name: z.string(),
        }),
      },
    )
    .get(
      "/test/test/new/random/:name/:id",
      (context) => {
        context.params.id;
        return Response.json(context.params);
      },
      {
        params: z.object({
          id: z.coerce.number(),
          name: z.string(),
        }),
      },
    );

  app.listen(3000);

  type Routes = typeof app extends Framework<infer R> ? ExtractRoutes<R> : never;

  it("should return a response", async () => {
    const client = createClient<Routes>("http://localhost:3000", app);

    const slug = await client.slug.name("sally").get();

    expect(slug).toEqual({ name: "sally" });
  });

  it("should return a response with params", async () => {
    const client = createClient<Routes>("http://localhost:3000", app);

    const test = await client.test.test.new.random.name("sally").id(123).get();

    expect(test).toEqual({ id: 123, name: "sally" });
  });
});
