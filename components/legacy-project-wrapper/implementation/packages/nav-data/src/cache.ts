import { NavDatabase } from "./database";
import { NavAirport, NavNavaid } from "./storage";

export interface NavCacheOptions {
  maxAirports?: number;
  maxNavaids?: number;
}

export interface NavCacheMetrics {
  airportHits: number;
  airportMisses: number;
  navaidHits: number;
  navaidMisses: number;
}

export class NavDatabaseCache {
  private airportCache = new Map<string, NavAirport>();
  private navaidCache = new Map<string, NavNavaid>();
  private metrics: NavCacheMetrics = {
    airportHits: 0,
    airportMisses: 0,
    navaidHits: 0,
    navaidMisses: 0,
  };

  constructor(
    private database: NavDatabase,
    private options: NavCacheOptions = {},
  ) {}

  getAirport(icao: string): NavAirport | undefined {
    const key = icao.trim().toUpperCase();
    const cached = this.airportCache.get(key);
    if (cached) {
      this.metrics.airportHits += 1;
      return cached;
    }

    this.metrics.airportMisses += 1;
    const airport = this.database.getAirport(key);
    if (airport) {
      this.airportCache.set(key, airport);
      this.enforceLimit(this.airportCache, this.options.maxAirports);
    }
    return airport;
  }

  getNavaid(identifier: string): NavNavaid | undefined {
    const key = identifier.trim().toUpperCase();
    const cached = this.navaidCache.get(key);
    if (cached) {
      this.metrics.navaidHits += 1;
      return cached;
    }

    this.metrics.navaidMisses += 1;
    const navaid = this.database.getNavaid(key);
    if (navaid) {
      this.navaidCache.set(key, navaid);
      this.enforceLimit(this.navaidCache, this.options.maxNavaids);
    }
    return navaid;
  }

  invalidateAirport(icao: string): void {
    const key = icao.trim().toUpperCase();
    this.airportCache.delete(key);
  }

  invalidateNavaid(identifier: string): void {
    const key = identifier.trim().toUpperCase();
    this.navaidCache.delete(key);
  }

  invalidateAll(): void {
    this.airportCache.clear();
    this.navaidCache.clear();
  }

  replaceDatabase(database: NavDatabase): void {
    this.database = database;
    this.invalidateAll();
  }

  getMetrics(): NavCacheMetrics {
    return { ...this.metrics };
  }

  resetMetrics(): void {
    this.metrics = {
      airportHits: 0,
      airportMisses: 0,
      navaidHits: 0,
      navaidMisses: 0,
    };
  }

  private enforceLimit<K, V>(cache: Map<K, V>, max?: number): void {
    if (!max || cache.size <= max) {
      return;
    }
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) {
      cache.delete(oldestKey);
    }
  }
}
