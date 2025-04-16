import { Framework, createClient, z } from "../Package/src";

import { afterAll, describe, expect, it } from "bun:test";

const app = new Framework()
  .get(
    "/dynamic",
    () => {
      return Response.json({
        type: "dynamic",
      });
    },
    {
      response: z.object({ type: z.literal("dynamic") }),
    },
  )
  .static("/static-json", Response.json({ type: "static" }), {
    response: z.object({ type: z.literal("static") }),
  })
  .static(
    "/static-text",
    new Response("Static text content", {
      headers: { "Content-Type": "text/plain" },
    }),
    {
      response: z.string(),
    },
  )
  .static(
    "/static-html",
    new Response("<h1>Static HTML</h1>", {
      headers: { "Content-Type": "text/html" },
    }),
    {
      response: z.string(),
    },
  )
  .listen(3020);

const client = createClient<typeof app>("http://localhost:3020");

describe("Test static routes", () => {
  it("should return dynamic route content", async () => {
    const { data } = await client.dynamic.get();

    expect(data).toEqual({ type: "dynamic" });
  });

  it("should return static JSON content", async () => {
    const { data } = await client["static-json"].get();

    expect(data).toEqual({ type: "static" });
  });

  it("should return static text content", async () => {
    const { data } = await client["static-text"].get();

    expect(data).toBe("Static text content");
  });

  it("should return static HTML content", async () => {
    const { error, data } = await client["static-html"].get();

    expect(error).toBeNull();
    expect(data).toBe("<h1>Static HTML</h1>");
  });

  it("should return 404 for undefined routes", async () => {
    const response = await fetch("http://localhost:3020/undefined-route");

    expect(response.status).toBe(404);
  });

  afterAll(() => {
    app.close();
  });
});
