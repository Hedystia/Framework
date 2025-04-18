import { Hedystia, z } from "hedystia";
import { swagger } from "@hedystia/swagger";

const swaggerPlugin = swagger({
  title: "My API with Hedystia",
  description: "An example API using Hedystia with Swagger",
  version: "1.0.0",
  tags: [
    { name: "users", description: "User operations" },
  ],
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
      response: z.array(
        z.object({
          id: z.number(),
          name: z.string(),
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
      body: z.object({
        name: z.string(),
        email: z.email(),
      }),
      response: z.object({
        id: z.number(),
        name: z.string(),
        created: z.boolean(),
      }),
    },
  );

swaggerPlugin.captureRoutes(app);

app.use("/swagger", swaggerPlugin.plugin).listen(3000);
