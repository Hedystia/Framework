/**
 * Frame scheduler for @hedystia/view
 *
 * Provides requestAnimationFrame-based batching for visual updates.
 */

let scheduledRaf: number | null = null;
let rafCallbacks: Array<() => void> = [];

/**
 * Schedule a callback for the next animation frame
 * @param {() => void} fn - The callback to run on next frame
 * @example
 * tick(() => {
 *   // DOM updates here
 * });
 */
export function tick(fn: () => void): void {
  rafCallbacks.push(fn);
  if (scheduledRaf === null) {
    scheduledRaf = requestAnimationFrame(flushRaf);
  }
}

/**
 * Wait for the next animation frame
 * @returns {Promise<void>} A promise that resolves on next frame
 * @example
 * await nextFrame();
 */
export function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    tick(resolve);
  });
}

/** @internal */
function flushRaf(): void {
  scheduledRaf = null;
  const callbacks = rafCallbacks;
  rafCallbacks = [];
  for (let i = 0; i < callbacks.length; i++) {
    callbacks[i]!();
  }
}

/**
 * Force flush all pending RAF callbacks synchronously (for testing)
 * @example
 * await tick(); // forces flush
 */
export function forceFlush(): Promise<void> {
  return new Promise((resolve) => {
    if (scheduledRaf !== null) {
      cancelAnimationFrame(scheduledRaf);
      scheduledRaf = null;
    }
    const callbacks = rafCallbacks;
    rafCallbacks = [];
    for (let i = 0; i < callbacks.length; i++) {
      callbacks[i]!();
    }
    resolve();
  });
}
