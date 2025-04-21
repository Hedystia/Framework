import Hedystia from "hedystia";

import { auth } from "./auth";
import { client } from "./client";
import { loginUsingServer } from "./server.login";

const macro_handler = new Hedystia()
  .macro({
    auth: () => ({
      resolve: async (ctx) => {
        const session = await auth.api.getSession({
          headers: ctx.req.headers,
        });

        if (!session) {
          macro_handler.error(401, "Unauthorized");
        }

        return {
          user: session?.user,
          session: session?.session,
        };
      },
    }),
  })
  .get(
    "/protected",
    () => {
      return Response.json({
        message: "Protected endpoint",
      });
    },
    {
      auth: true,
    },
  );

new Hedystia()
  .handle(auth.handler)
  .use(macro_handler)
  .get("/", () => {
    return Response.json({
      message: "Public endpoint",
    });
  })
  .use(client)
  .get(
    "/me",
    (ctx) => {
      return Response.json(ctx.auth);
    },
    {
      auth: true,
    },
  )
  .use(loginUsingServer)
  .listen(3000);

console.log("Server started on port 3000");
