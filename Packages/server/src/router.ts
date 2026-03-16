type MethodEntry = {
  handler: any;
  paramNames: string[];
};

function splitPathSegments(path: string): string[] {
  if (path.length > 1 && path.charCodeAt(path.length - 1) === 47) {
    path = path.slice(0, -1);
  }
  if (path === "/") {
    return [];
  }

  const parts: string[] = [];
  let start = path.charCodeAt(0) === 47 ? 1 : 0;
  for (let i = start; i <= path.length; i++) {
    if (i === path.length || path.charCodeAt(i) === 47) {
      if (i > start) {
        parts.push(path.slice(start, i));
      }
      start = i + 1;
    }
  }
  return parts;
}

class Node {
  part: string;
  children: Record<string, Node> = Object.create(null);
  wildcard: Node | null = null;
  parametric: Node | null = null;
  methods: Record<string, MethodEntry> | null = null;

  constructor(part: string) {
    this.part = part;
  }
}

export class Router {
  root: Node = new Node("/");

  add(method: string, path: string, store: any) {
    const parts = splitPathSegments(path);
    let current = this.root;
    const paramNames: string[] = [];

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;

      if (part.charCodeAt(0) === 58) {
        const paramName = part.slice(1);
        paramNames.push(paramName);
        if (!current.parametric) {
          current.parametric = new Node(":");
          current.parametric.parametric = null;
        }
        current = current.parametric;
      } else if (part === "*") {
        if (!current.wildcard) {
          current.wildcard = new Node("*");
        }
        current = current.wildcard;
      } else {
        if (!current.children[part]) {
          current.children[part] = new Node(part);
        }
        current = current.children[part];
      }
    }
    if (!current.methods) {
      current.methods = Object.create(null);
    }
    current.methods![method] = { handler: store, paramNames };
  }

  find(method: string, path: string): { handler: any; params: Record<string, string> } | null {
    const parts = splitPathSegments(path);
    let current = this.root;
    const paramValues: string[] = [];

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;

      if (current.children[part]) {
        current = current.children[part];
      } else if (current.parametric) {
        paramValues.push(part);
        current = current.parametric;
      } else if (current.wildcard) {
        current = current.wildcard;
        break;
      } else {
        return null;
      }
    }

    const entry = current.methods?.[method];
    if (!entry) {
      return null;
    }
    const params: Record<string, string> = {};
    for (let i = 0; i < entry.paramNames.length && i < paramValues.length; i++) {
      params[entry.paramNames[i]!] = paramValues[i]!;
    }
    return { handler: entry.handler, params };
  }
}
