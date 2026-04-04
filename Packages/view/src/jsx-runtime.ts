/**
 * Production JSX runtime for @hedystia/view
 *
 * Provides jsx, jsxs, and Fragment for JSX transformation.
 * Creates real DOM nodes directly, no Virtual DOM.
 */

export { type ElementType, Fragment, type FunctionComponent, jsx, jsxs } from "./jsx/element";
export type { JSX } from "./jsx.d";
