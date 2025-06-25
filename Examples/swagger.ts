import { swagger } from "@hedystia/swagger";
import { Hedystia, h } from "hedystia";

const swaggerPlugin = swagger({
  title: "My API with Hedystia",
  description: "An example API using Hedystia with Swagger",
  version: "1.0.0",
  tags: [{ name: "users", description: "User operations" }],
});

const app = new Hedystia()
  .get(
    "/users",
    () => {
      return [
        { id: 1, name: "Usuario 1" },
        { id: 2, name: "Usuario 2" },
      ];
    },
    {
      response: h.array(
        h.object({
          id: h.number(),
          name: h.string(),
        }),
      ),
      tags: ["users"],
    },
  )
  .post(
    "/users",
    (ctx) => {
      return { id: 3, name: ctx.body.name, created: true };
    },
    {
      body: h.object({
        name: h.string(),
        email: h.email(),
      }),
      response: h.object({
        id: h.number(),
        name: h.string(),
        created: h.boolean(),
      }),
    },
  );

swaggerPlugin.captureRoutes(app);

app.use("/swagger", swaggerPlugin.plugin).listen(3000);
