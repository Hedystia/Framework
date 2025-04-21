import Hedystia, { h } from "hedystia";
import { authClient } from "./auth.client";

export const loginUsingServer = new Hedystia().group("/api", (api) =>
  api
    .post(
      "/login",
      async (ctx) => {
        try {
          const result = await authClient.signIn.email({
            email: ctx.body.email,
            password: ctx.body.password,
            fetchOptions: {
              onSuccess: (data) => {
                const tokenHeader = data.response.headers.get("set-cookie");
                if (tokenHeader) {
                  const token = parseSetCookieString(tokenHeader);
                  if (token) {
                    ctx.req.cookies.set(token.name, token.value, token.attributes);
                  }
                }
              },
            },
          });

          if (result.error) {
            return Response.json({
              token: null,
              error: result.error.message,
            });
          }

          if (result.data.token) {
            return Response.json({
              token: result.data.token,
              error: null,
            });
          }

          return Response.json({
            token: null,
            error: {
              message: "Invalid credentials",
            },
          });
        } catch (err: any) {
          return Response.json({
            token: null,
            error: err.message,
          });
        }
      },
      {
        body: h.object({
          email: h.email(),
          password: h.string(),
        }),
        response: h.object({
          token: h.options(h.string(), h.null()),
          error: h.options(h.optional(h.string()), h.null()),
        }),
      },
    )
    .post(
      "/signup",
      async (ctx) => {
        try {
          const result = await authClient.signUp.email({
            email: ctx.body.email,
            password: ctx.body.password,
            name: ctx.body.name,
            fetchOptions: {
              onSuccess: (data) => {
                const tokenHeader = data.response.headers.get("set-cookie");
                if (tokenHeader) {
                  const token = parseSetCookieString(tokenHeader);
                  if (token) {
                    ctx.req.cookies.set(token.name, token.value, token.attributes);
                  }
                }
              },
            },
          });

          if (result.error) {
            return Response.json({
              token: null,
              error: result.error.message,
            });
          }

          if (result.data.token) {
            return Response.json({
              token: result.data.token,
              error: null,
            });
          }

          return Response.json({
            token: null,
            error: {
              message: "Invalid credentials",
            },
          });
        } catch (err: any) {
          return Response.json({
            token: null,
            error: err.message,
          });
        }
      },
      {
        body: h.object({
          email: h.email(),
          password: h.string(),
          name: h.string(),
        }),
        response: h.object({
          token: h.options(h.string(), h.null()),
          error: h.options(h.optional(h.string()), h.null()),
        }),
      },
    ),
);
function parseSetCookieString(raw: string) {
  const decoded = decodeURIComponent(raw);
  const parts = decoded.split("; ");
  const cookiePair = parts.shift();
  if (!cookiePair) return null;

  const [name, ...valueParts] = cookiePair.split("=");
  const value = valueParts.join("=");

  if (!name || value === undefined) return null;

  const attrMap: Record<string, string | true> = {};

  for (const attr of parts) {
    const [attrName, ...attrValParts] = attr.split("=");
    if (!attrName) continue;
    const attrValue = attrValParts.length > 0 ? attrValParts.join("=") : true;
    attrMap[attrName.toLowerCase()] = attrValue;
  }

  return {
    name,
    value,
    attributes: attrMap,
  };
}
