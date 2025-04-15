import type { Framework } from "./server";
import type { RouteDefinition } from "./types/routes";

type HttpMethod = "GET" | "PATCH" | "POST" | "PUT" | "DELETE";
type ResponseFormat = "json" | "text" | "formData" | "bytes" | "arrayBuffer" | "blob";

type PathParts<Path extends string> = Path extends `/${infer Rest}`
  ? Rest extends `${infer Head}/${infer Tail}`
    ? [Head, ...PathParts<`/${Tail}`>]
    : [Rest]
  : [];

type DeleteRequestFunction<B, Q, ResponseType> = (
  body?: B,
  query?: Q,
  options?: { responseFormat?: ResponseFormat },
) => Promise<{ error: any | null; data: ResponseType | null }>;

type RequestFunction<Q, ResponseType> = (
  query?: Q,
  options?: { responseFormat?: ResponseFormat },
) => Promise<{
  error: any | null;
  data: ResponseType | null;
}>;

type PatchRequestFunction<B, Q, ResponseType> = (
  body?: B,
  query?: Q,
  options?: { responseFormat?: ResponseFormat },
) => Promise<{ error: any | null; data: ResponseType | null }>;

type PostRequestFunction<B, Q, ResponseType> = (
  body?: B,
  query?: Q,
  options?: { responseFormat?: ResponseFormat },
) => Promise<{ error: any | null; data: ResponseType | null }>;

type PutRequestFunction<B, Q, ResponseType> = (
  body?: B,
  query?: Q,
  options?: { responseFormat?: ResponseFormat },
) => Promise<{ error: any | null; data: ResponseType | null }>;

type RouteToTreeInner<T extends string[], Params, Methods> = T extends [
  infer H extends string,
  ...infer R extends string[],
]
  ? H extends `:${infer Param}`
    ? {
        [K in Param]: (value: Params[K & keyof Params]) => RouteToTreeInner<R, Params, Methods>;
      }
    : {
        [K in H]: RouteToTreeInner<R, Params, Methods>;
      }
  : Methods;

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void
  ? I
  : never;

type MergeMethodObjects<T> = {
  [K in keyof T]: T[K] extends never ? never : T[K];
};

type RouteDefinitionsToMethodsObjects<Routes> = Routes extends {
  path: infer P extends string;
  params: infer Params;
  method: infer M;
  query?: infer Query;
  body?: infer Body;
  response?: infer Response;
}
  ? [M, P, Params, Query, Body, Response]
  : never;

type GroupedRoutes<Routes> = {
  [P in RouteDefinitionsToMethodsObjects<Routes>[1]]: {
    params: Extract<RouteDefinitionsToMethodsObjects<Routes>, [any, P, any, any, any, any]>[2];
    methods: MergeMethodObjects<{
      get: Extract<
        RouteDefinitionsToMethodsObjects<Routes>,
        ["GET", P, any, any, any, any]
      >[0] extends "GET"
        ? RequestFunction<
            Extract<RouteDefinitionsToMethodsObjects<Routes>, ["GET", P, any, any, any, any]>[3],
            Extract<RouteDefinitionsToMethodsObjects<Routes>, ["GET", P, any, any, any, any]>[5]
          >
        : never;
      patch: Extract<
        RouteDefinitionsToMethodsObjects<Routes>,
        ["PATCH", P, any, any, any, any]
      >[0] extends "PATCH"
        ? PatchRequestFunction<
            Extract<RouteDefinitionsToMethodsObjects<Routes>, ["PATCH", P, any, any, any, any]>[4],
            Extract<RouteDefinitionsToMethodsObjects<Routes>, ["PATCH", P, any, any, any, any]>[3],
            Extract<RouteDefinitionsToMethodsObjects<Routes>, ["PATCH", P, any, any, any, any]>[5]
          >
        : never;
      post: Extract<
        RouteDefinitionsToMethodsObjects<Routes>,
        ["POST", P, any, any, any, any]
      >[0] extends "POST"
        ? PostRequestFunction<
            Extract<RouteDefinitionsToMethodsObjects<Routes>, ["POST", P, any, any, any, any]>[4],
            Extract<RouteDefinitionsToMethodsObjects<Routes>, ["POST", P, any, any, any, any]>[3],
            Extract<RouteDefinitionsToMethodsObjects<Routes>, ["POST", P, any, any, any, any]>[5]
          >
        : never;
      put: Extract<
        RouteDefinitionsToMethodsObjects<Routes>,
        ["PUT", P, any, any, any, any]
      >[0] extends "PUT"
        ? PutRequestFunction<
            Extract<RouteDefinitionsToMethodsObjects<Routes>, ["PUT", P, any, any, any, any]>[4],
            Extract<RouteDefinitionsToMethodsObjects<Routes>, ["PUT", P, any, any, any, any]>[3],
            Extract<RouteDefinitionsToMethodsObjects<Routes>, ["PUT", P, any, any, any, any]>[5]
          >
        : never;
      delete: Extract<
        RouteDefinitionsToMethodsObjects<Routes>,
        ["DELETE", P, any, any, any, any]
      >[0] extends "DELETE"
        ? DeleteRequestFunction<
            Extract<RouteDefinitionsToMethodsObjects<Routes>, ["DELETE", P, any, any, any, any]>[4],
            Extract<RouteDefinitionsToMethodsObjects<Routes>, ["DELETE", P, any, any, any, any]>[3],
            Extract<RouteDefinitionsToMethodsObjects<Routes>, ["DELETE", P, any, any, any, any]>[5]
          >
        : never;
    }>;
  };
};

