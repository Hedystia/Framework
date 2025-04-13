import { Framework, createClient, type ExtractRoutes } from "../Package/src";
import { z } from "zod";

import { describe, expect, it } from "bun:test";

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
    },
  )
  .post("/ping", (context) => {
    return Response.json({
      body: context.body || "pong",
    });
  })
  .post("/post", (context) => {
    return Response.json({
      body: context.body,
    });
  });

app.listen(3001);

type Routes = typeof app extends Framework<infer R> ? ExtractRoutes<R> : never;

const client = createClient<Routes>("http://localhost:3001", app);

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
});
