import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import { createClient } from "@hedystia/client";
import Framework, { h } from "hedystia";

let lifecycleEvents: string[] = [];

const app = new Framework()
  .onSubscriptionOpen((ctx) => {
    lifecycleEvents.push(`open:${ctx.path}:${ctx.subscriptionId}`);
  })
  .onSubscriptionClose((ctx) => {
    lifecycleEvents.push(`close:${ctx.path}:${ctx.subscriptionId}:${ctx.reason}`);
  })
  .onSubscriptionMessage((ctx) => {
    lifecycleEvents.push(`message:${ctx.path}:${JSON.stringify(ctx.message)}`);
  })
  .subscription("/data/basic", async () => {
    return "Test";
  })
  .post("/data/basic", async () => {
    app.pub.data.basic({ data: "New data" });
    return new Response("Test");
  })
  .post(
    "/data/basic/body",
    async ({ body }) => {
      app.pub.data.basic({ data: body.message });
      return new Response("Test");
    },
    {
      body: h.object({
        message: h.string(),
      }),
    },
  )
  .subscription(
    "/data/params/:id",
    async () => {
      return "test";
    },
    {
      params: h.object({
        id: h.string(),
      }),
      data: h.object({
        id: h.string(),
      }),
    },
  )
  .post("/data/params/:id", async (ctx) => {
    app.publish(`/data/params/${ctx.params.id}`, {
      data: { id: ctx.params.id },
    });
    return new Response("Test");
  })
  .subscription(
    "/data/headers",
    async (ctx) => {
      return ctx.headers["x-test"];
    },
    {
      headers: h.object({
        "x-test": h.string(),
      }),
    },
  )
  .post(
    "/data/headers",
    async (ctx) => {
      app.pub.data.headers({ data: ctx.headers["x-test"] });
      return new Response("Test");
    },
    {
      headers: h.object({
        "x-test": h.string(),
      }),
    },
  )
  .get(
    "/data/query",
    async (ctx) => {
      const searchQuery = (ctx.query as { search: string }).search;
      return new Response(searchQuery, {
        headers: { "Content-Type": "text/plain" },
      });
    },
    {
      response: h.string(),
    },
  )
  .subscription(
    "/data/typed",
    async (ctx) => {
      const shouldError = ctx.query.error === "true";

      if (shouldError) {
        ctx.sendError({ message: "Test error", code: 400 });
        return;
      }

      ctx.sendData({ id: "123", message: "Success" });
    },
    {
      query: h.object({
        error: h.optional(h.string()),
      }),
      data: h.object({
        id: h.string(),
        message: h.string(),
      }),
      error: h.object({
        message: h.string(),
        code: h.number(),
      }),
    },
  )
  .subscription("/data/isactive", async (ctx) => {
    let count = 0;
    const interval = setInterval(() => {
      if (!ctx.isActive()) {
        clearInterval(interval);
        return;
      }
      count++;
      ctx.sendData({ count });
    }, 50);
    return { count: 0 };
  })
  .subscription(
    "/data/messages",
    async (ctx) => {
      ctx.onMessage((msg) => {
        ctx.sendData({ received: msg.text, echo: true });
      });
      return { status: "ready" };
    },
    {
      data: h.object({
        received: h.string(),
        echo: h.boolean(),
      }),
      message: h.object({
        text: h.string(),
      }),
    },
  )
  .subscription(
    "/data/validated",
    async () => {
      return { id: "123", valid: true };
    },
    {
      data: h.object({
        id: h.string(),
        valid: h.boolean(),
      }),
    },
  )
  .listen(3224);

const client = createClient<typeof app>("http://localhost:3224");

