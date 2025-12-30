import { afterAll, describe, expect, it } from "bun:test";
import { createClient } from "@hedystia/client";
import Framework, { h } from "hedystia";

const commentsRouter = new Framework().group("/:postId/comments", (app) =>
  app
    .get(
      "/",
      (ctx) => {
        return Response.json({
          postId: ctx.params.postId,
          comments: [{ id: 1, text: "Comment 1" }],
        });
      },
      {
        params: h.object({
          postId: h.string(),
        }),
        response: h.object({
          postId: h.string(),
          comments: h.array(
            h.object({
              id: h.number(),
              text: h.string(),
            }),
          ),
        }),
      },
    )
    .post(
      "/",
      (ctx) => {
        return Response.json({
          postId: ctx.params.postId,
          created: true,
        });
      },
      {
        params: h.object({
          postId: h.string(),
        }),
        response: h.object({
          postId: h.string(),
          created: h.boolean(),
        }),
      },
    ),
);

const subscriptionsRouter = new Framework().group("/:postId/subscribe", (app) =>
  app.post(
    "/",
    (ctx) => {
      return Response.json({
        postId: ctx.params.postId,
        subscribed: true,
      });
    },
    {
      params: h.object({
        postId: h.string(),
      }),
      response: h.object({
        postId: h.string(),
        subscribed: h.boolean(),
      }),
    },
  ),
);

const votesRouter = new Framework().group("/:postId/vote", (app) =>
  app
    .post(
      "/",
      (ctx) => {
        return Response.json({
          postId: ctx.params.postId,
          voted: true,
        });
      },
      {
        params: h.object({
          postId: h.string(),
        }),
        response: h.object({
          postId: h.string(),
          voted: h.boolean(),
        }),
      },
    )
    .delete(
      "/",
      (ctx) => {
        return Response.json({
          postId: ctx.params.postId,
          unvoted: true,
        });
      },
      {
        params: h.object({
          postId: h.string(),
        }),
        response: h.object({
          postId: h.string(),
          unvoted: h.boolean(),
        }),
      },
    ),
);

const postsRouter = new Framework().group("/posts", (app) =>
  app
    .use(commentsRouter)
    .use(subscriptionsRouter)
    .use(votesRouter)
    .get(
      "/",
      () => {
        return Response.json({
          posts: [
            { id: "post-1", title: "Post 1" },
            { id: "post-2", title: "Post 2" },
          ],
        });
      },
      {
        response: h.object({
          posts: h.array(
            h.object({
              id: h.string(),
              title: h.string(),
            }),
          ),
        }),
      },
    )
    .post(
      "/",
      (ctx) => {
        return Response.json({
          id: "new-post-id",
          title: ctx.body.title,
        });
      },
      {
        body: h.object({
          title: h.string(),
        }),
        response: h.object({
          id: h.string(),
          title: h.string(),
        }),
      },
    )
    .get(
      "/:id",
      (ctx) => {
        return Response.json({
          id: ctx.params.id,
          title: `Post ${ctx.params.id}`,
        });
      },
      {
        params: h.object({
          id: h.string(),
        }),
        response: h.object({
          id: h.string(),
          title: h.string(),
        }),
      },
    )
    .delete(
      "/:id",
      (ctx) => {
        return Response.json({
          id: ctx.params.id,
          deleted: true,
        });
      },
      {
        params: h.object({
          id: h.string(),
        }),
        response: h.object({
          id: h.string(),
          deleted: h.boolean(),
        }),
      },
    ),
);

const app = new Framework().group("/api", (app) => app.use(postsRouter)).listen(3034);

const client = createClient<typeof app>("http://localhost:3034");

