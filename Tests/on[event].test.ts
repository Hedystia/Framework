import { describe, expect, it } from "bun:test";
import { createClient } from "@hedystia/client";
import Framework, { h } from "hedystia";

describe("Framework .on() Hooks Tests", () => {
  it("should trigger onRequest hook", async () => {
    const app = new Framework()
      .onRequest((req) => {
        req.headers.set("X-Test-Header", "modified");
        return req;
      })
      .get("/test-header", (ctx) => {
        return Response.json({
          headerValue: ctx.req.headers.get("X-Test-Header"),
        });
      })
      .listen(3009);

    const client = createClient<typeof app>("http://localhost:3009");
    const { data } = await client["test-header"].get();

    expect(data.headerValue).toBe("modified");

    app.close();
  });

  it("should trigger onParse hook", async () => {
    const app = new Framework()
      .onParse(() => {
        return { custom: true };
      })
      .post(
        "/parse-test",
        (ctx) => {
          return Response.json({ parsedBody: ctx.body });
        },
        {
          body: h.any(),
        },
      )
      .listen(3010);

    const client = createClient<typeof app>("http://localhost:3010");
    const { data } = await client["parse-test"].post({
      body: "raw text",
    });

    expect(data?.parsedBody).toEqual({ custom: true });

    app.close();
  });

  it("should trigger onTransform hook", async () => {
    const app = new Framework()
      .onTransform((ctx) => ({
        ...ctx,
        transformed: true,
      }))
      .get("/transform-test", (ctx: any) => {
        return Response.json({ wasTransformed: ctx.transformed });
      })
      .listen(3011);

    const client = createClient<typeof app>("http://localhost:3011");
    const { data } = await client["transform-test"].get();

    expect(data?.wasTransformed).toBeTrue();

    app.close();
  });

  it("should chain multiple onBeforeHandle hooks", async () => {
    const app = new Framework()
      .onBeforeHandle(async (ctx: any, next) => {
        ctx.modified = "first";
        return next();
      })
      .onBeforeHandle(async (ctx: any, next) => {
        ctx.modified += "-second";
        return next();
      })
      .get("/before-handle", (ctx: any) => {
        return Response.json({ chainResult: ctx.modified });
      })
      .listen(3012);

    const client = createClient<typeof app>("http://localhost:3012");
    const { data } = await client["before-handle"].get();

    expect(data?.chainResult).toBe("first-second");

    app.close();
  });

  it("should trigger onAfterHandle hook", async () => {
    const app = new Framework()
      .onAfterHandle(async (res) => {
        return new Response(JSON.stringify({ wrapped: await res.json() }), {
          headers: { "X-Modified": "true" },
        });
      })
      .get("/after-handle", () => Response.json({ original: true }))
      .listen(3013);

    const response = await fetch("http://localhost:3013/after-handle");

    expect(response.headers.get("X-Modified")).toBe("true");
    expect(await response.json()).toEqual({ wrapped: { original: true } });

    app.close();
  });

  it("should handle errors with onError hook", async () => {
    const app = new Framework()
      .onError((err) => {
        return Response.json({ customError: `${err.message} handled` });
      })
      .get("/error-test", () => {
        throw new Error("Test error");
      })
      .listen(3014);

    const client = createClient<typeof app>("http://localhost:3014");
    const { data } = await client["error-test"].get();

    expect(data?.customError).toBe("Test error handled");

    app.close();
  });

  it("should trigger onAfterResponse hook", async () => {
    const app = new Framework()
      .onAfterResponse((a) => {
        expect(a).toBeInstanceOf(Response);
      })
      .get("/after-response", () => Response.json({ success: true }), {
        response: h.object({ success: h.boolean() }),
      })
      .listen(3015);

    const client = createClient<typeof app>("http://localhost:3015");
    await client["after-response"].get();

    app.close();
  });
});
