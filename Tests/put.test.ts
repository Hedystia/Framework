import { Framework, createClient } from "../Package/src";
import { z } from "zod";

import { describe, expect, it } from "bun:test";

const app = new Framework()
  .put(
    "/resources/:id",
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
        title: z.string(),
        content: z.string(),
        published: z.boolean().optional(),
      }),
      response: z.object({
        params: z.object({ id: z.number() }),
        body: z.object({
          title: z.string(),
          content: z.string(),
          published: z.boolean().optional(),
        }),
      }),
    },
  )
  .put(
    "/resources/status/:id",
    (context) => {
      return Response.json({
        params: context.params,
        body: context.body,
        query: context.query,
      });
    },
    {
      params: z.object({
        id: z.coerce.number(),
      }),
      query: z.object({
        notify: z.enum(["yes", "no"]).optional(),
      }),
      body: z.object({
        status: z.enum(["draft", "published", "archived"]),
      }),
      response: z.object({
        params: z.object({ id: z.number() }),
        query: z.object({ notify: z.enum(["yes", "no"]).optional() }),
        body: z.object({
          status: z.enum(["draft", "published", "archived"]),
        }),
      }),
    },
  )
  .put(
    "/resources",
    (context) => {
      return Response.json({
        body: context.body,
      });
    },
    {
      body: z.array(
        z.object({
          id: z.number(),
          title: z.string(),
        }),
      ),
      response: z.object({
        body: z.array(
          z.object({
            id: z.number(),
            title: z.string(),
          }),
        ),
      }),
    },
  )
  .listen(3004);

const client = createClient<typeof app>("http://localhost:3004");

describe("Test PUT method", () => {
  it("should handle PUT with params and body", async () => {
    const { data: response } = await client.resources.id(123).put({
      title: "Updated Resource",
      content: "This resource has been updated",
      published: true,
    });

    expect(response).toEqual({
      params: { id: 123 },
      body: {
        title: "Updated Resource",
        content: "This resource has been updated",
        published: true,
      },
    });
  });

  it("should handle PUT with nested route", async () => {
    const { data: response } = await client.resources.status.id(456).put(
      {
        status: "published",
      },
      {
        notify: "yes",
      },
    );

    expect(response).toEqual({
      params: { id: 456 },
      query: { notify: "yes" },
      body: { status: "published" },
    });
  });

  it("should handle PUT with array body", async () => {
    const { data: response } = await client.resources.put([
      { id: 1, title: "First Resource" },
      { id: 2, title: "Second Resource" },
    ]);

    expect(response).toEqual({
      body: [
        { id: 1, title: "First Resource" },
        { id: 2, title: "Second Resource" },
      ],
    });
  });

  it("should validate body in PUT requests", async () => {
    try {
      await client.resources.status.id(789).put({
        status: "invalid-status" as any,
      });

      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
});
