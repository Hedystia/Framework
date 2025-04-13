type PathParts<Path extends string> = Path extends `/${infer Rest}`
  ? Rest extends `${infer Head}/${infer Tail}`
    ? [Head, ...PathParts<`/${Tail}`>]
    : [Rest]
  : [];

type RequestFunction<ResponseType> = () => Promise<{ error: any; data: ResponseType }>;
type PostRequestFunction<B, ResponseType> = (
  body?: B,
) => Promise<{ error: any; data: ResponseType }>;

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
  body?: infer Body;
  response?: infer Response;
}
  ? [M, P, Params, Body, Response]
  : never;

type GroupedRoutes<Routes> = {
  [P in RouteDefinitionsToMethodsObjects<Routes>[1]]: {
    params: Extract<RouteDefinitionsToMethodsObjects<Routes>, [any, P, any, any, any]>[2];
    methods: MergeMethodObjects<{
      get: Extract<
        RouteDefinitionsToMethodsObjects<Routes>,
        ["GET", P, any, any, any]
      >[0] extends "GET"
        ? RequestFunction<
            Extract<RouteDefinitionsToMethodsObjects<Routes>, ["GET", P, any, any, any]>[4]
          >
        : never;
      post: Extract<
        RouteDefinitionsToMethodsObjects<Routes>,
        ["POST", P, any, any, any]
      >[0] extends "POST"
        ? PostRequestFunction<
            Extract<RouteDefinitionsToMethodsObjects<Routes>, ["POST", P, any, any, any]>[3],
            Extract<RouteDefinitionsToMethodsObjects<Routes>, ["POST", P, any, any, any]>[4]
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

export function createClient<R>(baseUrl: string, app: any): ClientTree<R> {
  const root: any = {};

  const routesByPath: Record<string, any[]> = {};
  for (const route of app.routes) {
    const path = route.path;
    if (!routesByPath[path]) {
      routesByPath[path] = [];
    }
    routesByPath[path].push(route);
  }

  for (const [path, routes] of Object.entries(routesByPath)) {
    const parts = path.split("/").filter(Boolean);

    const buildChain = (
      current: any,
      remainingParts: string[],
      params: Record<string, any> = {},
    ) => {
      for (let i = 0; i < remainingParts.length; i++) {
        const part = remainingParts[i];
        if (part?.startsWith(":")) {
          const param = part.slice(1);
          if (!current[param]) {
            current[param] = (value: any) => {
              const newParams = { ...params, [param]: value };
              const next: any = {};
              buildChain(next, remainingParts.slice(i + 1), newParams);
              return next;
            };
          }
          return;
        } else {
          if (part) {
            current[part] = current[part] || {};
            current = current[part];
          }
        }
      }

      const defineMethod = (method: "GET" | "POST", handler: any) => {
        const key = method.toLowerCase();

        const alreadyExists = current[key];
        if (typeof alreadyExists === "object") {
          Object.defineProperty(current, key, {
            get() {
              return handler;
            },
            enumerable: true,
          });
        } else {
          current[key] = handler;
        }
      };

      for (const route of routes) {
        if (route.method === "GET") {
          defineMethod("GET", async () => {
            const fullPath = route.path.replace(/:([^/]+)/g, (_: any, key: any) => params[key]);
            try {
              const res = await fetch(new URL(fullPath, baseUrl), { method: "GET" });
              const data = await res.json();
              return { error: null, data };
            } catch (error) {
              return { error, data: null };
            }
          });
        }

        if (route.method === "POST") {
          defineMethod("POST", async (body?: any) => {
            const fullPath = route.path.replace(/:([^/]+)/g, (_: any, key: any) => params[key]);
            try {
              const res = await fetch(new URL(fullPath, baseUrl), {
                method: "POST",
                body: body ? JSON.stringify(body) : undefined,
                headers: body ? { "Content-Type": "application/json" } : undefined,
              });
              const data = await res.json();
              return { error: null, data };
            } catch (error) {
              return { error, data: null };
            }
          });
        }
      }
    };

    buildChain(root, parts);
  }

  return root;
}
