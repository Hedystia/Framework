import SwaggerParser from "@apidevtools/swagger-parser";
import type { OpenAPI } from "openapi-types";

export interface SwaggerOptions {
  title?: string;
  description?: string;
  version?: string;
  basePath?: string;
  schemes?: string[];
  consumes?: string[];
  produces?: string[];
  tags?: { name: string; description?: string }[];
  securityDefinitions?: Record<string, any>;
  externalDocs?: { description: string; url: string };
  host?: string;
}

export class Swagger {
  private spec: OpenAPI.Document = {
    openapi: "3.0.0",
    info: {
      title: "API Documentation",
      version: "1.0.0",
    },
    paths: {},
    components: {
      schemas: {},
    },
  } as OpenAPI.Document;

  constructor(options: SwaggerOptions = {}) {
    this.spec.info.title = options.title || "API Documentation";
    this.spec.info.description = options.description;
    this.spec.info.version = options.version || "1.0.0";

    if (options.tags) {
      this.spec.tags = options.tags;
    }

    if (options.externalDocs) {
      this.spec.externalDocs = options.externalDocs;
    }

    if (options.securityDefinitions) {
      (this.spec as any).components = (this.spec as any).components || {};
      (this.spec as any).components.securitySchemes = options.securityDefinitions;
    }
  }

  addRoute(
    method: string,
    path: string,
    schema: any,
    summary?: string,
    description?: string,
    tags?: string[],
  ) {
    if (!schema) return;

    const normalizedPath = path.replace(/:([^/]+)/g, "{$1}");

    if (!this.spec.paths) {
      this.spec.paths = {};
    }

    if (!this.spec.paths[normalizedPath]) {
      this.spec.paths[normalizedPath] = {};
    }

    const methodLower = method.toLowerCase();

    const operationObject: any = {
      summary: summary || `${method} ${path}`,
      parameters: this.buildParameters(schema),
      requestBody: this.buildRequestBody(schema),
      responses: this.buildResponses(schema),
    };

    if (description) {
      operationObject.description = description;
    }

    if (tags) {
      operationObject.tags = tags;
    }

    (this.spec.paths as any)[normalizedPath][methodLower] = operationObject;
  }

  private buildParameters(schema: any) {
    const parameters: any[] = [];

    if (schema.params) {
      try {
        const jsonSchema = schema.params;
        if (jsonSchema.properties) {
          Object.entries(jsonSchema.properties).forEach(([name, propSchema]: [string, any]) => {
            parameters.push({
              name,
              in: "path",
              required: jsonSchema.required?.includes(name) ?? true,
              schema: propSchema,
            });
          });
        }
      } catch (e) {
        console.error("Failed to convert params schema:", e);
      }
    }

    if (schema.query) {
      try {
        const jsonSchema = schema.query;
        if (jsonSchema.properties) {
          Object.entries(jsonSchema.properties).forEach(([name, propSchema]: [string, any]) => {
            parameters.push({
              name,
              in: "query",
              required: jsonSchema.required?.includes(name) ?? false,
              schema: propSchema,
            });
          });
        }
      } catch (e) {
        console.error("Failed to convert query schema:", e);
      }
    }

    return parameters.length > 0 ? parameters : undefined;
  }

  private buildRequestBody(schema: any) {
    if (!schema.body) return undefined;

    try {
      const jsonSchema = schema.body;
      return {
        required: true,
        content: {
          "application/json": {
            schema: jsonSchema,
          },
        },
      };
    } catch (e) {
      console.error("Failed to convert body schema:", e);
      return undefined;
    }
  }

  private buildResponses(schema: any) {
    const responses: Record<string, any> = {
      "200": {
        description: "Successful response",
      },
    };

    if (schema.response) {
      try {
        const jsonSchema = schema.response;
        responses["200"].content = {
          "application/json": {
            schema: jsonSchema,
          },
        };
      } catch (e) {
        console.error("Failed to convert response schema:", e);
      }
    }

    return responses;
  }

