import { Framework, createClient, z } from "../Package/src";
import { afterAll, describe, expect, it } from "bun:test";

const app = new Framework()
  .delete(
    "/resources/:id",
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
        reason: z.optional(z.enum(["obsolete", "duplicate", "other"])),
      }),
      body: z.object({
        confirm: z.boolean(),
      }),
      response: z.object({
        params: z.object({ id: z.number() }),
        query: z.object({ reason: z.optional(z.enum(["obsolete", "duplicate", "other"])) }),
        body: z.object({ confirm: z.boolean() }),
      }),
    },
  )
  .delete(
    "/resources/bulk",
    (context) => {
      return Response.json({
        query: context.query,
      });
    },
    {
      query: z.object({
        force: z.optional(z.boolean()),
      }),
      response: z.object({
        body: z.array(z.number()),
        query: z.object({ force: z.optional(z.boolean()) }),
      }),
    },
  )
  .listen(3005);

const client = createClient<typeof app>("http://localhost:3005");

describe("Test DELETE method", () => {
  it("should handle DELETE with params, body and query", async () => {
    const { data: response, error } = await client.resources
      .id(456)
      .delete({ confirm: true }, { reason: "obsolete" });

    expect(error).toBeNull();
    expect(response).toEqual({
      params: { id: 456 },
      body: { confirm: true },
      query: { reason: "obsolete" },
    });
  });

  it("should handle DELETE with only required body", async () => {
    const { data: response, error } = await client.resources.id(789).delete({ confirm: true });

    expect(error).toBeNull();
    expect(response).toEqual({
      params: { id: 789 },
      body: { confirm: true },
      query: {},
    });
  });

  it("should validate DELETE parameters - invalid query", async () => {
    const { error } = await client.resources
      .id(123)
      .delete({ confirm: true }, { reason: "invalid" as any });

    expect(error).toBeDefined();
  });

  it("should validate DELETE parameters - invalid body type", async () => {
    const { error } = await client.resources.bulk.delete("not-an-array" as any);

    expect(error).toBeDefined();
  });

  it("should return error when required body is missing", async () => {
    const { error } = await client.resources.id(999).delete(undefined as any);

    expect(error).toBeDefined();
  });

  afterAll(() => {
    app.close();
  });
});
