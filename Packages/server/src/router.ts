class Node {
  part: string;
  children: Record<string, Node> = {};
  wildcard: Node | null = null;
  parametric: Node | null = null;
  store: any = null;
  paramName = "";

  constructor(part: string) {
    this.part = part;
  }
}

export class Router {
  root: Node = new Node("/");

  add(method: string, path: string, store: any) {
    if (path.length > 1 && path.endsWith("/")) {
      path = path.slice(0, -1);
    }
    const parts = path.split("/").filter(Boolean);
    let current = this.root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) {
        continue;
      }

      if (part.startsWith(":")) {
        if (!current.parametric) {
          current.parametric = new Node(":");
          current.parametric.paramName = part.slice(1);
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
    if (!current.store) {
      current.store = {};
    }
    current.store[method] = store;
  }

  find(method: string, path: string): { handler: any; params: Record<string, string> } | null {
    if (path.length > 1 && path.endsWith("/")) {
      path = path.slice(0, -1);
    }
    const parts = path.split("/").filter(Boolean);
    let current = this.root;
    const params: Record<string, string> = {};

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) {
        continue;
      }

      if (current.children[part]) {
        current = current.children[part];
      } else if (current.parametric) {
        params[current.parametric.paramName] = part;
        current = current.parametric;
      } else if (current.wildcard) {
        current = current.wildcard;
        break;
      } else {
        return null;
      }
    }

    const handler = current.store?.[method];
    return handler ? { handler, params } : null;
  }
}
