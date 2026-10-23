import { logger } from './logger.js';

export interface CacheProvider {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
}

class MemoryCache implements CacheProvider {
  private store = new Map<string, { value: unknown; expiresAt: number }>();

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }
}

class RedisCache implements CacheProvider {
  private client: any;
  private ready = false;

  constructor(url: string) {
    // Lazy require to avoid hard dependency issues for environments without Redis
    const { createClient } = require('redis');
    this.client = createClient({ url });
    this.client.on('error', (err: Error) => {
      logger.warn('Redis cache error, falling back to memory', { error: err.message });
    });
  }

  private async ensureConnected(): Promise<void> {
    if (!this.ready) {
      await this.client.connect();
      this.ready = true;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    await this.ensureConnected();
    const raw = await this.client.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.ensureConnected();
    await this.client.set(key, JSON.stringify(value), { EX: ttlSeconds });
  }
}

let cacheInstance: CacheProvider | null = null;

export function getCache(): CacheProvider {
  if (!cacheInstance) {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      try {
        cacheInstance = new RedisCache(redisUrl);
        logger.info('Redis cache enabled');
      } catch (error) {
        logger.warn('Failed to initialize Redis cache, using memory cache', {
          error: error instanceof Error ? error.message : String(error)
        });
        cacheInstance = new MemoryCache();
      }
    } else {
      cacheInstance = new MemoryCache();
    }
  }
  return cacheInstance;
}
