/**
 * Flow components for @hedystia/view
 *
 * Provides Show, For, Index, Switch, Match, Portal, Suspense, ErrorBoundary.
 */

import { tick } from "../scheduler";
import { createRoot, memo, sig, onCleanup as signalOnCleanup, val } from "../signal";
import type { Accessor } from "../types";

/**
 * Check if running in browser
 */
const isBrowser = typeof document !== "undefined";

/**
 * Conditionally render children based on a condition
 */
export function Show<T>(props: { when: T | Accessor<T>; fallback?: any; children: any }): any {
  // SSR mode: evaluate condition and return appropriate content
  if (!isBrowser) {
    const cond = typeof props.when === "function" ? (props.when as Accessor<T>)() : props.when;
    if (cond && props.children) {
      return typeof props.children === "function" ? props.children() : props.children;
    }
    if (props.fallback) {
      return typeof props.fallback === "function" ? props.fallback() : props.fallback;
    }
    return "";
  }

  const container = document.createComment("show");
  let rendered: HTMLElement | null = null;
  let fallbackNode: HTMLElement | null = null;
  const _initialized = false;

  const getCondition = (): any => {
    return typeof props.when === "function" ? (props.when as Accessor<T>)() : props.when;
  };

  const runEffect = () => {
    const cond = getCondition();
    if (cond) {
      if (fallbackNode) {
        fallbackNode.parentNode?.removeChild(fallbackNode);
        fallbackNode = null;
      }
      if (!rendered && props.children) {
        rendered =
          typeof props.children === "function"
            ? (props.children() as HTMLElement)
            : (props.children as HTMLElement);
        if (rendered && !rendered.parentNode) {
          // Defer insertion until container has a parent
          if (container.parentNode) {
            container.parentNode.insertBefore(rendered, container.nextSibling);
          } else {
            queueMicrotask(() => {
              if (rendered && !rendered.parentNode && container.parentNode) {
                container.parentNode.insertBefore(rendered, container.nextSibling);
              }
            });
          }
        }
      }
    } else {
      if (rendered) {
        rendered.parentNode?.removeChild(rendered);
        rendered = null;
      }
      if (props.fallback && !fallbackNode) {
        fallbackNode =
          typeof props.fallback === "function"
            ? (props.fallback() as HTMLElement)
            : (props.fallback as HTMLElement);
        if (fallbackNode && !fallbackNode.parentNode) {
          if (container.parentNode) {
            container.parentNode.insertBefore(fallbackNode, container.nextSibling);
          } else {
            queueMicrotask(() => {
              if (fallbackNode && !fallbackNode.parentNode && container.parentNode) {
                container.parentNode.insertBefore(fallbackNode, container.nextSibling);
              }
            });
          }
        }
      }
    }
  };

  const tracker = memo(() => {
    runEffect();
    return true;
  });

  // Run effect synchronously
  val(tracker);

  return container;
}

/**
 * Render a list with keyed items for efficient updates
 */
export function For<T>(props: {
  each: T[] | Accessor<T[]>;
  key?: (item: T) => string | number;
  children: (item: Accessor<T>, index: Accessor<number>) => any;
}): any {
  // SSR mode: render all items
  if (!isBrowser) {
    const items = typeof props.each === "function" ? (props.each as Accessor<T[]>)() : props.each;
    if (!Array.isArray(items) || items.length === 0) {
      return "";
    }
    return items.map((item, i) => {
      // Accessors that return the value directly (compatible with val())
      const itemAccessor = () => item;
      const indexAccessor = () => i;
      return props.children(itemAccessor, indexAccessor);
    });
  }

  const container = document.createComment("for");
  const nodes = new Map<string | number, HTMLElement>();
  const order: Array<string | number> = [];

  const getEach = (): T[] => {
    return typeof props.each === "function" ? (props.each as Accessor<T[]>)() : props.each;
  };

  const runEffect = () => {
    const items = getEach();
    const newOrder: Array<string | number> = [];
    const newNodes = new Map<string | number, HTMLElement>();

    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      const key = props.key ? props.key(item) : i;
      newOrder.push(key);

      if (nodes.has(key)) {
        newNodes.set(key, nodes.get(key)!);
      } else {
        const itemSig = sig(item);
        const indexSig = sig(i);
        const child = props.children(
          () => val(itemSig),
          () => val(indexSig),
        ) as HTMLElement;
        newNodes.set(key, child);
      }
    }

    for (const key of order) {
      if (!newNodes.has(key)) {
        const node = nodes.get(key);
        if (node?.parentNode) {
          node.parentNode.removeChild(node);
        }
      }
    }

    const insertNodes = () => {
      if (container.parentNode) {
        let prevSibling = container.nextSibling;
        for (const key of newOrder) {
          const node = newNodes.get(key)!;
          if (!nodes.has(key) && !node.parentNode) {
            container.parentNode!.insertBefore(node, prevSibling);
          } else if (prevSibling !== node) {
            container.parentNode!.insertBefore(node, prevSibling);
          }
          prevSibling = node.nextSibling;
        }
      }
    };

    if (container.parentNode) {
      insertNodes();
    } else {
      queueMicrotask(insertNodes);
    }

    order.length = 0;
    order.push(...newOrder);
    nodes.clear();
    for (const [k, v] of newNodes) {
      nodes.set(k, v);
    }
  };

  const tracker = memo(() => {
    runEffect();
    return true;
  });

  // Run effect synchronously
  val(tracker);

  return container;
}

