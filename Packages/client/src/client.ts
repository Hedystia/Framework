import type { Hedystia, RouteDefinition } from "hedystia";

type ResponseFormat = "json" | "text" | "formData" | "bytes" | "arrayBuffer" | "blob";

type PathParts<Path extends string> = Path extends `/${infer Rest}`
  ? Rest extends ""
    ? [""]
    : Rest extends `${infer Head}/${infer Tail}`
      ? Tail extends ""
        ? [Head]
        : [Head, ...PathParts<`/${Tail}`>]
      : [Rest]
  : [];

type DeleteRequestFunction<B, Q, ResponseType, H> = (
  body?: B,
  query?: Q,
  options?: { responseFormat?: ResponseFormat; headers?: H },
) => Promise<{ error: any | null; data: ResponseType | null; status: number; ok: boolean }>;

type RequestFunction<Q, ResponseType, H> = (
  query?: Q,
  options?: { responseFormat?: ResponseFormat; headers?: H },
) => Promise<{
  error: any | null;
  data: ResponseType | null;
  status: number;
  ok: boolean;
}>;

type PatchRequestFunction<B, Q, ResponseType, H> = (
  body?: B,
  query?: Q,
  options?: { responseFormat?: ResponseFormat; headers?: H },
) => Promise<{ error: any | null; data: ResponseType | null; status: number; ok: boolean }>;

type PostRequestFunction<B, Q, ResponseType, H> = (
  body?: B,
  query?: Q,
  options?: { responseFormat?: ResponseFormat; headers?: H },
) => Promise<{ error: any | null; data: ResponseType | null; status: number; ok: boolean }>;

type PutRequestFunction<B, Q, ResponseType, H> = (
  body?: B,
  query?: Q,
  options?: { responseFormat?: ResponseFormat; headers?: H },
) => Promise<{ error: any | null; data: ResponseType | null; status: number; ok: boolean }>;

type RouteToTreeInner<T extends string[], Params, Methods> = T extends [
  infer H extends string,
  ...infer R extends string[],
]
  ? H extends `:${infer Param}`
    ? {
        [K in Param]: (value: Params[K & keyof Params]) => RouteToTreeInner<R, Params, Methods>;
      }
    : H extends ""
      ? Methods & RouteToTreeInner<R, Params, Methods>
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
  headers?: infer Headers;
}
  ? [M, P, Params, Query, Body, Response, Headers]
  : never;

