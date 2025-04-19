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
            params: route.schema.params ? route.schema.params.jsonSchema : undefined,
            query: route.schema.query ? route.schema.query.jsonSchema : undefined,
            body: route.schema.body ? route.schema.body.jsonSchema : undefined,
            response: route.schema.response ? route.schema.response.jsonSchema : undefined,
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
