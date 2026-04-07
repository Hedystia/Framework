/**
 * JSX element creation for @hedystia/view
 *
 * Creates real DOM nodes directly from JSX, no Virtual DOM.
 * Supports both intrinsic elements (strings) and functional components.
 */

import type { JSX } from "../jsx.d";
import { tick } from "../scheduler";
import { Owner, runComputation } from "../signal";
import type { Accessor, Computation } from "../types";

/**
 * Function component type
 */
export type FunctionComponent<P = {}> = (props: P & { children?: JSX.Element }) => JSX.Element;

/**
 * Element type - can be a string (intrinsic) or a function component
 */
export type ElementType<P = {}> = string | FunctionComponent<P>;

/**
 * Check if running in browser environment
 */
const isBrowser = typeof document !== "undefined";

/**
 * Create a real DOM element from JSX props
 * @param {ElementType} type - The element type (string or function component)
 * @param {Record<string, any>} props - The element props
 * @returns {JSX.Element} The created DOM element or component result
 * @example
 * const div = jsx("div", { className: "card", children: "Hello" });
 * const MyComponent = (props: { text: string }) => <div>{props.text}</div>;
 * const component = jsx(MyComponent, { text: "Hello" });
 */
export function jsx<P>(type: ElementType<P>, props: P & { children?: JSX.Element }): JSX.Element {
  const { children, ...rest } = props || {};

  // Handle function components
  if (typeof type === "function") {
    return type({ children, ...rest } as P & { children?: JSX.Element });
  }

  // SSR mode: return serializable element representation
  if (!isBrowser) {
    return { type, props: { children, ...rest }, __isSSR: true } as unknown as JSX.Element;
  }

  // Handle intrinsic elements (strings)
  const element = document.createElement(type);

  for (const key in rest) {
    if (!Object.hasOwn(rest, key)) {
      continue;
    }
    const value = (rest as Record<string, any>)[key];
    applyProp(element, key, value);
  }

  if (children !== undefined && children !== null) {
    applyChildren(element, children);
  }

  return element;
}

/**
 * Create a fragment (multiple children without wrapper)
 * @param {ElementType} type - The element type (string or function component)
 * @param {Record<string, any>} props - The element props
 * @returns {JSX.Element | (HTMLElement | Text | Comment)[]} The fragment children or element
 * @example
 * const fragment = jsxs("fragment", { children: [div1, div2] });
 * const MyComponent = (props: { items: string[] }) => <>{props.items.map(item => <span>{item}</span>)}</>;
 * const component = jsxs(MyComponent, { items: ["a", "b"] });
 */
export function jsxs<P>(
  type: ElementType<P>,
  props: P & { children?: JSX.Element },
): JSX.Element | (HTMLElement | Text | Comment)[] {
  const { children, ...rest } = props || {};

  // Handle function components
  if (typeof type === "function") {
    return type({ children, ...rest } as P & { children?: JSX.Element });
  }

  // Handle Fragment
  if (type === "fragment" || type === "Fragment") {
    if (Array.isArray(children)) {
      return flattenChildren(children);
    }
    return children ?? null;
  }

  // SSR mode
  if (!isBrowser) {
    return { type, props: { children, ...rest }, __isSSR: true } as unknown as JSX.Element;
  }

  // Handle intrinsic elements (strings)
  const element = document.createElement(type);

  for (const key in rest) {
    if (!Object.hasOwn(rest, key)) {
      continue;
    }
    const value = (rest as Record<string, any>)[key];
    applyProp(element, key, value);
  }

  if (children !== undefined && children !== null) {
    applyChildren(element, children);
  }

  return element;
}

/**
 * Fragment component for multiple children
 */
export function Fragment(props: {
  children?: JSX.Children;
}): JSX.Element | (HTMLElement | Text | Comment)[] {
  const { children } = props;
  if (children == null) {
    return null;
  }
  if (Array.isArray(children)) {
    return flattenChildren(children);
  }
  if (typeof children === "function") {
    const container = document.createDocumentFragment();
    applyReactiveChild(container, children as () => any);
    return container;
  }
  return children as JSX.Element;
}

/** @internal - Eager effect for DOM side effects (unlike memo which is lazy) */
export function effect(fn: () => void): void {
  const computation: Computation<any> = {
    _fn: () => {
      fn();
      return undefined;
    },
    _value: undefined,
    _sources: null,
    _sourceSlots: null,
    _observers: null,
    _observerSlots: null,
    _owner: Owner,
    _cleanups: null,
    _context: null,
    _suspense: null,
    _user: true,
    _pure: false,
    _state: 0,
    _updatedAt: null,
  };
  runComputation(computation);
}