/**
 * Render a list with index-based tracking
 */
export function Index<T>(props: {
  each: T[] | Accessor<T[]>;
  children: (item: Accessor<T>, index: number) => any;
}): any {
  // SSR mode: render all items by index
  if (!isBrowser) {
    const items = typeof props.each === "function" ? (props.each as Accessor<T[]>)() : props.each;
    if (!Array.isArray(items) || items.length === 0) {
      return "";
    }
    return items.map((item, i) => {
      const itemAccessor = () => item;
      return props.children(itemAccessor, i);
    });
  }

  const container = document.createComment("index");
  const nodes: Array<HTMLElement | null> = [];

  const getEach = (): T[] => {
    return typeof props.each === "function" ? (props.each as Accessor<T[]>)() : props.each;
  };

  const runEffect = () => {
    const items = getEach();

    while (nodes.length > items.length) {
      const node = nodes.pop();
      if (node?.parentNode) {
        node.parentNode.removeChild(node);
      }
    }

    const insertNodes = () => {
      if (container.parentNode) {
        for (let i = 0; i < items.length; i++) {
          if (nodes[i] === undefined) {
            const itemSig = sig(items[i]!);
            const child = props.children(() => val(itemSig), i) as HTMLElement;
            nodes[i] = child;
            if (!child.parentNode) {
              container.parentNode.insertBefore(child, container.nextSibling);
            }
          }
        }
      }
    };

    if (container.parentNode) {
      insertNodes();
    } else {
      queueMicrotask(insertNodes);
    }
  };

  const tracker = memo(() => {
    runEffect();
    return true;
  });

  // Run effect synchronously
  val(tracker);

  return container;
}

/**
 * Switch component for mutually exclusive conditions
 */
export function Switch(props: { fallback?: any; children: any }): any {
  // SSR mode: evaluate matches
  if (!isBrowser) {
    const children = props.children;
    if (Array.isArray(children)) {
      for (const child of children) {
        if (child && typeof child === "object" && "_matchWhen" in child) {
          const when = (child as any)._matchWhen;
          const condition = typeof when === "function" ? when() : when;
          if (condition) {
            return (child as any)._matchChildren;
          }
        }
      }
    }
    return props.fallback || "";
  }

  const container = document.createComment("switch");
  let rendered: HTMLElement | null = null;

  const evaluate = (): any => {
    const children = props.children;
    if (Array.isArray(children)) {
      for (const child of children) {
        if (child && (child as any)._matchWhen) {
          const when = (child as any)._matchWhen;
          const condition = typeof when === "function" ? when() : when;
          if (condition) {
            return (child as any)._matchChildren;
          }
        }
      }
    }
    return props.fallback;
  };

  const runEffect = () => {
    const content = evaluate();
    if (rendered) {
      rendered.parentNode?.removeChild(rendered);
      rendered = null;
    }
    if (content) {
      rendered =
        typeof content === "function" ? (content() as HTMLElement) : (content as HTMLElement);
      if (rendered && !rendered.parentNode) {
        const insertNode = () => {
          if (rendered && container.parentNode && !rendered.parentNode) {
            container.parentNode.insertBefore(rendered, container.nextSibling);
          }
        };
        if (container.parentNode) {
          insertNode();
        } else {
          queueMicrotask(insertNode);
        }
      }
    }
  };

  const tracker = memo(() => {
    runEffect();
    return true;
  });

  // Run effect synchronously
  val(tracker);

  return container;
}

