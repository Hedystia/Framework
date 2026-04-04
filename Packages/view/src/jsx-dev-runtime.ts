/**
 * Development JSX runtime for @hedystia/view
 *
 * Provides jsxDEV with source location info for better error messages.
 * Re-exports jsx, jsxs, and Fragment from production runtime.
 */

import { type ElementType, Fragment, type FunctionComponent, jsx, jsxs } from "./jsx/element";
import type { JSX } from "./jsx.d";

/**
 * Development JSX element creator with source info
 * @param {ElementType} type - The element type (string or function component)
 * @param {Record<string, any>} props - The element props
 * @param {string} [key] - The element key
 * @param {boolean} [isStaticChildren] - Whether children are static
 * @param {string} [sourceFileName] - The source file name
 * @param {number} [sourceLineNumber] - The source line number
 * @param {number} [sourceColumnNumber] - The source column number
 * @returns {JSX.Element} The created DOM element or component result
 */
export function jsxDEV<P>(
  type: ElementType<P>,
  props: P & { children?: JSX.Element },
  _key?: string,
  _isStaticChildren?: boolean,
  sourceFileName?: string,
  sourceLineNumber?: number,
  sourceColumnNumber?: number,
): JSX.Element {
  const isDev = typeof window !== "undefined" && (window as any).__DEV__ === true;

  if (isDev) {
    const location =
      sourceFileName && sourceLineNumber
        ? ` at ${sourceFileName}:${sourceLineNumber}:${sourceColumnNumber || 0}`
        : "";

    try {
      return jsx(type, props);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const typeName = typeof type === "string" ? `<${type}>` : type.name || "Component";
      throw new Error(`jsxDEV error for ${typeName}${location}: ${message}`);
    }
  }

  return jsx(type, props);
}

export type { ElementType, FunctionComponent, JSX };
export { Fragment, jsx, jsxs };
