import type { GenericRequestHandler } from "../types";

export default async function processGenericHandlers(
  req: Request,
  handlers: GenericRequestHandler[],
  index: number,
): Promise<Response> {
  if (index >= handlers.length) {
    return new Response("Not found", { status: 404 });
  }
  try {
    const handler = handlers[index];
    if (!handler) {
      return new Response("Not found", { status: 404 });
    }
    const responseResult = handler(req);
    const response = responseResult instanceof Promise ? await responseResult : responseResult;
    if (response instanceof Response) {
      return response;
    }
    return processGenericHandlers(req, handlers, index + 1);
  } catch (error) {
    console.error(`Error in generic handler: ${error}`);
    return processGenericHandlers(req, handlers, index + 1);
  }
}
