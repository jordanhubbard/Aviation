/**
 * Weather data caching utilities
 * 
 * Provides TTL-based in-memory caching for weather API responses
 * to reduce API calls and improve performance.
 * 
 * @module aviation/weather/weather-cache
 */

import type { WeatherCacheEntry } from './types.js';

/**
 * Simple in-memory cache with TTL support
 */
export class WeatherCache {
  private cache: Map<string, WeatherCacheEntry<any>> = new Map();

  /**
   * Get cached data if it exists and hasn't expired
   * 
   * @param key - Cache key
   * @returns Cached data or null if not found/expired
   * 
   * @example
   * ```typescript
   * const cache = new WeatherCache();
   * const data = cache.get('weather:KSFO');
   * if (data) {
   *   console.log('Using cached data:', data);
   * }
   * ```
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    const now = Date.now();
    if (now - entry.cached_at > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Store data in cache with TTL
   * 
   * @param key - Cache key
   * @param data - Data to cache
   * @param ttl - Time to live in milliseconds
   * 
   * @example
   * ```typescript
   * const cache = new WeatherCache();
   * cache.set('weather:KSFO', weatherData, 5 * 60 * 1000); // 5 minutes
   * ```
   */
  set<T>(key: string, data: T, ttl: number): void {
    const entry: WeatherCacheEntry<T> = {
      data,
      cached_at: Date.now(),
      ttl
    };
    
    this.cache.set(key, entry);
  }

  /**
   * Remove a specific entry from cache
   * 
   * @param key - Cache key
   * 
   * @example
   * ```typescript
   * cache.delete('weather:KSFO');
   * ```
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cached data
   * 
   * @example
   * ```typescript
   * cache.clear();
   * ```
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   * 
   * @returns Cache statistics
   * 
   * @example
   * ```typescript
   * const stats = cache.stats();
   * console.log(`Cache has ${stats.size} entries, ${stats.expired} expired`);
   * ```
   */
  stats(): { size: number; expired: number } {
    const now = Date.now();
    let expired = 0;

    for (const [_key, entry] of this.cache.entries()) {
      if (now - entry.cached_at > entry.ttl) {
        expired++;
      }
    }

    return {
      size: this.cache.size,
      expired
    };
  }

  /**
   * Remove all expired entries from cache
   * 
   * @returns Number of entries removed
   * 
   * @example
   * ```typescript
   * const removed = cache.cleanup();
   * console.log(`Removed ${removed} expired entries`);
   * ```
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.cached_at > entry.ttl) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }
}

/**
 * Singleton weather cache instance
 */
export const weatherCache = new WeatherCache();

/**
 * Generate cache key for weather data
 * 
 * @param source - Data source (e.g., "openweathermap", "metar")
 * @param lat - Latitude
 * @param lon - Longitude
 * @returns Cache key
 * 
 * @example
 * ```typescript
 * const key = generateCacheKey('openweathermap', 37.619, -122.375);
 * console.log(key); // "openweathermap:37.62:-122.38"
 * ```
 */
export function generateCacheKey(source: string, lat: number, lon: number): string {
  // Round to 2 decimal places to improve cache hit rate for nearby coordinates
  const roundedLat = Math.round(lat * 100) / 100;
  const roundedLon = Math.round(lon * 100) / 100;
  return `${source}:${roundedLat}:${roundedLon}`;
}

/**
 * Generate cache key for airport weather data
 * 
 * @param source - Data source
 * @param icao - Airport ICAO code
 * @returns Cache key
 * 
 * @example
 * ```typescript
 * const key = generateAirportCacheKey('metar', 'KSFO');
 * console.log(key); // "metar:KSFO"
 * ```
 */
export function generateAirportCacheKey(source: string, icao: string): string {
  return `${source}:${icao.toUpperCase()}`;
}

/**
 * Default cache TTL values (in milliseconds)
 */
export const DEFAULT_CACHE_TTL = {
  /** Current weather: 5 minutes */
  current: 5 * 60 * 1000,
  
  /** METAR: 5 minutes (METARs update hourly but we check more frequently) */
  metar: 5 * 60 * 1000,
  
  /** Forecast: 10 minutes */
  forecast: 10 * 60 * 1000,
  
  /** Airport lookup: 1 hour (airports don't change often) */
  airport: 60 * 60 * 1000
};
