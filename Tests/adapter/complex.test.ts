import { adapter } from "@hedystia/adapter";
import Framework, { h } from "hedystia";
import { describe, expect, it, vi } from "vitest";

function mockResponse() {
  let statusCode = 0;
  const headers: Record<string, string> = {};
  let body: Buffer | undefined;
  return {
    response: {
      set statusCode(value: number) {
        statusCode = value;
      },
      get statusCode() {
        return statusCode;
      },
      setHeader(name: string, value: string) {
        headers[name.toLowerCase()] = value;
      },
      end: vi.fn((value?: Buffer) => {
        body = value;
      }),
    },
    read: () => ({ statusCode, headers, body }),
  };
}

describe("adapter protocol conversions", () => {
  it("preserves query strings, JSON bodies, and prefixed paths in Lambda events", async () => {
    const app = new Framework().post(
      "/api/orders",
      ({ query, body, headers }) => ({
        query,
        body,
        requestHeader: headers["x-request-id"],
      }),
      {
        query: h.object({ source: h.string() }),
        body: h.object({ items: h.array(h.string()) }),
        headers: h.object({ "x-request-id": h.string() }),
      },
    );

    const result = await adapter(app).toLambda({ prefix: "/api" })(
      {
        rawPath: "/orders",
        requestContext: { http: { method: "POST" } },
        headers: {
          host: "example.test",
          "content-type": "application/json",
          "x-request-id": "r-7",
        },
        queryStringParameters: { source: "import" },
        body: JSON.stringify({ items: ["book", "pen"] }),
        isBase64Encoded: false,
      },
      {},
    );

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({
      query: { source: "import" },
      body: { items: ["book", "pen"] },
      requestHeader: "r-7",
    });
    expect((result as { isBase64Encoded?: boolean }).isBase64Encoded).toBe(false);
  });

  it("catches asynchronous downstream failures in Fastly and Deno adapters", async () => {
    const app = {
      fetch: (() => Promise.reject(new Error("downstream unavailable"))) as (
        request: Request,
      ) => Promise<Response>,
    };
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const hAdapter = adapter(app as any);
      const fastly = await hAdapter.toFastlyCompute()(new Request("http://localhost/fail"));
      const deno = await hAdapter.toDeno()(new Request("http://localhost/fail"));

      expect(fastly.status).toBe(500);
      expect(await fastly.text()).toBe("Internal Server Error: downstream unavailable");
      expect(deno.status).toBe(500);
      expect(await deno.text()).toBe("Internal Server Error: downstream unavailable");
    } finally {
      error.mockRestore();
    }
  });

  it("decodes binary Lambda responses and serializes Node responses consistently", async () => {
    const app = new Framework().get(
      "/asset",
      () =>
        new Response(Uint8Array.from([0, 1, 2, 255]), {
          headers: { "Content-Type": "application/pdf" },
        }),
    );
    const hAdapter = adapter(app);

    const lambda = await hAdapter.toLambda()(
      {
        rawPath: "/asset",
        httpMethod: "GET",
        headers: { host: "example.test" },
      },
      {},
    );
    expect(lambda.statusCode).toBe(200);
    expect((lambda as { isBase64Encoded?: boolean }).isBase64Encoded).toBe(true);
    expect(Buffer.from(lambda.body, "base64")).toEqual(Buffer.from([0, 1, 2, 255]));

    const mocked = mockResponse();
    await hAdapter.toNodeHandler()(
      { url: "/asset", method: "GET", headers: { host: "localhost" } },
      mocked.response,
    );
    expect(mocked.read().statusCode).toBe(200);
    expect(mocked.read().headers["content-type"]).toBe("application/pdf");
    expect(mocked.read().body).toEqual(Buffer.from([0, 1, 2, 255]));
  });
});