type GroupedRoutes<Routes> = {
  [P in RouteDefinitionsToMethodsObjects<Routes>[1]]: {
    params: Extract<RouteDefinitionsToMethodsObjects<Routes>, [any, P, any, any, any, any, any]>[2];
    methods: MergeMethodObjects<{
      get: Extract<
        RouteDefinitionsToMethodsObjects<Routes>,
        ["GET", P, any, any, any, any, any]
      >[0] extends "GET"
        ? RequestFunction<
            Extract<
              RouteDefinitionsToMethodsObjects<Routes>,
              ["GET", P, any, any, any, any, any]
            >[3],
            Extract<
              RouteDefinitionsToMethodsObjects<Routes>,
              ["GET", P, any, any, any, any, any]
            >[5],
            Extract<
              RouteDefinitionsToMethodsObjects<Routes>,
              ["GET", P, any, any, any, any, any]
            >[6]
          >
        : never;
      patch: Extract<
        RouteDefinitionsToMethodsObjects<Routes>,
        ["PATCH", P, any, any, any, any, any]
      >[0] extends "PATCH"
        ? PatchRequestFunction<
            Extract<
              RouteDefinitionsToMethodsObjects<Routes>,
              ["PATCH", P, any, any, any, any, any]
            >[4],
            Extract<
              RouteDefinitionsToMethodsObjects<Routes>,
              ["PATCH", P, any, any, any, any, any]
            >[3],
            Extract<
              RouteDefinitionsToMethodsObjects<Routes>,
              ["PATCH", P, any, any, any, any, any]
            >[5],
            Extract<
              RouteDefinitionsToMethodsObjects<Routes>,
              ["PATCH", P, any, any, any, any, any]
            >[6]
          >
        : never;
      post: Extract<
        RouteDefinitionsToMethodsObjects<Routes>,
        ["POST", P, any, any, any, any, any]
      >[0] extends "POST"
        ? PostRequestFunction<
            Extract<
              RouteDefinitionsToMethodsObjects<Routes>,
              ["POST", P, any, any, any, any, any]
            >[4],
            Extract<
              RouteDefinitionsToMethodsObjects<Routes>,
              ["POST", P, any, any, any, any, any]
            >[3],
            Extract<
              RouteDefinitionsToMethodsObjects<Routes>,
              ["POST", P, any, any, any, any, any]
            >[5],
            Extract<
              RouteDefinitionsToMethodsObjects<Routes>,
              ["POST", P, any, any, any, any, any]
            >[6]
          >
        : never;
      put: Extract<
        RouteDefinitionsToMethodsObjects<Routes>,
        ["PUT", P, any, any, any, any, any]
      >[0] extends "PUT"
        ? PutRequestFunction<
            Extract<
              RouteDefinitionsToMethodsObjects<Routes>,
              ["PUT", P, any, any, any, any, any]
            >[4],
            Extract<
              RouteDefinitionsToMethodsObjects<Routes>,
              ["PUT", P, any, any, any, any, any]
            >[3],
            Extract<
              RouteDefinitionsToMethodsObjects<Routes>,
              ["PUT", P, any, any, any, any, any]
            >[5],
            Extract<
              RouteDefinitionsToMethodsObjects<Routes>,
              ["PUT", P, any, any, any, any, any]
            >[6]
          >
        : never;
      delete: Extract<
        RouteDefinitionsToMethodsObjects<Routes>,
        ["DELETE", P, any, any, any, any, any]
      >[0] extends "DELETE"
        ? DeleteRequestFunction<
            Extract<
              RouteDefinitionsToMethodsObjects<Routes>,
              ["DELETE", P, any, any, any, any, any]
            >[4],
            Extract<
              RouteDefinitionsToMethodsObjects<Routes>,
              ["DELETE", P, any, any, any, any, any]
            >[3],
            Extract<
              RouteDefinitionsToMethodsObjects<Routes>,
              ["DELETE", P, any, any, any, any, any]
            >[5],
            Extract<
              RouteDefinitionsToMethodsObjects<Routes>,
              ["DELETE", P, any, any, any, any, any]
            >[6]
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
    : H extends ""
      ? Methods & RouteToTreeInner<T, Params, Methods>
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

type ExtractRoutesFromFramework<T> = T extends Hedystia<infer R>
  ? ExtractRoutes<R>
  : T extends RouteDefinition[]
    ? T[number]
    : never;

async function parseFormData(response: Response): Promise<FormData> {
  if (!response.ok) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }
  const contentType = response.headers.get("Content-Type") || "";
  if (contentType.includes("multipart/form-data")) {
    const text = await response.text();
    const formData = new FormData();
    const boundary = contentType.split("boundary=")[1];
    if (boundary) {
      const parts = text.split(`--${boundary}`);
      for (const part of parts) {
        if (part.trim() && !part.includes("--\r\n")) {
          const [headerPart, bodyPart] = part.split("\r\n\r\n");
          if (headerPart && bodyPart) {
            const nameMatch = headerPart.match(/name="([^"]+)"/);
            const filenameMatch = headerPart.match(/filename="([^"]+)"/);
            if (nameMatch) {
              const name = nameMatch[1];
              if (filenameMatch) {
                const filename = filenameMatch[1];
                const contentTypeMatch = headerPart.match(/Content-Type: (.+)/);
                const type = contentTypeMatch ? contentTypeMatch[1]?.trim() : "";

                const blob = new Blob([bodyPart.slice(0, -2)], { type });
                const file = new File([blob], String(filename), { type });

                formData.append(String(name), file);
              } else {
                formData.append(String(name), bodyPart.slice(0, -2));
              }
            }
          }
        }
      }
    }
    return formData;
  } else {
    const text = await response.text();
    const formData = new FormData();
    const params = new URLSearchParams(text);
    for (const [key, value] of params.entries()) {
      formData.append(key, value);
    }
    return formData;
  }
}

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
        return await parseFormData(response);
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

/**
 * Create client for Hedystia framework
 * @param {string} baseUrl - Base URL for client
 * @returns {ClientTree<ExtractRoutesFromFramework<T>>} Client instance
 */
export function createClient<T extends Hedystia<any> | RouteDefinition[]>(
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
        if (HTTP_METHODS.includes(prop.toLowerCase())) {
          return createProxy([...segments, prop]);
        }
        return createProxy([...segments, prop]);
      },
      apply(_target, _thisArg, args) {
        const lastSegment = segments[segments.length - 1];
        if (lastSegment && HTTP_METHODS.includes(lastSegment.toLowerCase())) {
          const method = lastSegment.toUpperCase() as "GET" | "PATCH" | "POST" | "PUT" | "DELETE";
          const pathSegments = segments.slice(0, segments.length - 1);
          const fullPath =
            pathSegments.length === 0 || (pathSegments.length === 1 && pathSegments[0] === "")
              ? "/"
              : "/" + pathSegments.filter((s) => s !== "").join("/");
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
              ...options.headers,
            },
          };
          if (body !== undefined && method !== "GET") {
            init.body = JSON.stringify(body);
          }

          return (async () => {
            try {
              const res = await fetch(url.toString(), init);
              const status = res.status;
              const ok = res.ok;

              if (!ok) {
                const errorData = await processResponse(res, responseFormat);
                return { error: errorData, data: null, status, ok };
              }

              const data = await processResponse(res, responseFormat);
              return { error: null, data, status, ok };
            } catch (error) {
              return { error, data: null, status: 0, ok: false };
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
