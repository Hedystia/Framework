import { describe, expect, it } from "bun:test";
import { createClient } from "@hedystia/client";
import Framework, { h } from "hedystia";

describe("Framework .macro() Tests", () => {
  it("should apply macros to routes and context", async () => {
    const app = new Framework()
      .macro({
        auth: () => ({
          resolve: async (ctx) => {
            const authHeader = ctx.req.headers.get("Authorization");
            if (!authHeader || !authHeader.startsWith("Bearer ")) {
              ctx.error(401, "Unauthorized");
            }
            const token = authHeader?.substring(7);
            return { userId: 1, token };
          },
        }),
        logger: () => ({
          resolve: () => {
            return {
              log: (message: string) => console.log(`[LOG] ${message}`),
            };
          },
        }),
      })
      .get("/public", () => {
        return { message: "Public endpoint" };
      })
      .get(
        "/protected",
        async (ctx) => {
          return {
            message: "Protected endpoint",
            user: (await ctx.auth).userId,
            token: (await ctx.auth).token,
          };
        },
        {
          auth: true,
          response: h.object({
            message: h.string(),
            user: h.number(),
            token: h.string(),
          }),
        },
      )
      .get(
        "/logged",
        (ctx) => {
          ctx.logger.log("Visited logged endpoint");
          return { message: "Logged endpoint" };
        },
        {
          logger: true,
          response: h.object({
            message: h.string(),
          }),
        },
      )
      .listen(3018);

    const client = createClient<typeof app>("http://localhost:3018");

    const publicRes = await client.public.get();
    expect(publicRes.error).toBeNull();
    expect(publicRes.data?.message).toBe("Public endpoint");

    const protectedResUnauth = await fetch("http://localhost:3018/protected");
    expect(protectedResUnauth.status).toBe(401);
    expect(((await protectedResUnauth.json()) as any).message).toBe("Unauthorized");

    const protectedResAuth = await fetch("http://localhost:3018/protected", {
      headers: {
        Authorization: "Bearer test-token",
      },
    });
    expect(protectedResAuth.status).toBe(200);
    const protectedData = (await protectedResAuth.json()) as {
      message: string;
      user: number;
      token: string;
    };
    expect(protectedData.message).toBe("Protected endpoint");
    expect(protectedData.user).toBe(1);
    expect(protectedData.token).toBe("test-token");

    const loggedRes = await client.logged.get();
    expect(loggedRes.error).toBeNull();
    expect(loggedRes.data?.message).toBe("Logged endpoint");

    app.close();
  });

  it("should allow multiple macros and macro error handling", async () => {
    const app = new Framework()
      .macro({
        premiumUser: () => ({
          resolve: async (ctx) => {
            const isPremium = ctx.req.headers.get("X-User-Type") === "premium";
            if (!isPremium) {
              ctx.error(403, "Premium feature only");
            }
            return { tier: "premium" };
          },
        }),
        rateLimit: () => ({
          resolve: async (ctx) => {
            const requestsCount = Number.parseInt(ctx.req.headers.get("X-Request-Count") || "0");
            if (requestsCount > 5) {
              ctx.error(429, "Too many requests");
            }
            return { remaining: 5 - requestsCount };
          },
        }),
      })
      .get(
        "/premium-feature",
        async (ctx) => {
          return {
            feature: "Premium Content",
            tier: (await ctx.premiumUser).tier,
            requestsRemaining: (await ctx.rateLimit).remaining,
          };
        },
        {
          premiumUser: true,
          rateLimit: true,
          response: h.object({
            feature: h.string(),
            tier: h.string(),
            requestsRemaining: h.number(),
          }),
        },
      )
      .listen(3019);

    const validResponse = await fetch("http://localhost:3019/premium-feature", {
      headers: {
        "X-User-Type": "premium",
        "X-Request-Count": "3",
      },
    });
    expect(validResponse.status).toBe(200);
    const validData = (await validResponse.json()) as {
      feature: string;
      tier: string;
      requestsRemaining: number;
    };
    expect(validData.feature).toBe("Premium Content");
    expect(validData.tier).toBe("premium");
    expect(validData.requestsRemaining).toBe(2);

    const nonPremiumResponse = await fetch("http://localhost:3019/premium-feature", {
      headers: {
        "X-User-Type": "free",
        "X-Request-Count": "1",
      },
    });
    expect(nonPremiumResponse.status).toBe(403);
    expect(((await nonPremiumResponse.json()) as any).message).toBe("Premium feature only");

    const rateLimitResponse = await fetch("http://localhost:3019/premium-feature", {
      headers: {
        "X-User-Type": "premium",
        "X-Request-Count": "6",
      },
    });
    expect(rateLimitResponse.status).toBe(429);
    expect(((await rateLimitResponse.json()) as any).message).toBe("Too many requests");

    app.close();
  });
});
