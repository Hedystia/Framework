type PathParts<Path extends string> = Path extends `/${infer Rest}`
  ? Rest extends `${infer Head}/${infer Tail}`
    ? [Head, ...PathParts<`/${Tail}`>]
    : [Rest]
  : [];

type RouteToTree<P extends string, Params> = PathParts<P> extends [
  infer H extends string,
  ...infer T extends string[],
]
  ? H extends `:${infer Param}`
    ? {
        [K in Param]: (value: Params[K & keyof Params]) => RouteToTreeInner<T, Params>;
      }
    : {
        [K in H]: RouteToTreeInner<T, Params>;
      }
  : {};

type RequestFunction = () => Promise<any>;

type RouteToTreeInner<T extends string[], Params> = T extends [
  infer H extends string,
  ...infer R extends string[],
]
  ? H extends `:${infer Param}`
    ? {
        [K in Param]: (value: Params[K & keyof Params]) => RouteToTreeInner<R, Params>;
      }
    : {
        [K in H]: RouteToTreeInner<R, Params>;
      }
  : { get: RequestFunction };

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void
  ? I
  : never;

type ClientTree<R> = UnionToIntersection<
  R extends { path: infer P extends string; params: infer Params } ? RouteToTree<P, Params> : never
>;

export function createClient<R>(baseUrl: string, app: any): ClientTree<R> {
  const root: any = {};

  (app as any).routes.forEach((route: any) => {
    const parts = route.path.split("/").filter(Boolean);

    const buildChain = (
      current: any,
      remainingParts: string[],
      params: Record<string, any> = {},
    ) => {
      for (let i = 0; i < remainingParts.length; i++) {
        const part = remainingParts[i];
        if (part?.startsWith(":")) {
          const param = part.slice(1);
          current[param] = (value: any) => {
            const newParams = { ...params, [param]: value };
            const next: any = {};
            buildChain(next, remainingParts.slice(i + 1), newParams);
            return next;
          };
          return;
        } else {
          if (typeof part === "string") {
            current[part] = current[part] || {};
            current = current[part];
          }
        }
      }

      current.get = async () => {
        const fullPath = route.path.replace(/:([^/]+)/g, (_: any, key: any) => params[key]);
        const res = await fetch(`${baseUrl}${fullPath}`, { method: "GET" });
        return res.json();
      };
    };

    buildChain(root, parts);
  });

  return root;
}

function buildChain(current: any, parts: string[], params: any, route: any, baseUrl: string) {
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part?.startsWith(":")) {
      const param = part.slice(1);
      current[param] = (value: any) => {
        const nextParams = { ...params, [param]: value };
        const next: any = {};
        buildChain(next, parts.slice(i + 1), nextParams, route, baseUrl);
        return next;
      };
      break;
    } else {
      if (typeof part === "string") {
        current[part] = current[part] || {};
        current = current[part];
      }
    }
  }

  if (parts.length === 0) {
    current.get = async () => {
      const fullPath = route.path.replace(/:([^/]+)/g, (_: any, key: any) => params[key]);
      const res = await fetch(`${baseUrl}${fullPath}`, { method: "GET" });
      return res.json();
    };
  }
}
