/**
 * Airport Cache Utility
 * 
 * Implements LRU caching with statistics for airport lookups and searches.
 * Optimized for frequent lookups of the same airports.
 */

export interface CacheStatistics {
  hits: number;
  misses: number;
  size: number;
  maxSize: number;
  hitRate: number;
  evictions: number;
}

interface CacheEntry<T> {
  value: T;
  accessCount: number;
  lastAccess: number;
}

/**
 * LRU Cache for airport data
 * 
 * Uses a Map with LRU eviction policy. Optimized for:
 * - Fast lookups by ICAO/IATA code
 * - Efficient memory usage
 * - Cache statistics for monitoring
 */
export class AirportCache<T = any> {
  private cache: Map<string, CacheEntry<T>>;
  private maxSize: number;
  private hits: number = 0;
  private misses: number = 0;
  private evictions: number = 0;

  constructor(maxSize: number = 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  /**
   * Get value from cache
   * @param key - Cache key
   * @returns Cached value or null if not found
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.misses++;
      return null;
    }

    // Update LRU metadata
    entry.accessCount++;
    entry.lastAccess = Date.now();
    
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    
    this.hits++;
    return entry.value;
  }

  /**
   * Set value in cache
   * @param key - Cache key
   * @param value - Value to cache
   */
  set(key: string, value: T): void {
    // If key exists, update and move to end
    if (this.cache.has(key)) {
      const entry = this.cache.get(key)!;
      entry.value = value;
      entry.lastAccess = Date.now();
      this.cache.delete(key);
      this.cache.set(key, entry);
      return;
    }

    // LRU eviction if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
        this.evictions++;
      }
    }

    // Add new entry
    this.cache.set(key, {
      value,
      accessCount: 0,
      lastAccess: Date.now(),
    });
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Get multiple values from cache
   * @param keys - Array of cache keys
   * @returns Map of found values
   */
  getMany(keys: string[]): Map<string, T> {
    const results = new Map<string, T>();
    
    for (const key of keys) {
      const value = this.get(key);
      if (value !== null) {
        results.set(key, value);
      }
    }
    
    return results;
  }

  /**
   * Set multiple values in cache
   * @param entries - Map of key-value pairs
   */
  setMany(entries: Map<string, T>): void {
    for (const [key, value] of entries.entries()) {
      this.set(key, value);
    }
  }

  /**
   * Warm cache with data
   * @param data - Array of items with keys
   * @param keyFn - Function to extract cache key from item
   */
  warm(data: T[], keyFn: (item: T) => string[]): void {
    for (const item of data) {
      const keys = keyFn(item);
      for (const key of keys) {
        this.set(key, item);
      }
    }
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  /**
   * Get cache statistics
   */
  getStatistics(): CacheStatistics {
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? this.hits / totalRequests : 0;

    return {
      hits: this.hits,
      misses: this.misses,
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: Math.round(hitRate * 10000) / 100, // Percentage with 2 decimals
      evictions: this.evictions,
    };
  }

  /**
   * Reset statistics (keep cached data)
   */
  resetStatistics(): void {
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get all cache keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get all cached values
   */
  values(): T[] {
    return Array.from(this.cache.values()).map(entry => entry.value);
  }

  /**
   * Get entries sorted by access count (most accessed first)
   */
  getMostAccessed(limit: number = 10): Array<{ key: string; value: T; accessCount: number }> {
    const entries = Array.from(this.cache.entries()).map(([key, entry]) => ({
      key,
      value: entry.value,
      accessCount: entry.accessCount,
    }));

    return entries
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, limit);
  }
}

// Singleton cache instances
export const airportCodeCache = new AirportCache(1000); // Cache by ICAO/IATA codes
export const airportSearchCache = new AirportCache<any[]>(500); // Cache search results
