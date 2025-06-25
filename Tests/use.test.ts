import { afterAll, describe, expect, it } from "bun:test";
import { createClient } from "@hedystia/client";
import Framework, { h } from "hedystia";

const apiV1 = new Framework()
  .get(
    "/",
    () => {
      return new Response("Welcome to API Server", {
        headers: { "Content-Type": "text/plain" },
      });
    },
    {
      response: h.string(),
    },
  )
  .get(
    "/users",
    () => {
      return Response.json({
        users: [
          { id: 1, name: "User 1", role: "admin" },
          { id: 2, name: "User 2", role: "user" },
        ],
      });
    },
    {
      response: h.object({
        users: h.array(
          h.object({
            id: h.number(),
            name: h.string(),
            role: h.string(),
          }),
        ),
      }),
    },
  )
  .get(
    "/users/:id",
    (context) => {
      const userId = context.params.id;
      return Response.json({
        userId,
        name: `User ${userId}`,
        role: userId === 1 ? "admin" : "user",
      });
    },
    {
      params: h.object({
        id: h.number().coerce(),
      }),
      response: h.object({
        userId: h.number(),
        name: h.string(),
        role: h.string(),
      }),
    },
  );

const apiV2 = new Framework().get(
  "/users",
  () => {
    return Response.json({
      users: [
        { id: 1, name: "User 1", role: "admin", metadata: { lastLogin: "2025-04-10" } },
        { id: 2, name: "User 2", role: "user", metadata: { lastLogin: "2025-04-12" } },
      ],
    });
  },
  {
    response: h.object({
      users: h.array(
        h.object({
          id: h.number(),
          name: h.string(),
          role: h.string(),
          metadata: h.object({
            lastLogin: h.string(),
          }),
        }),
      ),
    }),
  },
);

const app = new Framework()
  .get(
    "/welcome",
    () => {
      return new Response("Welcome to API Server", {
        headers: { "Content-Type": "text/plain" },
      });
    },
    {
      response: h.optional(h.string()),
    },
  )
  .use("/api/v1", apiV1)
  .use("/api/v2", apiV2)
  .listen(3008);

const client = createClient<typeof app>("http://localhost:3008");

describe("Framework .use() Tests", () => {
  it("should access root endpoint", async () => {
    const { data, error } = await client.welcome.get();

    expect(error).toBeNull();
    expect(data).toBe("Welcome to API Server");
  });

  it("should access v1 API users endpoint", async () => {
    const { data, error } = await client.api.v1.users.get();

    expect(error).toBeNull();
    expect(data).toEqual({
      users: [
        { id: 1, name: "User 1", role: "admin" },
        { id: 2, name: "User 2", role: "user" },
      ],
    });
  });

  it("should access v1 API specific user endpoint", async () => {
    const { data, error } = await client.api.v1.users.id(1).get();

    expect(error).toBeNull();
    expect(data).toEqual({
      userId: 1,
      name: "User 1",
      role: "admin",
    });
  });

  it("should access v2 API users endpoint", async () => {
    const { data, error } = await client.api.v2.users.get();

    expect(error).toBeNull();
    expect(data?.users).toHaveLength(2);
    expect(data?.users[0]?.metadata).toBeDefined();
    expect(data?.users[0]?.metadata.lastLogin).toBeDefined();
  });

  it("should access root v1 endpoint", async () => {
    const { data, error } = await client.api.v1.get();

    expect(error).toBeNull();
    expect(data).toBe("Welcome to API Server");
  });

  afterAll(() => {
    app.close();
  });
});
