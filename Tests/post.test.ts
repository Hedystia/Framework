import { afterAll, describe, expect, it } from "bun:test";
import { createClient } from "@hedystia/client";
import Framework, { h } from "hedystia";

const app = new Framework()
  .get(
    "/users/:id",
    (context) => {
      return Response.json(context.params);
    },
    {
      params: h.object({
        id: h.number().coerce(),
      }),
      response: h.object({ id: h.number().coerce() }),
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
      params: h.object({
        id: h.number().coerce(),
      }),
      body: h.object({
        name: h.string(),
        email: h.email(),
      }),
      response: h.object({
        params: h.object({ id: h.number().coerce() }),
        body: h.object({ name: h.string(), email: h.email() }),
      }),
    },
  )
  .post(
    "/ok",
    (context) => {
      if (context.body.name === "John Doe") {
        return Response.json({
          body: context.body,
        });
      }
      return Response.json(
        {
          message: "Invalid name",
        },
        { status: 400 },
      );
    },
    {
      body: h.object({
        name: h.string(),
      }),
      response: h.object({ body: h.optional(h.object()) }),
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
      body: h.object({
        name: h.string(),
      }),
      response: h.object({ body: h.object({ name: h.string() }) }),
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
      params: h.object({
        userId: h.string(),
      }),
      response: h.object({
        params: h.object({ userId: h.string() }),
        body: h.optional(h.object()),
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
      response: h.object({ body: h.optional(h.string()) }),
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
      response: h.object({ body: h.optional(h.object()) }),
    },
  )
  .post(
    "/headers",
    (context) => {
      return Response.json({
        body: context.body,
        headers: context.headers,
      });
    },
    {
      response: h.object({
        body: h.object({ name: h.string() }),
        headers: h.object({ content: h.string() }),
      }),
      body: h.object({
        name: h.string(),
      }),
      headers: h.object({
        content: h.string(),
      }),
    },
  )
  .listen(3001);

const client = createClient<typeof app>("http://localhost:3001");

describe("Test POST route", () => {
  it("should handle POST with params and body", async () => {
    const { data: response } = await client.users.id(123).post({
      body: { name: "John Doe", email: "john@example.com" },
    });

    expect(response).toEqual({
      params: { id: 123 },
      body: { name: "John Doe", email: "john@example.com" },
    });
  });

  it("should handle POST with only body", async () => {
    const { data: response } = await client.users.post({
      body: { name: "Jane Doe" },
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

  it("should test ok and status code", async () => {
    const { status, ok } = await client.ok.post({
      body: { name: "Alice Smith" },
    });
    expect(status).toBe(400);
    expect(ok).toBe(false);

    const {
      data: response,
      status: responseStatus,
      ok: responseOk,
    } = await client.ok.post({
      body: { name: "John Doe" },
    });
    expect(responseStatus).toBe(200);
    expect(responseOk).toBe(true);
    expect(response).toEqual({
      body: { name: "John Doe" },
    });
  });
  it("should test headers", async () => {
    const { data: response } = await client.headers.post({
      body: { name: "Jane Doe" },
      headers: {
        content: "Hedystia test",
      },
    });

    expect(response).toEqual({
      body: { name: "Jane Doe" },
      headers: { content: "Hedystia test" },
    });
  });

  afterAll(() => {
    app.close();
  });
});
