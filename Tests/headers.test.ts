import { afterAll, describe, expect, it } from "bun:test";
import { createClient } from "@hedystia/client";
import Framework, { h } from "hedystia";

const app = new Framework()
  .get(
    "/headers",
    (context) => {
      return Response.json(context.headers);
    },
    {
      headers: h
        .object({
          "x-test-header": h.string().optional(),
        })
        .optional(),
      response: h.object({ "x-test-header": h.string() }),
    },
  )
  .get(
    "/multi-headers",
    (context) => {
      return Response.json(context.headers);
    },
    {
      headers: h
        .object({
          "x-global-header": h.string().optional(),
          "x-override-header": h.string().optional(),
        })
        .optional(),
      response: h.object({
        "x-global-header": h.string(),
        "x-override-header": h.string(),
      }),
    },
  )
  .listen(3001);

describe("Global headers in createClient", () => {
  it("should send global headers on every request", async () => {
    const client = createClient<typeof app>("http://localhost:3001", {
      headers: {
        "x-test-header": "global-value",
      },
    });

    const { data, error } = await client.headers.get();

    expect(error).toBeNull();
    expect(data).toMatchObject({ "x-test-header": "global-value" });
  });

  it("should allow per-request headers to override global headers", async () => {
    const client = createClient<typeof app>("http://localhost:3001", {
      headers: {
        "x-test-header": "global-value",
      },
    });

    const { data, error } = await client.headers.get({
      headers: {
        "x-test-header": "overridden-value",
      },
    });

    expect(error).toBeNull();
    expect(data).toMatchObject({ "x-test-header": "overridden-value" });
  });

  it("should merge global and per-request headers", async () => {
    const client = createClient<typeof app>("http://localhost:3001", {
      headers: {
        "x-global-header": "global-value",
        "x-override-header": "global-override",
      },
    });

    const { data, error } = await client["multi-headers"].get({
      headers: {
        "x-override-header": "local-override",
      },
    });

    expect(error).toBeNull();
    expect(data).toMatchObject({ "x-global-header": "global-value" });
    expect(data).toMatchObject({ "x-override-header": "local-override" });
  });

  it("should work without global headers (backwards compatible)", async () => {
    const client = createClient<typeof app>("http://localhost:3001");

    const { data, error } = await client.headers.get({
      headers: {
        "x-test-header": "no-global",
      },
    });

    expect(error).toBeNull();
    expect(data).toMatchObject({ "x-test-header": "no-global" });
  });

  afterAll(() => {
    app.close();
  });
});
