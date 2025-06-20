import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import path from "path";
import fs from "fs/promises";
import Framework, { h } from "hedystia";

const typesFilePath = path.join(__dirname, "test-server.d.ts");

const app = new Framework()
  .get("/", () => new Response(""), { response: h.string() })
  .get("/users/get", () => Response.json({ status: "ok" }), {
    response: h.object({ status: h.literal("ok") }),
  })
  .get("/slug/:name", (ctx) => Response.json(ctx.params), {
    params: h.object({ name: h.string() }),
    response: h.object({ name: h.string() }),
  })
  .get("/test/test/new/random/:name/:id", (ctx) => Response.json(ctx.params), {
    params: h.object({ id: h.number().coerce(), name: h.string() }),
    response: h.object({ id: h.number(), name: h.string() }),
  })
  .get("/headers", (ctx) => Response.json(ctx.headers), {
    headers: h.object({ "x-test-header": h.string() }),
    response: h.object({ "x-test-header": h.string() }),
  });

describe("Build Process", () => {
  beforeAll(async () => {
    try {
      await fs.unlink(typesFilePath);
    } catch (error) {}
  });

  afterAll(async () => {
    try {
      await fs.unlink(typesFilePath);
    } catch (error) {}
  });

  it("should generate a type definition file with the correct minified content", async () => {
    await app.buildTypes(typesFilePath);
    const fileExists = await Bun.file(typesFilePath).exists();
    expect(fileExists).toBe(true);

    const generatedContent = await Bun.file(typesFilePath).text();
    const expectedContent =
      '// Automatic Hedystia type generation\nexport type AppRoutes=[{method:"GET";path:"/";params:any;query:any;headers:any;response:string},{method:"GET";path:"/users/get";params:any;query:any;headers:any;response:{status:\'ok\'}},{method:"GET";path:"/slug/:name";params:{name:string};query:any;headers:any;response:{name:string}},{method:"GET";path:"/test/test/new/random/:name/:id";params:{id:number;name:string};query:any;headers:any;response:{id:number;name:string}},{method:"GET";path:"/headers";params:any;query:any;headers:{"x-test-header":string};response:{"x-test-header":string}}];';
    expect(generatedContent).toBe(expectedContent);
  });
});
