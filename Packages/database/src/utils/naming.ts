/**
 * Generate a timestamp string for migration file naming
 * @returns {string} Formatted timestamp
 */
export function generateTimestamp(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  return `${y}${m}${day}${h}${min}${s}`;
}

/**
 * Convert a camelCase or PascalCase string to snake_case
 * @param {string} str - Input string
 * @returns {string} Snake case string
 */
export function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase()
    .replace(/^_/, "");
}

/**
 * Convert a snake_case string to camelCase
 * @param {string} str - Input string
 * @returns {string} Camel case string
 */
export function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}