/** @internal */
function applyProp(element: HTMLElement, key: string, value: any): void {
  if (value === undefined || value === null) {
    return;
  }

  if (key.startsWith("on") && typeof value === "function") {
    const eventName = key.slice(2).toLowerCase();
    element.addEventListener(eventName, value);
  } else if (key === "style") {
    if (typeof value === "string") {
      element.style.cssText = value;
    } else if (typeof value === "object") {
      applyStyle(element, value);
    } else if (typeof value === "function") {
      applyReactiveStyle(element, value);
    }
  } else if (key === "class") {
    element.className = String(value);
  } else if (key === "className") {
    element.className = String(value);
  } else if (key === "ref" && typeof value === "function") {
    tick(() => value(element));
  } else if (typeof value === "function" && !key.startsWith("on")) {
    applyReactiveProp(element, key, value);
  } else {
    if (typeof value === "boolean") {
      if (value) {
        element.setAttribute(key, "");
      }
    } else {
      element.setAttribute(key, String(value));
    }
  }
}

/** @internal */
function applyStyle(element: HTMLElement, style: Record<string, any>): void {
  for (const key in style) {
    if (!Object.hasOwn(style, key)) {
      continue;
    }
    const value = style[key];
    if (value !== undefined && value !== null) {
      const cssKey = camelToKebab(key);
      (element.style as any)[cssKey] = String(value);
    }
  }
}

/** @internal */
function applyReactiveStyle(element: HTMLElement, accessor: Accessor<Record<string, any>>): void {
  effect(() => {
    const style = accessor();
    applyStyle(element, style);
  });
}

/** @internal */
function applyReactiveProp(element: HTMLElement, key: string, accessor: Accessor<any>): void {
  effect(() => {
    const value = accessor();
    if (value === undefined || value === null) {
      element.removeAttribute(key);
    } else {
      element.setAttribute(key, String(value));
    }
  });
}

/** @internal */
function applyChildren(element: HTMLElement | DocumentFragment, children: JSX.Children): void {
  if (Array.isArray(children)) {
    for (let i = 0; i < children.length; i++) {
      appendSingleChild(element, children[i]);
    }
  } else {
    appendSingleChild(element, children);
  }
}

/** @internal */
function appendSingleChild(element: HTMLElement | DocumentFragment, child: any): void {
  if (child === null || child === undefined || child === false) {
    return;
  }
  if (Array.isArray(child)) {
    for (let i = 0; i < child.length; i++) {
      appendSingleChild(element, child[i]);
    }
  } else if (typeof child === "function") {
    applyReactiveChild(element, child);
  } else if (typeof child === "string" || typeof child === "number") {
    element.appendChild(document.createTextNode(String(child)));
  } else if (child instanceof HTMLElement || child instanceof Text || child instanceof Comment) {
    element.appendChild(child);
  } else if (child instanceof DocumentFragment) {
    element.appendChild(child);
  }
}

/** @internal */
function applyReactiveChild(
  element: HTMLElement | DocumentFragment,
  accessor: Accessor<any>,
): void {
  const marker = document.createComment("");
  element.appendChild(marker);
  let currentNodes: Node[] = [];

  effect(() => {
    const value = accessor();

    // Remove old nodes
    for (let i = 0; i < currentNodes.length; i++) {
      const node = currentNodes[i]!;
      if (node.parentNode) {
        node.parentNode.removeChild(node);
      }
    }
    currentNodes = [];

    const insert = (node: Node) => {
      marker.parentNode!.insertBefore(node, marker);
      currentNodes.push(node);
    };

    if (value === null || value === undefined || value === false) {
      // nothing to insert
    } else if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        if (
          item instanceof HTMLElement ||
          item instanceof Text ||
          item instanceof Comment ||
          item instanceof DocumentFragment
        ) {
          insert(item);
        } else if (typeof item === "string" || typeof item === "number") {
          insert(document.createTextNode(String(item)));
        } else if (Array.isArray(item)) {
          const flat = flattenChildren(item);
          for (let j = 0; j < flat.length; j++) {
            insert(flat[j]!);
          }
        }
      }
    } else if (typeof value === "string" || typeof value === "number") {
      insert(document.createTextNode(String(value)));
    } else if (
      value instanceof HTMLElement ||
      value instanceof Text ||
      value instanceof Comment ||
      value instanceof DocumentFragment
    ) {
      insert(value);
    }
  });
}

/** @internal */
function flattenChildren(children: JSX.Child[]): Array<HTMLElement | Text | Comment> {
  const result: Array<HTMLElement | Text | Comment> = [];
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    if (Array.isArray(child)) {
      result.push(...flattenChildren(child));
    } else if (child !== null && child !== undefined && child !== false) {
      if (child instanceof HTMLElement || child instanceof Text || child instanceof Comment) {
        result.push(child);
      } else if (typeof child === "string" || typeof child === "number") {
        result.push(document.createTextNode(String(child)));
      }
    }
  }
  return result;
}

/** @internal */
function camelToKebab(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}