  async validate() {
    try {
      await SwaggerParser.validate(this.spec as any);
      return true;
    } catch (error) {
      console.error("Swagger validation error:", error);
      return false;
    }
  }

  getSpec() {
    return this.spec;
  }

  generateHTML() {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.spec.info.title}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.9.0/swagger-ui.css">
  <style>
    :root {
      --primary-color: #3b82f6;
      --primary-dark: #1d4ed8;
      --secondary-color: #64748b;
      --background-color: #f8fafc;
      --card-background: #ffffff;
      --text-color: #1e293b;
      --border-color: #e2e8f0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      margin: 0;
      padding: 0;
      background-color: var(--background-color);
      color: var(--text-color);
    }

    .header {
      background: linear-gradient(135deg, var(--primary-color), var(--primary-dark));
      color: white;
      padding: 2rem;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }

    .container {
      width: 100%;
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 1rem;
    }

    .header-content {
      max-width: 1200px;
      margin: 0 auto;
    }

    .title {
      font-size: 2.25rem;
      font-weight: 700;
      margin: 0;
      line-height: 1.2;
    }

    .description {
      margin-top: 0.75rem;
      font-size: 1.125rem;
      opacity: 0.9;
    }

    .version {
      display: inline-block;
      background-color: rgba(255, 255, 255, 0.2);
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.875rem;
      margin-top: 0.75rem;
    }

    .main {
      padding: 2rem 0;
    }

    .swagger-container {
      background-color: var(--card-background);
      border-radius: 0.5rem;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      padding: 1rem;
      margin-bottom: 2rem;
    }

    .swagger-ui .topbar {
      display: none;
    }

    .swagger-ui .info {
      margin: 20px 0;
    }

    .swagger-ui .opblock-tag {
      font-size: 1.25rem;
      border-bottom: 1px solid var(--border-color);
      padding: 10px 0;
    }

    .swagger-ui .opblock {
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      margin: 0 0 15px;
    }

    .swagger-ui .opblock .opblock-summary {
      padding: 8px 20px;
    }

    .swagger-ui .btn {
      border-radius: 4px;
    }

    .footer {
      background-color: #1e293b;
      color: white;
      padding: 1.5rem 0;
      text-align: center;
      margin-top: 2rem;
    }

    .footer-content {
      font-size: 0.875rem;
      opacity: 0.8;
    }

    .footer-link {
      color: white;
      text-decoration: underline;
      margin: 0 0.5rem;
    }

    /* Responsive adjustments */
    @media (max-width: 768px) {
      .header {
        padding: 1.5rem 1rem;
      }

      .title {
        font-size: 1.75rem;
      }

      .swagger-ui .wrapper {
        padding: 0;
      }

      .swagger-ui .opblock .opblock-summary {
        padding: 8px 10px;
      }
    }
  </style>
</head>
<body>
  <header class="header">
    <div class="header-content">
      <h1 class="title">${this.spec.info.title}</h1>
      ${this.spec.info.description ? `<p class="description">${this.spec.info.description}</p>` : ""}
      <span class="version">Version ${this.spec.info.version}</span>
    </div>
  </header>

  <main class="main">
    <div class="container">
      <div class="swagger-container">
        <div id="swagger-ui"></div>
      </div>
    </div>
  </main>

  <footer class="footer">
    <div class="container">
      <div class="footer-content">
        <p>Powered by Hedystia</p>
        <div>
          <a href="https://github.com/Hedystia/Framework" class="footer-link" target="_blank">GitHub</a>
          <a href="/swagger/json" class="footer-link" target="_blank">Raw JSON</a>
        </div>
      </div>
    </div>
  </footer>

  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.9.0/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      const ui = SwaggerUIBundle({
        spec: ${JSON.stringify(this.spec)},
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout",
        docExpansion: "list",
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 1,
        syntaxHighlight: {
          activated: true,
          theme: "agate"
        },
        filter: true,
        withCredentials: true,
        persistAuthorization: true
      });
    };
  </script>
</body>
</html>
  `;
  }
}
