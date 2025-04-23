import Hedystia from "hedystia";
import { adapter } from "@hedystia/adapter";
import { createClient } from "@hedystia/client";
import express from "express";

import { afterAll, describe, expect, it } from "bun:test";

const app = new Hedystia().get("/hello", () => "Hello World!");

const expressApp = express();
expressApp.use(adapter(app).toNodeHandler());
expressApp.listen(3022, () => console.log("Listening on port 3022"));

describe("Adapters Tests", () => {
  it("should work with Express", async () => {
    const client = createClient<typeof app>("http://localhost:3022");
    const { data, error } = await client.hello.get();
    expect(error).toBeNull();
    expect(data).toBe("Hello World!");
  });

  afterAll(() => {
    app.close();
  });
});
