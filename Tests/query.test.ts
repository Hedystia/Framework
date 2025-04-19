import Framework, { h } from "hedystia";
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
      query: h.object({
        category: h.optional(h.string()),
        limit: h.optional(h.number().coerce()),
        sort: h.optional(h.enum(["asc", "desc"])),
      }),
      response: h.object({
        query: h.object({
          category: h.optional(h.string()),
          limit: h.optional(h.number()),
          sort: h.optional(h.enum(["asc", "desc"])),
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
      params: h.object({
        id: h.number().coerce(),
      }),
      query: h.object({
        fields: h.optional(h.string()),
        include: h.optional(h.string()),
      }),
      response: h.object({
        params: h.object({ id: h.number() }),
        query: h.object({
          fields: h.optional(h.string()),
          include: h.optional(h.string()),
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
