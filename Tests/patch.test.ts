import { Framework, createClient } from "../Package/src";
import { z } from "zod";

import { describe, expect, it } from "bun:test";

const app = new Framework()
  .patch(
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
  .patch(
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
  .patch(
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
  .listen(3006);

const client = createClient("http://localhost:3006", app);

describe("Test PATCH method", () => {
  it("should handle PATCH with params and body", async () => {
    const { data: response } = await client.resources.id(123).patch({
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

  it("should handle PATCH with nested route", async () => {
    client.resources.id;
    const { data: response } = await client.resources.status.id(456).patch(
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

  it("should handle PATCH with array body", async () => {
    const { data: response } = await client.resources.patch([
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

  it("should validate body in PATCH requests", async () => {
    try {
      await client.resources.status.id(789).patch({
        status: "invalid-status" as any,
      });

      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeDefined();
    }
  });
});
