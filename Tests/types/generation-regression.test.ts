import { readFile, rm } from "node:fs/promises";
import { generateTypes, schemaToTypeString } from "@hedystia/types";
import { h } from "@hedystia/validations";
import { describe, expect, it } from "vitest";

const output = "/tmp/hedystia-generated-routes.d.ts";

describe("generated route type contracts", () => {
  it("renders nested, optional, union, and array schemas deterministically", () => {
    const schema = h.object({
      user: h.object({ id: h.number(), labels: h.array(h.string()) }),
      status: h.union(h.literal("ready"), h.literal("failed")),
      note: h.optional(h.string()),
    });
    expect(schemaToTypeString(schema)).toBe(
      "{user:{id:number;labels:string[]};status:'ready' | 'failed';note?:string}",
    );
  });

  it("writes every RouteInfo section into a reusable AppRoutes declaration", async () => {
    try {
      await generateTypes(
        [
          {
            method: "POST",
            path: "/teams/:teamId",
            params: h.object({ teamId: h.string() }),
            query: h.object({ preview: h.optional(h.boolean()) }),
            headers: h.object({ authorization: h.string() }),
            body: h.object({ members: h.array(h.string()) }),
            response: h.object({ accepted: h.boolean() }),
            data: h.object({ event: h.string() }),
            error: h.object({ code: h.number() }),
          },
        ],
        output,
      );
      const content = await readFile(output, "utf8");
      expect(content).toContain('method:"POST";path:"/teams/:teamId"');
      expect(content).toContain("params:{teamId:string}");
      expect(content).toContain("query:{preview?:boolean}");
      expect(content).toContain("body:{members:string[]}");
      expect(content).toContain("response:{accepted:boolean}");
      expect(content).toContain("data:{event:string}");
      expect(content).toContain("error:{code:number}");
    } finally {
      await rm(output, { force: true });
    }
  });
});
