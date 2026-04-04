/**
 * Computed style engine for @hedystia/view
 *
 * Provides reactive style computation and merging.
 */

import { memo } from "../signal";
import type { Accessor, StyleProps } from "../types";
import { mergeStyles } from "../utils";

/**
 * Create a reusable computed style
 */
export function style<T extends StyleProps>(base: T | Accessor<T>): Accessor<T> {
  if (typeof base === "function") {
    return memo(() => {
      const result = base();
      return normalizeStyle(result) as T;
    });
  }
  const normalized = normalizeStyle(base);
  return () => normalized as T;
}

/**
 * Merge multiple style objects
 */
export function merge(...styles: (StyleProps | undefined | null)[]): StyleProps {
  let result: StyleProps = {};
  for (let i = 0; i < styles.length; i++) {
    const style = styles[i];
    if (style !== undefined && style !== null) {
      result = mergeStyles(result, style);
    }
  }
  return result;
}

/** @internal */
function normalizeStyle(style: StyleProps): StyleProps {
  const result: StyleProps = {};
  for (const key in style) {
    if (!Object.hasOwn(style, key)) {
      continue;
    }
    const value = style[key];
    if (typeof value === "function") {
      result[key] = (value as () => string | number)();
    } else if (value !== undefined && value !== null) {
      result[key] = value as string | number;
    }
  }
  return result;
}

/**
 * Convert a style object to a CSS string
 */
export function toCssString(style: StyleProps): string {
  let result = "";
  for (const key in style) {
    if (!Object.hasOwn(style, key)) {
      continue;
    }
    const value = style[key];
    if (value !== undefined && value !== null) {
      const cssKey = camelToKebab(key);
      result += `${cssKey}: ${value}; `;
    }
  }
  return result.trim();
}

/** @internal */
function camelToKebab(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}