describe("Test subscriptions", () => {
  let logs: string[] = [];

  beforeEach(() => {
    logs = [];
  });

  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  it("should receive data from basic subscription", async () => {
    const sub1 = client.data.basic.subscribe(({ data }) => {
      logs.push(`Sub1: ${data}`);
    });

    client.data.basic.subscribe(({ data }) => {
      logs.push(`Sub2: ${data}`);
    });

    await wait(100);
    await client.data.basic.post();

    await wait(100);
    expect(logs).toContain("Sub1: New data");
    expect(logs).toContain("Sub2: New data");

    sub1.unsubscribe();
    logs = [];

    await client.data.basic.post();
    await wait(100);

    expect(logs).not.toContain("Sub1: New data");
    expect(logs).toContain("Sub2: New data");

    client.data.basic.subscribe(({ data }) => {
      logs.push(`Sub3: ${data}`);
    });

    logs = [];
    await client.data.basic.post();
    await wait(100);

    expect(logs).toContain("Sub2: New data");
    expect(logs).toContain("Sub3: New data");
  });

  it("should handle headers in subscription", async () => {
    const testHeader = "test-header-value";
    logs = [];

    client.data.headers.subscribe(
      ({ data }) => {
        logs.push(`Header: ${data}`);
      },
      { headers: { "x-test": testHeader } },
    );

    await wait(100);
    await client.data.headers.post({ headers: { "x-test": testHeader } });
    await wait(100);

    expect(logs).toContain(`Header: ${testHeader}`);
  });

  it("should handle URL parameters in subscription", async () => {
    logs = [];

    client.data.params.id("123").subscribe(({ data }) => {
      logs.push(`Param: ${data?.id}`);
    });

    await wait(100);
    await client.data.params.id("123").post();
    await wait(100);

    expect(logs).toContain("Param: " + "123");
  });

  it("should handle multiple URL parameter subscriptions independently", async () => {
    logs = [];

    const sub123 = client.data.params.id("123").subscribe(({ data }) => {
      logs.push(`Param-123: ${data?.id}`);
    });

    const sub456 = client.data.params.id("456").subscribe(({ data }) => {
      logs.push(`Param-456: ${data?.id}`);
    });

    await wait(150);

    await client.data.params.id("123").post();
    await wait(100);

    expect(logs).toContain("Param-123: 123");
    expect(logs).not.toContain("Param-456: 456");

    logs = [];
    await client.data.params.id("456").post();
    await wait(100);

    expect(logs).not.toContain("Param-123: 123");
    expect(logs).toContain("Param-456: 456");

    sub123.unsubscribe();
    logs = [];

    await client.data.params.id("123").post();
    await client.data.params.id("456").post();
    await wait(100);

    expect(logs).not.toContain("Param-123: 123");
    expect(logs).toContain("Param-456: 456");

    sub456.unsubscribe();
  });

  it("should handle POST with body data", async () => {
    logs = [];

    client.data.basic.subscribe(({ data }) => {
      logs.push(`Body: ${data}`);
    });

    await wait(100);
    await client.data.basic.body.post({
      body: { message: "test-message" },
    });
    await wait(100);

    expect(logs).toContain("Body: test-message");
  });

  it("should handle query parameters", async () => {
    const queryValue = "hello-hedystia";

    const { data, status, ok } = await client.data.query.get({ query: { search: queryValue } });

    expect(status).toBe(200);
    expect(ok).toBe(true);
    expect(data).toBe(queryValue);
  });

  it("should handle subscription with data and error schemas", async () => {
    logs = [];

    client.data.typed.subscribe(
      ({ data, error }) => {
        if (data) {
          logs.push(`Data: ${data.id} - ${data.message}`);
        }
        if (error) {
          logs.push(`Error: ${error.message} (${error.code})`);
        }
      },
      { query: { error: "false" } },
    );

    await wait(100);

    client.data.typed.subscribe(
      ({ data, error }) => {
        if (data) {
          logs.push(`Data2: ${data.id} - ${data.message}`);
        }
        if (error) {
          logs.push(`Error2: ${error.message} (${error.code})`);
        }
      },
      { query: { error: "true" } },
    );

    await wait(200);

    expect(logs).toContain("Data: 123 - Success");
  });

  it("should trigger lifecycle events on subscribe/unsubscribe", async () => {
    lifecycleEvents = [];
    const sub = client.data.isactive.subscribe(({ data }) => {
      if (data) {
        logs.push(`count: ${data.count}`);
      }
    });

    await wait(100);
    sub.unsubscribe();
    await wait(100);

    expect(lifecycleEvents.some((e) => e.startsWith("open:/data/isactive:"))).toBe(true);
    expect(lifecycleEvents.some((e) => e.includes("close:/data/isactive:"))).toBe(true);
  });

  it("should stop sending data when isActive returns false", async () => {
    logs = [];
    const sub = client.data.isactive.subscribe(({ data }) => {
      if (data) {
        logs.push(`count: ${data.count}`);
      }
    });

    await wait(150);
    const countBefore = logs.length;
    sub.unsubscribe();
    await wait(150);
    const countAfter = logs.length;
    expect(countAfter).toBe(countBefore);
  });

  it("should send and receive messages via send()", async () => {
    logs = [];
    const sub = client.data.messages.subscribe(({ data }) => {
      if (data) {
        logs.push(`received: ${data.received}, echo: ${data.echo}`);
      }
    });

    await wait(100);
    sub.send({ text: "Hello from client" });
    await wait(100);

    sub.unsubscribe();

    expect(logs.some((l) => l.includes("Hello from client"))).toBe(true);
    expect(lifecycleEvents.some((e) => e.includes("message:/data/messages:"))).toBe(true);
  });

  it("should validate published data", async () => {
    let receivedData: any;
    const sub = client.data.validated.subscribe(({ data }) => {
      receivedData = data;
    });

    await wait(100);

    app.publish("/data/validated", { data: { id: "test-id", valid: true } });

    await wait(100);
    expect(receivedData).toEqual({ id: "test-id", valid: true });

    app.publish("/data/validated", { data: { id: 123, valid: "not-bool" } });

    await wait(100);
    expect(receivedData).toEqual({ id: 123, valid: "not-bool" });

    sub.unsubscribe();
  });

  afterAll(() => {
    app.close();
  });
});
