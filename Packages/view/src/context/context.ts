/**
 * Typed context system for @hedystia/view
 *
 * Provides provider/consumer pattern for dependency injection.
 */

import type { JSX } from "../jsx.d";
import { sig, val } from "../signal";
import type { Component, Context } from "../types";

const contextMap = new Map<symbol, any>();

/**
 * Create a typed context for dependency injection
 * @template T - The type of the context value
 * @param {T} [defaultValue] - Optional default value
 * @returns {Context<T>} A context object with Provider
 * @example
 * const ThemeCtx = ctx<{ mode: "dark" | "light"; accent: string }>();
 */
export function ctx<T>(defaultValue?: T): Context<T> {
  const id = Symbol("context");
  if (defaultValue !== undefined) {
    contextMap.set(id, sig(defaultValue));
  }

  const Provider: Component<{ value: T; children: JSX.Element }> = (props) => {
    const prevValue = contextMap.get(id);
    const newSignal = sig(props.value);
    contextMap.set(id, newSignal);

    try {
      return props.children;
    } finally {
      if (prevValue !== undefined) {
        contextMap.set(id, prevValue);
      } else {
        contextMap.delete(id);
      }
    }
  };

  return {
    _id: id,
    _defaultValue: defaultValue,
    Provider,
  };
}

/**
 * Consume a context value
 * @template T - The type of the context value
 * @param {Context<T>} context - The context to consume
 * @returns {T} The context value
 * @throws {Error} When context is not found and no default exists
 * @example
 * const theme = use(ThemeCtx);
 */
export function use<T>(context: Context<T>): T {
  const signal = contextMap.get(context._id);
  if (signal !== undefined) {
    return val(signal);
  }
  if (context._defaultValue !== undefined) {
    return context._defaultValue;
  }
  throw new Error(`Context not found: ${String(context._id)}`);
}
