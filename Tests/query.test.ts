import Framework, { z } from "hedystia";
import { createClient } from "@hedystia/client";

import { afterAll, describe, expect, it } from "bun:test";

const app = new Framework()
  .get(
    "/products",
    (context) => {
      return Response.json({
        query: context.query,
      });
    },
    {
      query: z.object({
        category: z.optional(z.string()),
        limit: z.optional(z.coerce.number()),
        sort: z.optional(z.enum(["asc", "desc"])),
      }),
      response: z.object({
        query: z.object({
          category: z.optional(z.string()),
          limit: z.optional(z.number()),
          sort: z.optional(z.enum(["asc", "desc"])),
        }),
      }),
    },
  )
  .get(
    "/products/:id",
    (context) => {
      return Response.json({
        params: context.params,
        query: context.query,
      });
    },
    {
      params: z.object({
        id: z.coerce.number(),
      }),
      query: z.object({
        fields: z.optional(z.string()),
        include: z.optional(z.string()),
      }),
      response: z.object({
        params: z.object({ id: z.number() }),
        query: z.object({
          fields: z.optional(z.string()),
          include: z.optional(z.string()),
        }),
      }),
    },
  )
  .listen(3003);

const client = createClient<typeof app>("http://localhost:3003");

describe("Test query parameters", () => {
  it("should handle query parameters without path params", async () => {
    const { data: response } = await client.products.get({
      category: "electronics",
      limit: 10,
      sort: "desc",
    });

    expect(response).toEqual({
      query: {
        category: "electronics",
        limit: 10,
        sort: "desc",
      },
    });
  });

  it("should handle optional query parameters", async () => {
    const { data: response } = await client.products.get({
      category: "books",
    });

    expect(response).toEqual({
      query: {
        category: "books",
      },
    });
  });

  it("should handle no query parameters", async () => {
    const { data: response } = await client.products.get();

    expect(response).toEqual({
      query: {},
    });
  });

  it("should handle query parameters with path params", async () => {
    const { data: response } = await client.products.id(123).get({
      fields: "name,price,description",
      include: "reviews",
    });

    expect(response).toEqual({
      params: { id: 123 },
      query: {
        fields: "name,price,description",
        include: "reviews",
      },
    });
  });

  it("should validate query parameters", async () => {
    try {
      await client.products.get({
        sort: "invalid" as any,
      });

      expect(true).toBe(false);
    } catch (error) {
      expect(error).toBeDefined();
    }
  });

  afterAll(() => {
    app.close();
  });
});