type RouteToTree<Path extends string, Params, Methods> = PathParts<Path> extends [
  infer H extends string,
  ...infer T extends string[],
]
  ? H extends `:${infer Param}`
    ? {
        [K in Param]: (value: Params[K & keyof Params]) => RouteToTreeInner<T, Params, Methods>;
      }
    : {
        [K in H]: RouteToTreeInner<T, Params, Methods>;
      }
  : {};

type ClientTree<R> = UnionToIntersection<
  {
    [P in keyof GroupedRoutes<R>]: RouteToTree<
      P & string,
      GroupedRoutes<R>[P]["params"],
      GroupedRoutes<R>[P]["methods"]
    >;
  }[keyof GroupedRoutes<R>]
>;

type ExtractRoutes<T extends RouteDefinition[]> = T[number];

type ExtractRoutesFromFramework<T> = T extends Framework<infer R> ? ExtractRoutes<R> : never;

async function processResponse(response: Response, format: ResponseFormat = "json") {
  try {
    const contentType = response.headers.get("Content-Type") || "";

    if (
      ((format === "text" || contentType.includes("text/plain")) && format !== "blob") ||
      (contentType.includes("text/html") && format !== "blob")
    ) {
      return await response.text();
    }

    switch (format) {
      case "json":
        return await response.json().catch(() => null);
      case "formData":
        return await response.formData();
      case "bytes":
        return new Uint8Array(await response.arrayBuffer());
      case "arrayBuffer":
        return await response.arrayBuffer();
      case "blob":
        return await response.blob();
      default:
        return await response.json().catch(() => null);
    }
  } catch (error) {
    console.error(`Error processing ${format} response:`, error);
    return null;
  }
}

export function createClient<T extends Framework<any>>(
  baseUrl: string,
): ClientTree<ExtractRoutesFromFramework<T>> {
  const HTTP_METHODS = ["get", "put", "post", "patch", "delete"];

  const createProxy = (segments: string[] = []): any => {
    const proxyTarget = () => {};
    return new Proxy(proxyTarget, {
      get(_target, prop: string | symbol, receiver) {
        if (typeof prop !== "string") {
          return Reflect.get(_target, prop, receiver);
        }
        if (prop === "then") {
          return undefined;
        }
        return createProxy([...segments, prop]);
      },
      apply(_target, _thisArg, args) {
        const lastSegment = segments[segments.length - 1];
        if (lastSegment && HTTP_METHODS.includes(lastSegment.toLowerCase())) {
          const method = lastSegment.toUpperCase() as HttpMethod;
          const newSegments = segments.slice(0, segments.length - 1);
          const fullPath = newSegments.length ? "/" + newSegments.join("/") : "";
          const url = new URL(fullPath, baseUrl);

          let body: any,
            query: any,
            options: any = {};

          if (method === "GET") {
            query = args[0];
            options = args[1] || {};
          } else {
            body = args[0];
            query = args[1];
            options = args[2] || {};
          }

          const responseFormat = options.responseFormat || "json";

          if (query && typeof query === "object") {
            url.search = new URLSearchParams(query as any).toString();
          }

          const init: RequestInit = {
            method,
            headers: {
              "Content-Type": "application/json",
            },
          };
          if (body !== undefined && method !== "GET") {
            init.body = JSON.stringify(body);
          }

          return (async () => {
            try {
              const res = await fetch(url.toString(), init);

              if (!res.ok) {
                throw new Error(`HTTP error! Status: ${res.status}`);
              }

              const data = await processResponse(res, responseFormat);
              return { error: null, data };
            } catch (error) {
              return { error, data: null };
            }
          })();
        } else {
          const value = args[0];
          const newSegments = segments.slice(0, segments.length - 1).concat(String(value));
          return createProxy(newSegments);
        }
      },
    });
  };

  return createProxy();
}
