/**
 * Airport services module
 * 
 * Provides airport lookup, search, and reverse geocoding functionality
 * with built-in LRU caching for improved performance.
 * 
 * @example
 * ```typescript
 * import {
 *   loadAirportData,
 *   findAirport,
 *   searchAirports,
 *   getAirportCacheStats
 * } from '@aviation/shared-sdk';
 * 
 * // Load airport data (with automatic cache warming)
 * loadAirportData(airportsFromJSON);
 * 
 * // Fast cached lookups
 * const sfo = findAirport('KSFO');
 * const results = searchAirports('San Francisco');
 * 
 * // Monitor cache performance
 * const stats = getAirportCacheStats();
 * console.log(`Cache hit rate: ${stats.codeCache.hitRate}%`);
 * ```
 */

export * from './types';
export * from './service';
export * from './cache';
