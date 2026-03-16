/**
 * Produce a stable JSON string for cache keys by sorting object keys
 * @param {unknown} value - Value to stringify
 * @returns {string} Stable JSON string
 */
export function stableStringify(value: unknown): string {
  if (value === null || value === undefined) {
    return String(value);
  }
  if (typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const parts: string[] = [];
  for (const key of keys) {
    parts.push(`${JSON.stringify(key)}:${stableStringify((value as any)[key])}`);
  }
  return `{${parts.join(",")}}`;
}