describe("Framework Routes Mounting Order Tests", () => {
  it("should list all posts", async () => {
    const { data, error } = await client.api.posts.get();
    expect(error).toBeNull();
    expect(data?.posts).toHaveLength(2);
  });

  it("should create a post", async () => {
    const response = await fetch("http://localhost:3034/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Post" }),
    });
    const data = await response.json();
    expect(response.ok).toBe(true);
    expect(data.id).toBe("new-post-id");
  });

  it("should get a specific post", async () => {
    const response = await fetch("http://localhost:3034/api/posts/test-post-123");
    const data = await response.json();
    expect(response.ok).toBe(true);
    expect(data.id).toBe("test-post-123");
  });

  it("should delete a specific post", async () => {
    const response = await fetch("http://localhost:3034/api/posts/test-post-123", {
      method: "DELETE",
    });
    const data = await response.json();
    expect(response.ok).toBe(true);
    expect(data.deleted).toBe(true);
  });

  it("should get comments for a post", async () => {
    const response = await fetch("http://localhost:3034/api/posts/test-post-id/comments");
    const data = await response.json();
    expect(response.ok).toBe(true);
    expect(data.postId).toBe("test-post-id");
    expect(data.comments).toBeDefined();
  });

  it("should create a comment for a post", async () => {
    const response = await fetch("http://localhost:3034/api/posts/test-post-id/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "New comment" }),
    });
    const data = await response.json();
    expect(response.ok).toBe(true);
    expect(data.postId).toBe("test-post-id");
    expect(data.created).toBe(true);
  });

  it("should subscribe to a post", async () => {
    const response = await fetch("http://localhost:3034/api/posts/test-post-id/subscribe", {
      method: "POST",
    });
    const data = await response.json();
    expect(response.ok).toBe(true);
    expect(data.postId).toBe("test-post-id");
    expect(data.subscribed).toBe(true);
  });

  it("should vote on a post", async () => {
    const response = await fetch("http://localhost:3034/api/posts/test-post-id/vote", {
      method: "POST",
    });
    const data = await response.json();
    expect(response.ok).toBe(true);
    expect(data.postId).toBe("test-post-id");
    expect(data.voted).toBe(true);
  });

  it("should remove vote from a post", async () => {
    const response = await fetch("http://localhost:3034/api/posts/test-post-id/vote", {
      method: "DELETE",
    });
    const data = await response.json();
    expect(response.ok).toBe(true);
    expect(data.postId).toBe("test-post-id");
    expect(data.unvoted).toBe(true);
  });

  afterAll(() => {
    app.close();
  });
});

const postsRouter2 = new Framework().group("/posts", (app) =>
  app
    .get(
      "/",
      () => {
        return Response.json({
          posts: [{ id: "post-1", title: "Post 1" }],
        });
      },
      {
        response: h.object({
          posts: h.array(h.object({ id: h.string(), title: h.string() })),
        }),
      },
    )
    .get(
      "/:id",
      (ctx) => {
        return Response.json({
          id: ctx.params.id,
          title: `Post ${ctx.params.id}`,
        });
      },
      {
        params: h.object({ id: h.string() }),
        response: h.object({ id: h.string(), title: h.string() }),
      },
    )
    .use(commentsRouter)
    .use(subscriptionsRouter)
    .use(votesRouter),
);

const app2 = new Framework().group("/api", (app) => app.use(postsRouter2)).listen(3033);

describe("Framework Routes - Routes Before Use", () => {
  it("should list all posts", async () => {
    const response = await fetch("http://localhost:3033/api/posts");
    const data = await response.json();
    expect(response.ok).toBe(true);
    expect(data.posts).toBeDefined();
  });

  it("should get a specific post when routes defined before .use()", async () => {
    const response = await fetch("http://localhost:3033/api/posts/test-post-123");
    const data = await response.json();
    expect(response.ok).toBe(true);
    expect(data.id).toBe("test-post-123");
  });

  it("should get comments when routes defined before .use()", async () => {
    const response = await fetch("http://localhost:3033/api/posts/test-post-id/comments");
    const data = await response.json();
    expect(response.ok).toBe(true);
    expect(data.comments).toBeDefined();
  });

  afterAll(() => {
    app2.close();
  });
});
