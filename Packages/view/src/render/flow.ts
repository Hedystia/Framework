/**
 * Flow components for @hedystia/view
 *
 * Provides Show, For, Index, Switch, Match, Portal, Suspense, ErrorBoundary.
 */

import { effect } from "../jsx/element";
import { tick } from "../scheduler";
import { createRoot, sig, onCleanup as signalOnCleanup, val } from "../signal";
import type { Accessor } from "../types";

/**
 * Check if running in browser
 */
const isBrowser = typeof document !== "undefined";

/** @internal - Insert a node after a marker, deferring if marker has no parent yet */
function insertAfter(marker: Comment, node: Node): void {
  if (marker.parentNode) {
    marker.parentNode.insertBefore(node, marker.nextSibling);
  } else {
    queueMicrotask(() => {
      if (node.parentNode === null && marker.parentNode) {
        marker.parentNode.insertBefore(node, marker.nextSibling);
      }
    });
  }
}

/** @internal - Remove a node from the DOM if attached */
function removeNode(node: Node | null): void {
  if (node?.parentNode) {
    node.parentNode.removeChild(node);
  }
}

/** @internal - Create a DOM node from children prop */
function resolveContent(content: any): HTMLElement | null {
  if (content == null) {
    return null;
  }
  return typeof content === "function" ? (content() as HTMLElement) : (content as HTMLElement);
}

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
  let currentNode: Node | null = null;

  effect(() => {
    const cond = typeof props.when === "function" ? (props.when as Accessor<T>)() : props.when;

    removeNode(currentNode);
    currentNode = null;

    if (cond) {
      currentNode = resolveContent(props.children);
    } else if (props.fallback) {
      currentNode = resolveContent(props.fallback);
    }

    if (currentNode) {
      insertAfter(container, currentNode);
    }
  });

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
      const itemAccessor = () => item;
      const indexAccessor = () => i;
      return props.children(itemAccessor, indexAccessor);
    });
  }

  const container = document.createComment("for");
  let currentNodes: Node[] = [];

  effect(() => {
    const items = typeof props.each === "function" ? (props.each as Accessor<T[]>)() : props.each;

    // Remove old nodes
    for (const node of currentNodes) {
      removeNode(node);
    }
    currentNodes = [];

    // Create new nodes
    for (let i = 0; i < items.length; i++) {
      const item = items[i]!;
      const itemSig = sig(item);
      const indexSig = sig(i);
      const child = props.children(
        () => val(itemSig),
        () => val(indexSig),
      ) as Node;
      currentNodes.push(child);
    }

    // Insert all nodes
    const doInsert = () => {
      if (container.parentNode) {
        let ref = container as Node;
        for (const node of currentNodes) {
          if (!node.parentNode) {
            container.parentNode!.insertBefore(node, ref.nextSibling);
          }
          ref = node;
        }
      }
    };

    if (container.parentNode) {
      doInsert();
    } else {
      queueMicrotask(doInsert);
    }
  });

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
  let currentNodes: Node[] = [];

  effect(() => {
    const items = typeof props.each === "function" ? (props.each as Accessor<T[]>)() : props.each;

    // Remove old nodes
    for (const node of currentNodes) {
      removeNode(node);
    }
    currentNodes = [];

    // Create new nodes
    for (let i = 0; i < items.length; i++) {
      const itemSig = sig(items[i]!);
      const child = props.children(() => val(itemSig), i) as Node;
      currentNodes.push(child);
    }

    // Insert all nodes
    const doInsert = () => {
      if (container.parentNode) {
        let ref = container as Node;
        for (const node of currentNodes) {
          if (!node.parentNode) {
            container.parentNode!.insertBefore(node, ref.nextSibling);
          }
          ref = node;
        }
      }
    };

    if (container.parentNode) {
      doInsert();
    } else {
      queueMicrotask(doInsert);
    }
  });

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
  let currentNode: Node | null = null;

  effect(() => {
    const children = props.children;
    let matched: any = null;

    if (Array.isArray(children)) {
      for (const child of children) {
        if (child && (child as any)._matchWhen) {
          const when = (child as any)._matchWhen;
          const condition = typeof when === "function" ? when() : when;
          if (condition) {
            matched = (child as any)._matchChildren;
            break;
          }
        }
      }
    }

    if (!matched) {
      matched = props.fallback;
    }

    removeNode(currentNode);
    currentNode = null;

    if (matched) {
      currentNode = resolveContent(matched);
      if (currentNode) {
        insertAfter(container, currentNode);
      }
    }
  });

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
