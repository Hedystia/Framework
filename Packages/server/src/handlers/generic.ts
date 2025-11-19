import type { GenericRequestHandler } from "../types";

export default async function processGenericHandlers(
  req: Request,
  handlers: GenericRequestHandler[],
  index: number,
): Promise<Response> {
  const handlersLen = handlers.length;

  if (index >= handlersLen) {
    return new Response("Not found", { status: 404 });
  }

  const handler = handlers[index];
  if (!handler) {
    return processGenericHandlers(req, handlers, index + 1);
  }

  try {
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
