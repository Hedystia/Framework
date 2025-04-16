import Framework, { z } from "hedystia";
import { createClient } from "@hedystia/client";

import { afterAll, describe, expect, it } from "bun:test";

const app = new Framework()
  .get(
    "/users/:id",
    (context) => {
      return Response.json(context.params);
    },
    {
      params: z.object({
        id: z.coerce.number(),
      }),
      response: z.object({ id: z.coerce.number() }),
    },
  )
  .post(
    "/users/:id",
    (context) => {
      return Response.json({
        params: context.params,
        body: context.body,
      });
    },
    {
      params: z.object({
        id: z.coerce.number(),
      }),
      body: z.object({
        name: z.string(),
        email: z.email(),
      }),
      response: z.object({
        params: z.object({ id: z.coerce.number() }),
        body: z.object({ name: z.string(), email: z.email() }),
      }),
    },
  )
  .post(
    "/users",
    (context) => {
      return Response.json({
        body: context.body,
      });
    },
    {
      body: z.object({
        name: z.string(),
      }),
      response: z.object({ body: z.object({ name: z.string() }) }),
    },
  )
  .post(
    "/profile/:userId",
    (context) => {
      return Response.json({
        params: context.params,
        body: context.body,
      });
    },
    {
      params: z.object({
        userId: z.string(),
      }),
      response: z.object({
        params: z.object({ userId: z.string() }),
        body: z.optional(z.object()),
      }),
    },
  )
  .post(
    "/ping",
    (context) => {
      return Response.json({
        body: context.body || "pong",
      });
    },
    {
      response: z.object({ body: z.optional(z.string()) }),
    },
  )
  .post(
    "/post",
    (context) => {
      return Response.json({
        body: context.body,
      });
    },
    {
      response: z.object({ body: z.optional(z.object()) }),
    },
  )
  .listen(3001);

const client = createClient<typeof app>("http://localhost:3001");

describe("Test POST route", () => {
  it("should handle POST with params and body", async () => {
    const { data: response } = await client.users.id(123).post({
      name: "John Doe",
      email: "john@example.com",
    });

    expect(response).toEqual({
      params: { id: 123 },
      body: { name: "John Doe", email: "john@example.com" },
    });
  });

  it("should handle POST with only body", async () => {
    const { data: response } = await client.users.post({
      name: "Jane Doe",
    });

    expect(response).toEqual({
      body: { name: "Jane Doe" },
    });
  });

  it("should handle POST with only params", async () => {
    const { data: response } = await client.profile.userId("user123").post();

    expect(response).toEqual({
      params: { userId: "user123" },
      body: undefined,
    });
  });

  it("should handle POST with no validation", async () => {
    const { data: response } = await client.ping.post();

    expect(response).toEqual({
      body: "pong",
    });
  });

  it("should return a response for path ending in 'post'", async () => {
    const { data: response } = await client.post.post();

    expect(response).toEqual({
      body: undefined,
    });
  });

  afterAll(() => {
    app.close();
  });
});
