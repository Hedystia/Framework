import { swagger } from "@hedystia/swagger";
import { Hedystia, h } from "hedystia";

const swaggerPlugin = swagger({
  title: "My API with Hedystia",
  description: "An example API using Hedystia with Swagger",
  version: "1.0.0",
  tags: [
    {
      name: "Users",
      description: "User path",
    },
  ],
});

const app = new Hedystia()
  .get("/hello", () => "Hello", {
    response: h.string(),
    description: "Hello :D",
    error: h.string(),
  })
  .post("/user", (ctx) => ({ id: 1, name: ctx.body.name }), {
    response: h.object({
      id: h.number(),
      name: h.string().maxLength(10),
    }),
    headers: h.object({
      authorization: h.string(),
    }),
    tags: ["Users"],
  })
  .put("/user/:id", (ctx) => ({ id: 1, name: ctx.body.name }), {
    params: h.object({
      id: h.number(),
    }),
    body: h.object({
      name: h.string().maxLength(10),
      email: h.optional(h.email()),
    }),
    response: h.object({
      id: h.number(),
      name: h.string().maxLength(10),
    }),
    headers: h.object({
      Authorization: h.string(),
    }),
    tags: ["Users"],
    description: "Update user data",
  })
  .group("/admin", (g) =>
    g
      .get("/dash", () => "Admin", {
        response: h.string(),
      })
      .group("/deep", (d) =>
        d.get("/nested", () => "Deep nested route", {
          response: h.string(),
        }),
      ),
  )
  .static(
    "/info",
    { body: { version: "1.0.0" } },
    {
      response: h.object({
        version: h.string(),
      }),
    },
  )
  .ws("/live", { message: (ws, msg) => ws.send("Echo: " + msg) })
  .subscription(
    "/events/:id",
    (ctx) => {
      ctx.sendData({ event: ctx.params.id });
    },
    {
      data: h.object({
        event: h.number(),
      }),
      params: h.object({
        id: h.number(),
      }),
      error: h.string(),
    },
  );

app.use("/swagger", swaggerPlugin.plugin(app));

app.listen(3000);
