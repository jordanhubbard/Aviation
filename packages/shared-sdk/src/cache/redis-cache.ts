/**
 * Redis Cache Implementation for Aviation SDK
 *
 * Provides a unified caching interface with TTL management,
 * hit rate monitoring, and automatic serialization.
 *
 * @module @aviation/shared-sdk/cache
 */

import { createClient, RedisClientType } from 'redis';

export interface CacheConfig {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  defaultTTL?: number;
  enableMetrics?: boolean;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  hitRate: number;
}

export interface CacheOptions {
  ttl?: number; // Seconds
  serialize?: boolean;
}

/**
 * Redis-based cache with metrics and TTL management
 */
export class RedisCache {
  private client: RedisClientType;
  private config: Required<CacheConfig>;
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    hitRate: 0,
  };
  private connected: boolean = false;

  constructor(config: CacheConfig = {}) {
    this.config = {
      host: config.host || process.env.REDIS_HOST || 'localhost',
      port: config.port || parseInt(process.env.REDIS_PORT || '6379'),
      password: config.password || process.env.REDIS_PASSWORD || '',
      db: config.db || 0,
      keyPrefix: config.keyPrefix || 'aviation:',
      defaultTTL: config.defaultTTL || 3600, // 1 hour default
      enableMetrics: config.enableMetrics !== false,
    };

    this.client = createClient({
      socket: {
        host: this.config.host,
        port: this.config.port,
      },
      password: this.config.password || undefined,
      database: this.config.db,
    });

    this.client.on('error', (err) => console.error('Redis Client Error:', err));
    this.client.on('connect', () => {
      this.connected = true;
      console.log('✅ Redis cache connected');
    });
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    if (!this.connected) {
      await this.client.connect();
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.quit();
      this.connected = false;
    }
  }

  /**
   * Generate full cache key with prefix
   */
  private key(key: string): string {
    return `${this.config.keyPrefix}${key}`;
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    try {
      const value = await this.client.get(this.key(key));

      if (value === null) {
        if (this.config.enableMetrics) this.metrics.misses++;
        return null;
      }

      if (this.config.enableMetrics) this.metrics.hits++;

      return options.serialize !== false ? JSON.parse(value) : (value as unknown as T);
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set value in cache with TTL
   */
  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<boolean> {
    try {
      const ttl = options.ttl || this.config.defaultTTL;
      const serialized = options.serialize !== false ? JSON.stringify(value) : String(value);

      await this.client.setEx(this.key(key), ttl, serialized);

      if (this.config.enableMetrics) this.metrics.sets++;
      return true;
    } catch (error) {
      console.error('Cache set error:', error);
      return false;
    }
  }

  /**
   * Get or set pattern - execute function if cache miss
   */
  async getOrSet<T>(
    key: string,
    fn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const cached = await this.get<T>(key, options);

    if (cached !== null) {
      return cached;
    }

    const value = await fn();
    await this.set(key, value, options);

    return value;
  }

  /**
   * Delete key from cache
   */
  async delete(key: string): Promise<boolean> {
    try {
      const result = await this.client.del(this.key(key));
      if (this.config.enableMetrics) this.metrics.deletes++;
      return result > 0;
    } catch (error) {
      console.error('Cache delete error:', error);
      return false;
    }
  }

  /**
   * Delete keys matching pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    try {
      const keys = await this.client.keys(this.key(pattern));
      if (keys.length === 0) return 0;

      const result = await this.client.del(keys);
      if (this.config.enableMetrics) this.metrics.deletes += result;
      return result;
    } catch (error) {
      console.error('Cache delete pattern error:', error);
      return 0;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(this.key(key));
      return result > 0;
    } catch (error) {
      console.error('Cache exists error:', error);
      return false;
    }
  }

  /**
   * Get remaining TTL for key (in seconds)
   */
  async ttl(key: string): Promise<number> {
    try {
      return await this.client.ttl(this.key(key));
    } catch (error) {
      console.error('Cache TTL error:', error);
      return -1;
    }
  }

  /**
   * Extend TTL for existing key
   */
  async extend(key: string, seconds: number): Promise<boolean> {
    try {
      const result = await this.client.expire(this.key(key), seconds);
      return result;
    } catch (error) {
      console.error('Cache extend error:', error);
      return false;
    }
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics {
    const total = this.metrics.hits + this.metrics.misses;
    this.metrics.hitRate = total > 0 ? (this.metrics.hits / total) * 100 : 0;
    return { ...this.metrics };
  }

  /**
   * Reset cache metrics
   */
  resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      hitRate: 0,
    };
  }

  /**
   * Flush entire cache (use with caution!)
   */
  async flush(): Promise<void> {
    try {
      await this.client.flushDb();
      console.warn('⚠️  Cache flushed');
    } catch (error) {
      console.error('Cache flush error:', error);
    }
  }

  /**
   * Get cache info
   */
  async info(): Promise<string> {
    try {
      return await this.client.info();
    } catch (error) {
      console.error('Cache info error:', error);
      return '';
    }
  }
}

/**
 * Cache TTL constants for different data types
 */
export const CacheTTL = {
  AIRPORT_DATA: 86400, // 24 hours (rarely changes)
  WEATHER_CURRENT: 900, // 15 minutes
  WEATHER_FORECAST: 1800, // 30 minutes
  METAR: 1800, // 30 minutes
  TAF: 3600, // 1 hour
  ROUTE_CALCULATION: 3600, // 1 hour
  MAP_TILES: 604800, // 7 days
  STATIC_ASSETS: 2592000, // 30 days
  USER_SESSION: 86400, // 24 hours
  RATE_LIMIT: 60, // 1 minute
} as const;

/**
 * Global cache instance (singleton)
 */
let globalCache: RedisCache | null = null;

/**
 * Get or create global cache instance
 */
export function getCache(config?: CacheConfig): RedisCache {
  if (!globalCache) {
    globalCache = new RedisCache(config);
  }
  return globalCache;
}

/**
 * Initialize and connect cache
 */
export async function initCache(config?: CacheConfig): Promise<RedisCache> {
  const cache = getCache(config);
  await cache.connect();
  return cache;
}
