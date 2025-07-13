import { Hedystia } from "../server";
import type { MacroResolveFunction, RequestHandler } from "../types";

export default function createWrappedHandler(
  handler: (ctx: any) => Response | Promise<Response> | any,
  schema: Record<string, any>,
  macrosData: Record<string, { resolve: MacroResolveFunction<any> }>,
): RequestHandler {
  const macros = Object.entries(schema)
    .filter(
      ([key]) =>
        !["params", "query", "body", "headers", "response", "description", "tags"].includes(key) &&
        schema[key] === true,
    )
    .map(([key]) => ({ key, macro: macrosData[key] }));

  return async (ctx: any): Promise<Response> => {
    if (macros.length > 0) {
      for (const { key, macro } of macros) {
        try {
          const macroResult = macro?.resolve(ctx);
          ctx[key] = macroResult instanceof Promise ? await macroResult : macroResult;
        } catch (err: any) {
          if (err.isMacroError) {
            return new Response(err.message, { status: err.statusCode });
          }
          throw err;
        }
      }
    }

    const result = handler(ctx);
    const finalResult = result instanceof Promise ? await result : result;
    return finalResult instanceof Response ? finalResult : Hedystia.createResponse(finalResult);
  };
}