/**
 * Match component for use inside Switch
 */
export function Match<T>(props: { when: T | Accessor<T>; children: any }): any {
  // SSR mode: return marker object
  if (!isBrowser) {
    const marker: Record<string, unknown> = {};
    marker._matchWhen = typeof props.when === "function" ? props.when : () => props.when;
    marker._matchChildren = props.children;
    return marker;
  }

  const marker = document.createComment("match");
  (marker as any)._matchWhen = typeof props.when === "function" ? props.when : () => props.when;
  (marker as any)._matchChildren = props.children;
  return marker;
}

/**
 * Portal component for rendering outside the current DOM hierarchy
 */
export function Portal(props: { mount?: HTMLElement; children: any }): any {
  // SSR mode: just render children inline
  if (!isBrowser) {
    if (typeof props.children === "function") {
      return props.children();
    }
    return props.children;
  }

  const container = document.createComment("portal");
  const mountPoint = props.mount || document.body;
  let rendered: HTMLElement | null = null;

  createRoot(() => {
    rendered =
      typeof props.children === "function"
        ? (props.children() as HTMLElement)
        : (props.children as HTMLElement);
    if (rendered) {
      mountPoint.appendChild(rendered);
    }

    signalOnCleanup(() => {
      if (rendered && rendered.parentNode === mountPoint) {
        mountPoint.removeChild(rendered);
      }
    });
  });

  return container;
}

/**
 * Suspense component for async loading states
 */
export function Suspense(props: { fallback?: any; children: any }): any {
  const container = document.createComment("suspense");
  let rendered: HTMLElement | null = null;
  let fallbackNode: HTMLElement | null = null;

  tick(() => {
    try {
      if (fallbackNode) {
        container.parentNode?.removeChild(fallbackNode);
        fallbackNode = null;
      }
      if (!rendered && props.children) {
        rendered =
          typeof props.children === "function"
            ? (props.children() as HTMLElement)
            : (props.children as HTMLElement);
        if (rendered) {
          container.parentNode?.insertBefore(rendered, container.nextSibling);
        }
      }
    } catch {
      if (rendered) {
        container.parentNode?.removeChild(rendered);
        rendered = null;
      }
      if (props.fallback && !fallbackNode) {
        fallbackNode =
          typeof props.fallback === "function"
            ? (props.fallback() as HTMLElement)
            : (props.fallback as HTMLElement);
        if (fallbackNode) {
          container.parentNode?.insertBefore(fallbackNode, container.nextSibling);
        }
      }
    }
  });

  return container;
}

/**
 * ErrorBoundary component for catching render errors
 */
export function ErrorBoundary(props: {
  fallback: (err: Error, reset: () => void) => any;
  children: any;
}): any {
  const container = document.createComment("error-boundary");
  let rendered: HTMLElement | null = null;
  let error: Error | null = null;

  const reset = () => {
    error = null;
    if (rendered) {
      container.parentNode?.removeChild(rendered);
      rendered = null;
    }
    tick(() => {
      try {
        rendered =
          typeof props.children === "function"
            ? (props.children() as HTMLElement)
            : (props.children as HTMLElement);
        if (rendered) {
          container.parentNode?.insertBefore(rendered, container.nextSibling);
        }
      } catch (e) {
        error = e instanceof Error ? e : new Error(String(e));
        if (rendered) {
          container.parentNode?.removeChild(rendered);
          rendered = null;
        }
        const fallback = props.fallback(error, reset);
        rendered =
          typeof fallback === "function" ? (fallback() as HTMLElement) : (fallback as HTMLElement);
        if (rendered) {
          container.parentNode?.insertBefore(rendered, container.nextSibling);
        }
      }
    });
  };

  tick(() => {
    try {
      rendered =
        typeof props.children === "function"
          ? (props.children() as HTMLElement)
          : (props.children as HTMLElement);
      if (rendered) {
        container.parentNode?.insertBefore(rendered, container.nextSibling);
      }
    } catch (e) {
      error = e instanceof Error ? e : new Error(String(e));
      const fallback = props.fallback(error, reset);
      rendered =
        typeof fallback === "function" ? (fallback() as HTMLElement) : (fallback as HTMLElement);
      if (rendered) {
        container.parentNode?.insertBefore(rendered, container.nextSibling);
      }
    }
  });

  return container;
}
