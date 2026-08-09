import Framework, { h } from "hedystia";
import { describe, expect, it } from "vitest";

describe("server lifecycle composition", () => {
  it("runs request, transform, before, map, and after hooks in a deterministic order", async () => {
    const events: string[] = [];
    const app = new Framework({ security: { requestId: true } })
      .onRequest((request) => {
        events.push(`request:${request.headers.get("x-trace")}`);
        const headers = new Headers(request.headers);
        headers.set("x-trace", "rewritten");
        return new Request(request, { headers });
      })
      .onTransform((ctx) => {
        events.push(`transform:${ctx.headers["x-trace"]}`);
        return { transformed: true };
      })
      .onBeforeHandle(async (_ctx, next) => {
        events.push("before:enter");
        const response = await next();
        events.push("before:exit");
        return response;
      })
      .onMapResponse((result) => {
        events.push("map");
        return { ...result, mapped: true };
      })
      .onAfterHandle((response) => {
        events.push(`after:${response.status}`);
        return response;
      })
      .get(
        "/pipeline",
        (ctx) => {
          events.push(`handler:${(ctx as any).transformed}`);
          return { value: "ok" };
        },
        { response: h.object({ value: h.string(), mapped: h.boolean() }) },
      );

    const response = await app.fetch(
      new Request("http://localhost/pipeline", { headers: { "x-trace": "original" } }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ value: "ok", mapped: true });
    expect(events).toEqual([
      "request:original",
      "transform:rewritten",
      "before:enter",
      "handler:true",
      "before:exit",
      "map",
      "after:200",
    ]);
    app.close();
  });

  it("composes groups, conditional routes, and static responses without leaking prefixes", async () => {
    const app = new Framework();
    app.group("/v1", (group) =>
      group
        .get("/health", () => ({ version: 1 }))
        .static(
          "/manifest",
          new Response("v1", { headers: { "content-type": "text/plain", "x-kind": "static" } }),
        ),
    );
    app.if((conditional) => conditional.get("/feature", () => ({ enabled: true })));

    expect((await app.fetch(new Request("http://localhost/v1/health"))).status).toBe(200);
    const manifest = await app.fetch(new Request("http://localhost/v1/manifest"));
    expect(manifest.headers.get("x-kind")).toBe("static");
    expect(await manifest.text()).toBe("v1");
    expect((await app.fetch(new Request("http://localhost/feature"))).status).toBe(200);
    expect((await app.fetch(new Request("http://localhost/manifest"))).status).toBe(404);
    app.close();
  });

  it("enforces query limits and supports custom per-IP rate-limit keys", async () => {
    const app = new Framework({
      security: {
        maxQueryParameters: 1,
        rateLimit: { key: "ip", trustProxy: true, limit: 1, windowMs: 60_000 },
      },
    }).get("/search", ({ query }) => query);

    const tooMany = await app.fetch(
      new Request("http://localhost/search?a=1&b=2", {
        headers: { "x-forwarded-for": "10.0.0.1" },
      }),
    );
    expect(tooMany.status).toBe(400);

    const first = await app.fetch(
      new Request("http://localhost/search?a=1", { headers: { "x-forwarded-for": "10.0.0.1" } }),
    );
    const second = await app.fetch(
      new Request("http://localhost/search?a=1", { headers: { "x-forwarded-for": "10.0.0.1" } }),
    );
    const otherIp = await app.fetch(
      new Request("http://localhost/search?a=1", { headers: { "x-forwarded-for": "10.0.0.2" } }),
    );
    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(otherIp.status).toBe(200);
    app.close();
  });
});
