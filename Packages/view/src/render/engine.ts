/**
 * Render engine for @hedystia/view
 *
 * Mounts components to the DOM and manages the render cycle.
 */

import { createRoot } from "../signal";
import type { Component, Owner } from "../types";

/**
 * Application instance returned by mount
 */
export interface ViewApp {
  dispose: () => void;
  root: Owner | null;
}

const currentOwner: Owner | null = null;

/**
 * Mount a component to a target DOM element
 * @param {Component<{}>} component - The component to mount
 * @param {HTMLElement} target - The target element
 * @returns {ViewApp} The application instance
 * @example
 * const app = mount(App, document.getElementById("root")!);
 * app.dispose();
 */
export function mount(component: Component<{}>, target: HTMLElement): ViewApp {
  target.innerHTML = "";

  let dispose: (() => void) | null = null;
  let root: Owner | null = null;

  createRoot((disposeFn) => {
    dispose = disposeFn;
    root = currentOwner;
    const element = component({}) as HTMLElement;
    if (element) {
      target.appendChild(element);
    }
  });

  return {
    dispose: () => {
      if (dispose) {
        dispose();
      }
      target.innerHTML = "";
    },
    root,
  };
}

/**
 * Render a component to a string (for SSR)
 * @param {Component<{}>} component - The component to render
 * @returns {string} The rendered HTML string
 * @example
 * const html = renderToString(App);
 */
export function renderToString(component: Component<{}>): string {
  const element = component({});
  if (element instanceof HTMLElement) {
    return element.outerHTML;
  }
  return "";
}
