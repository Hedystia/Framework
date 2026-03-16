import { DEFAULT_CACHE_MAX_ENTRIES, DEFAULT_CACHE_MAX_TTL, DEFAULT_CACHE_TTL } from "../constants";
import type { CacheConfig } from "../types";
import { stableStringify } from "../utils";
import { MemoryStore } from "./memory-store";

/**
 * Cache manager that wraps query execution with caching behavior
 */
export class CacheManager {
  private store: MemoryStore;
  private baseTtl: number;
  private maxTtl: number;
  private enabled: boolean;

  constructor(config?: boolean | CacheConfig) {
    if (typeof config === "boolean") {
      this.enabled = config;
      this.baseTtl = DEFAULT_CACHE_TTL;
      this.maxTtl = DEFAULT_CACHE_MAX_TTL;
      this.store = new MemoryStore(DEFAULT_CACHE_MAX_ENTRIES);
    } else if (config) {
      this.enabled = config.enabled;
      this.baseTtl = config.ttl ?? DEFAULT_CACHE_TTL;
      this.maxTtl = config.maxTtl ?? DEFAULT_CACHE_MAX_TTL;
      this.store = new MemoryStore(config.maxEntries ?? DEFAULT_CACHE_MAX_ENTRIES);
    } else {
      this.enabled = false;
      this.baseTtl = DEFAULT_CACHE_TTL;
      this.maxTtl = DEFAULT_CACHE_MAX_TTL;
      this.store = new MemoryStore();
    }
  }

  /**
   * Get a cached query result or execute the query and cache the result
   * @param {string} table - Table name
   * @param {string} method - Method name (find, findFirst, etc.)
   * @param {unknown} options - Query options
   * @param {() => Promise<T>} executor - Function that executes the query
   * @returns {Promise<T>} The query result
   */
  async getOrSet<T>(
    table: string,
    method: string,
    options: unknown,
    executor: () => Promise<T>,
  ): Promise<T> {
    if (!this.enabled) {
      return executor();
    }

    const key = this.buildKey(table, method, options);
    const cached = this.store.get(key);
    if (cached !== undefined) {
      this.store.extendTtl(key, this.baseTtl, this.maxTtl);
      return cached as T;
    }

    const result = await executor();
    this.store.set(key, result, this.baseTtl);
    return result;
  }

  /**
   * Set an entity in the cache by primary key
   * @param {string} table - Table name
   * @param {string | number} id - Primary key value
   * @param {unknown} data - Entity data
   */
  setEntity(table: string, id: string | number, data: unknown): void {
    if (!this.enabled) {
      return;
    }
    const key = `entity:${table}:${id}`;
    this.store.set(key, data, this.baseTtl);
  }

  /**
   * Get a cached entity by primary key
   * @param {string} table - Table name
   * @param {string | number} id - Primary key value
   * @returns {unknown | undefined} Cached entity or undefined
   */
  getEntity(table: string, id: string | number): unknown | undefined {
    if (!this.enabled) {
      return undefined;
    }
    const key = `entity:${table}:${id}`;
    const result = this.store.get(key);
    if (result !== undefined) {
      this.store.extendTtl(key, this.baseTtl, this.maxTtl);
    }
    return result;
  }

  /**
   * Invalidate all cache entries for a table
   * @param {string} table - Table name
   */
  invalidateTable(table: string): void {
    if (!this.enabled) {
      return;
    }
    this.store.invalidateByPrefix(`query:${table}:`);
    this.store.invalidateByPrefix(`entity:${table}:`);
  }

  /**
   * Invalidate a specific entity cache entry
   * @param {string} table - Table name
   * @param {string | number} id - Primary key value
   */
  invalidateEntity(table: string, id: string | number): void {
    if (!this.enabled) {
      return;
    }
    this.store.delete(`entity:${table}:${id}`);
    this.store.invalidateByPrefix(`query:${table}:`);
  }

  /**
   * Update an entity in cache if it exists
   * @param {string} table - Table name
   * @param {string | number} id - Primary key value
   * @param {Record<string, unknown>} data - Updated data
   */
  updateEntity(table: string, id: string | number, data: Record<string, unknown>): void {
    if (!this.enabled) {
      return;
    }
    const key = `entity:${table}:${id}`;
    const existing = this.store.get(key);
    if (existing && typeof existing === "object") {
      this.store.set(key, { ...existing, ...data }, this.baseTtl);
    }
    this.store.invalidateByPrefix(`query:${table}:`);
  }

  /**
   * Clear the entire cache
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Get the number of cached entries
   * @returns {number} Cache size
   */
  get size(): number {
    return this.store.size;
  }

  /**
   * Check if caching is enabled
   * @returns {boolean} Whether caching is enabled
   */
  get isEnabled(): boolean {
    return this.enabled;
  }

  private buildKey(table: string, method: string, options: unknown): string {
    return `query:${table}:${method}:${stableStringify(options)}`;
  }
}
