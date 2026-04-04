/**
 * Internal constants for the reactive system
 */

/**
 * Symbol to mark proxy objects for store reactivity
 */
export const $STORE = Symbol("hedystia-store");

/**
 * Symbol to track signal access for dependency tracking
 */
export const $TRACK = Symbol("hedystia-track");

/**
 * Symbol for fragment type in JSX
 */
export const $FRAGMENT = Symbol("hedystia-fragment");

/**
 * Development mode flag
 */
export const IS_DEV = typeof window !== "undefined" && (window as any).__DEV__ === true;
