/**
 * Watchers and reactive effects for @hedystia/view
 *
 * Provides effect tracking and reactive subscriptions.
 */

import { addOwned, cleanNode, Owner, runComputation, untrack, val } from "../signal";
import type { Computation, ReadonlySignal } from "../types";

/**
 * Create a reactive effect that runs when dependencies change
 */
export function on<T>(track: () => T, run: (value: T, prev: T) => any | (() => void)): () => void {
  let cleanup: (() => void) | undefined;
  let prevValue!: T;
  let hasRun = false;
  let stopped = false;

  const computation: Computation<any> = {
    _fn: () => {
      if (stopped) {
        return undefined;
      }

      const value = track();

      if (!hasRun) {
        prevValue = value;
        hasRun = true;
        return undefined;
      }

      untrack(() => {
        if (cleanup) {
          cleanup();
          cleanup = undefined;
        }

        const result = run(value, prevValue);
        if (typeof result === "function") {
          cleanup = result;
        }
      });

      prevValue = value;
      return undefined;
    },
    _value: undefined,
    _sources: null,
    _sourceSlots: null,
    _observers: null,
    _observerSlots: null,
    _owner: Owner,
    _owned: null,
    _cleanups: null,
    _context: null,
    _suspense: null,
    _user: true,
    _pure: false,
    _state: 0,
    _updatedAt: null,
  };

  addOwned(computation);
  runComputation(computation);

  return () => {
    stopped = true;
    cleanNode(computation);
    if (cleanup) {
      cleanup();
      cleanup = undefined;
    }
  };
}

/**
 * Create a one-time effect that runs once and disposes
 */
export function once<T>(track: () => T, run: (value: T) => void): () => void {
  let hasRun = false;
  return on(track, (value) => {
    if (!hasRun) {
      hasRun = true;
      run(value);
    }
  });
}

/**
 * Concise reactive effect — pass a signal directly instead of a track function.
 *
 * ```ts
 * watch(count, (value, prev) => console.log(value, prev));
 * ```
 */
export function watch<T>(
  signal: ReadonlySignal<T>,
  run: (value: T, prev: T) => any | (() => void),
): () => void {
  return on(() => val(signal), run);
}

/**
 * Reactive effect that tracks multiple signals at once.
 *
 * ```ts
 * watchAll([a, b], ([aVal, bVal], [prevA, prevB]) => { });
 * ```
 */
export function watchAll<T extends readonly ReadonlySignal<any>[]>(
  signals: [...T],
  run: (
    values: { [K in keyof T]: T[K] extends ReadonlySignal<infer V> ? V : never },
    prev: { [K in keyof T]: T[K] extends ReadonlySignal<infer V> ? V : never },
  ) => any | (() => void),
): () => void {
  return on(() => signals.map((s) => val(s)) as any, run as any);
}
