import { h } from "@hedystia/validations";
import { describe, expect, it } from "vitest";

describe("validation composition contracts", () => {
  it("validates a tagged command union with nested issue paths", async () => {
    const command = h.discriminatedUnion("kind", [
      h.object({ kind: h.literal("create"), payload: h.object({ name: h.string().minLength(2) }) }),
      h.object({ kind: h.literal("delete"), payload: h.object({ id: h.number().int() }) }),
    ]);
    const standard = h.toStandard(command);

    expect(await standard.parse({ kind: "create", payload: { name: "Ada" } })).toEqual({
      kind: "create",
      payload: { name: "Ada" },
    });
    const invalid = await standard.safeParse({ kind: "create", payload: { name: "" } });
    expect(invalid.issues?.[0]?.path).toEqual(["payload", "name"]);
    expect((await standard.safeParse({ kind: "rename", payload: {} })).issues?.[0]?.path).toEqual([
      "kind",
    ]);
  });

  it("keeps strict, passthrough, pick, omit, merge, and partial semantics independent", async () => {
    const base = h.object({ id: h.number(), label: h.string(), secret: h.string() });
    expect(
      (await h.toStandard(base.strict()).safeParse({ id: 1, label: "x", secret: "s", extra: true }))
        .issues,
    ).toBeDefined();
    expect(
      await h.toStandard(base.passthrough()).parse({ id: 1, label: "x", secret: "s", extra: true }),
    ).toEqual({
      id: 1,
      label: "x",
      secret: "s",
      extra: true,
    });
    expect(await h.toStandard(base.pick(["id", "label"])).parse({ id: 1, label: "x" })).toEqual({
      id: 1,
      label: "x",
    });
    expect(await h.toStandard(base.omit(["secret"])).parse({ id: 1, label: "x" })).toEqual({
      id: 1,
      label: "x",
    });
    expect(
      await h
        .toStandard(base.merge(h.object({ active: h.boolean() })))
        .parse({ id: 1, label: "x", secret: "s", active: true }),
    ).toMatchObject({ active: true });
    expect(await h.toStandard(base.partial()).parse({})).toEqual({});
  });

  it("pipes coercion, refinement, defaults, and transforms while preserving failures", async () => {
    const score = h.pipe(
      h.default(h.coerce.number(), 0),
      h.transform(
        h.refine(h.number().int().min(0).max(100), (value) => value % 2 === 0, "even"),
        (value) => value / 2,
      ),
    );
    expect(await h.toStandard(score).parse("80")).toBe(40);
    expect(await h.toStandard(score).parse(undefined)).toBe(0);
    expect((await h.toStandard(score).safeParse("81")).issues?.[0]?.message).toBe("even");
  });

  it("emits useful JSON Schema for composed object validation", async () => {
    const schema = h.object({
      username: h.refine(h.string(), (value) => value !== "taken", "username is taken"),
      role: h.enum(["admin", "editor"]),
    });
    const invalid = await h.toStandard(schema).safeParse({ username: "taken", role: "admin" });
    expect(invalid.issues?.[0]?.path).toEqual(["username"]);
    const json = h.getJsonSchema(schema);
    expect(json).toMatchObject({ type: "object", properties: { username: { type: "string" } } });
    expect(json.required as string[]).toEqual(["username", "role"]);
  });
});
