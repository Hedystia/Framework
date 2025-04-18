import { Hedystia } from "hedystia";
import { Swagger, type SwaggerOptions } from "./swagger";

export function swagger(options: SwaggerOptions = {}) {
  const swaggerInstance = new Swagger(options);

  const swaggerApp = new Hedystia()
    .get("/", () => {
      return new Response(swaggerInstance.generateHTML(), {
        headers: { "Content-Type": "text/html" },
      });
    })
    .get("/json", () => {
      return Response.json(swaggerInstance.getSpec());
    });

  return {
    plugin: swaggerApp,
    swagger: swaggerInstance,
    captureRoutes: (app: any) => {
      if (app && app.routes) {
        for (const route of app.routes) {
          const routeSchema = {
            params: route.schema.params ? app.toJSONSchema(route.schema.params) : undefined,
            query: route.schema.query ? app.toJSONSchema(route.schema.query) : undefined,
            body: route.schema.body ? app.toJSONSchema(route.schema.body) : undefined,
            response: route.schema.response ? app.toJSONSchema(route.schema.response) : undefined,
          };

          swaggerInstance.addRoute(
            route.method,
            route.path,
            routeSchema,
            route.schema.description || `${route.method} ${route.path}`,
            route.schema.description,
            route.schema.tags,
          );
        }
      }
    },
  };
}
