export function calculateReconnectDelay(
  attempt: number,
  {
    minDelay = 100,
    baseDelay = 1000,
    maxDelay = 30000,
  }: { minDelay?: number; baseDelay?: number; maxDelay?: number } = {},
) {
  return Math.max(minDelay, Math.min(baseDelay * 2 ** Math.max(0, attempt - 1), maxDelay));
}

export function replaceTimeout(
  current: ReturnType<typeof setTimeout> | undefined | null,
  fn: () => void,
  delay: number,
) {
  if (current) {
    clearTimeout(current);
  }
  return setTimeout(fn, delay);
}
