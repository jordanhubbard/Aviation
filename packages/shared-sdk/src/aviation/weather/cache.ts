/**
 * TTL (Time-To-Live) Cache implementation for weather data
 * 
 * This module provides a thread-safe cache with TTL support for weather API responses.
 * Includes support for stale data fallback when API calls fail.
 */

interface CacheEntry<T> {
  value: T;
  storedAt: number;
  ttlSeconds: number;
}

/**
 * Thread-safe TTL cache for weather data
 */
export class TTLCache {
  private cache: Map<string, CacheEntry<any>>;

  constructor() {
    this.cache = new Map();
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get a value from cache if it hasn't expired
   * 
   * @param key - Cache key
   * @returns Cached value or undefined if expired/missing
   */
  get<T>(key: string): T | undefined {
    const now = Date.now() / 1000;
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    if (now - entry.storedAt > entry.ttlSeconds) {
      return undefined;
    }

    return entry.value as T;
  }

  /**
   * Get a value from cache even if expired (stale data)
   * 
   * @param key - Cache key
   * @returns Cached value or undefined if missing
   */
  getStale<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    return entry ? (entry.value as T) : undefined;
  }

  /**
   * Set a value in cache with TTL
   * 
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttlSeconds - Time-to-live in seconds
   */
  set<T>(key: string, value: T, ttlSeconds: number): void {
    this.cache.set(key, {
      value,
      storedAt: Date.now() / 1000,
      ttlSeconds,
    });
  }

  /**
   * Get a value from cache, or compute and cache it if missing/expired
   * 
   * @param key - Cache key
   * @param ttlSeconds - Time-to-live in seconds
   * @param fn - Function to compute value if cache miss
   * @param allowStaleOnError - If true, return stale value on error
   * @returns Cached or computed value
   */
  async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    fn: () => Promise<T>,
    allowStaleOnError: boolean = false
  ): Promise<T> {
    // Try to get fresh value
    const cached = this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    // Get stale value for fallback
    const stale = allowStaleOnError ? this.getStale<T>(key) : undefined;

    try {
      // Compute fresh value
      const value = await fn();
      this.set(key, value, ttlSeconds);
      return value;
    } catch (error) {
      // Fallback to stale value if allowed
      if (allowStaleOnError && stale !== undefined) {
        return stale;
      }
      throw error;
    }
  }

  /**
   * Get cache size (number of entries)
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Remove a specific key from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }
}

/**
 * Global weather cache instance
 */
export const weatherCache = new TTLCache();
