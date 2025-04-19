import { z as zod } from "@zod/mini";

declare module "@zod/mini" {
  interface ZodMiniType<O = unknown, I = unknown, _Def = unknown> {
    jsonSchema: ReturnType<typeof zod.toJSONSchema>;
    inferred: zod.infer<this>;
  }
}

function withPlugin<T extends zod.ZodMiniType<any, any, any>>(schema: T): T {
  const enhanced = schema as T & {
    jsonSchema: object;
    inferred: zod.infer<T>;
  };

  Object.defineProperty(enhanced, "jsonSchema", {
    get() {
      return zod.toJSONSchema(schema);
    },
    enumerable: true,
  });

  Object.defineProperty(enhanced, "inferred", {
    get() {
      return null as unknown as zod.infer<T>;
    },
    enumerable: true,
  });

  return enhanced;
}

const handler: ProxyHandler<typeof zod> = {
  get(target, prop) {
    const orig = (target as any)[prop];
    return typeof orig === "function" ? (...args: any[]) => withPlugin(orig(...args)) : orig;
  },
};

export const z = new Proxy(zod, handler);
