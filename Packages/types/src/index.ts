import { writeFile } from "fs/promises";
import type { RouteInfo } from "./types";
import { schemaToTypeString } from "./utils";

export async function generateTypes(routes: RouteInfo[], filePath: string): Promise<void> {
  const typeDefinitions = routes
    .map((route) => {
      const responseType = schemaToTypeString(route.response);
      const paramsType = schemaToTypeString(route.params);
      const queryType = schemaToTypeString(route.query);
      const bodyType = schemaToTypeString(route.body);
      const headersType = schemaToTypeString(route.headers);
      const dataType = schemaToTypeString(route.data);
      const errorType = schemaToTypeString(route.error);
      return `{method:"${route.method}";path:"${route.path}";params:${paramsType};query:${queryType};body:${bodyType};headers:${headersType};response:${responseType};data:${dataType};error:${errorType}}`;
    })
    .join(",");

  const content = `// Automatic Hedystia type generation\nexport type AppRoutes=[${typeDefinitions}];`;
  await writeFile(filePath, content, "utf8");
}
export type { TypeGeneratorOptions } from "./types";
export type { RouteInfo };
export { schemaToTypeString };
