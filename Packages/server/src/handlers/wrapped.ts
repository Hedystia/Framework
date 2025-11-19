import { Hedystia } from "../server";
import type { MacroResolveFunction, RequestHandler } from "../types";

export default function createWrappedHandler(
  handler: (ctx: any) => Response | Promise<Response> | any,
  schema: Record<string, any>,
  macrosData: Record<string, { resolve: MacroResolveFunction<any> }>,
): RequestHandler {
  const macroKeys: string[] = [];
  const macroResolvers: MacroResolveFunction<any>[] = [];

  for (const key in schema) {
    if (
      key !== "params" &&
      key !== "query" &&
      key !== "body" &&
      key !== "headers" &&
      key !== "response" &&
      key !== "description" &&
      key !== "tags" &&
      schema[key] === true
    ) {
      const macro = macrosData[key];
      if (macro) {
        macroKeys.push(key);
        macroResolvers.push(macro.resolve);
      }
    }
  }

  const hasMacros = macroKeys.length > 0;

  if (!hasMacros) {
    return async (ctx: any): Promise<Response> => {
      const result = handler(ctx);
      const finalResult = result instanceof Promise ? await result : result;
      return finalResult instanceof Response ? finalResult : Hedystia.createResponse(finalResult);
    };
  }

  return async (ctx: any): Promise<Response> => {
    const macroLen = macroKeys.length;
    for (let i = 0; i < macroLen; i++) {
      const key = macroKeys[i];
      const resolver = macroResolvers[i];
      try {
        if (resolver && key) {
          const macroResult = resolver(ctx);
          ctx[key] = macroResult instanceof Promise ? await macroResult : macroResult;
        }
      } catch (err: any) {
        if (err.isMacroError) {
          return new Response(err.message, { status: err.statusCode });
        }
        throw err;
      }
    }

    const result = handler(ctx);
    const finalResult = result instanceof Promise ? await result : result;
    return finalResult instanceof Response ? finalResult : Hedystia.createResponse(finalResult);
  };
}
