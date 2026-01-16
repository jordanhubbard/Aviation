/**
 * Weather Cache Utility
 * 
 * Implements TTL-based caching with stale-on-error fallback for weather data.
 * Extracted from flight-planner for shared use.
 */

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttlMs: number;
}

/**
 * Simple in-memory cache with TTL and LRU eviction
 */
export class WeatherCache {
  private cache: Map<string, CacheEntry<any>>;
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  /**
   * Get value from cache if not expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    const age = Date.now() - entry.timestamp;
    
    if (age > entry.ttlMs) {
      // Expired
      return null;
    }

    return entry.value as T;
  }

  /**
   * Get stale value from cache (even if expired)
   */
  getStale<T>(key: string): T | null {
    const entry = this.cache.get(key);
    return entry ? (entry.value as T) : null;
  }

  /**
   * Set value in cache with TTL
   */
  set<T>(key: string, value: T, ttlSeconds: number): void {
    // LRU eviction if cache is full
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttlMs: ttlSeconds * 1000,
    });
  }

  /**
   * Get value or fetch and cache if not present
   */
  async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    fetchFn: () => Promise<T>,
    allowStaleOnError: boolean = false
  ): Promise<T> {
    // Try cache first
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch new value
    try {
      const value = await fetchFn();
      this.set(key, value, ttlSeconds);
      return value;
    } catch (error) {
      // If fetch fails and stale is allowed, return stale value
      if (allowStaleOnError) {
        const stale = this.getStale<T>(key);
        if (stale !== null) {
          return stale;
        }
      }
      throw error;
    }
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Remove expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      const age = now - entry.timestamp;
      if (age > entry.ttlMs) {
        this.cache.delete(key);
      }
    }
  }
}

// Singleton cache instance
export const weatherCache = new WeatherCache();
