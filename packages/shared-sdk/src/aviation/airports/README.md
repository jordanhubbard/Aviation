# Airport Services

High-performance airport lookup and search services with LRU caching.

## Features

- **Fast lookups**: ICAO/IATA code lookups with automatic cache warming
- **Smart search**: Full-text search across airport names, cities, countries
- **LRU caching**: Least-Recently-Used eviction for optimal memory usage
- **Performance monitoring**: Built-in cache statistics and metrics
- **Flexible**: Support for US FAA codes (e.g., PAO → KPAO)

## Quick Start

```typescript
import {
  loadAirportData,
  findAirport,
  searchAirports,
  findNearestAirport,
  getAirportCacheStats,
} from '@aviation/shared-sdk';

// Load airport database (one-time initialization)
loadAirportData(airportsFromJSON);

// Fast cached lookups
const sfo = findAirport('KSFO');  // or 'SFO'
console.log(sfo?.name); // "San Francisco International Airport"

// Search airports
const results = searchAirports('San Francisco', 10);
results.forEach(airport => {
  console.log(`${airport.icao} - ${airport.name}`);
});

// Find nearest airport
const nearest = findNearestAirport(37.7749, -122.4194, 50); // Within 50km
console.log(`Nearest: ${nearest?.icao}`);

// Monitor cache performance
const stats = getAirportCacheStats();
console.log(`Code cache hit rate: ${stats.codeCache.hitRate}%`);
console.log(`Search cache size: ${stats.searchCache.size}`);
```

## Cache Performance

The airport service uses two-level caching:

1. **Code Cache** (1000 entries)
   - Caches ICAO/IATA lookups
   - Warmed on startup with all airports
   - ~99% hit rate for typical usage
   - <1ms lookup time (cache hit)

2. **Search Cache** (500 entries)
   - Caches search results by query
   - LRU eviction for memory efficiency
   - Reduces repeated search overhead

## API Reference

### Loading Data

#### `loadAirportData(airports: Airport[], warmCache?: boolean)`

Load airport database and optionally warm the cache.

```typescript
loadAirportData(airports, true); // Warm cache (default)
loadAirportData(airports, false); // Skip warming for testing
```

### Lookups

#### `findAirport(code: string): Airport | undefined`

Find airport by ICAO or IATA code. Handles US FAA codes automatically.

```typescript
findAirport('KSFO'); // ICAO code
findAirport('SFO');  // IATA code
findAirport('PAO');  // US FAA code (auto-converted to KPAO)
```

#### `findAirportRequired(code: string): Airport`

Like `findAirport` but throws `AirportNotFoundError` if not found.

```typescript
try {
  const airport = findAirportRequired('INVALID');
} catch (error) {
  console.error('Airport not found');
}
```

### Search

#### `searchAirports(query: string, limit?: number): Airport[]`

Full-text search across airports. Searches:
- ICAO codes
- IATA codes  
- Airport names
- City names
- Country codes
- Region names

```typescript
searchAirports('San Francisco', 10);
searchAirports('JFK', 5);
searchAirports('United States', 20);
```

### Geocoding

#### `findNearestAirport(lat: number, lon: number, maxDistanceKm?: number): Airport | undefined`

Find nearest airport to coordinates.

```typescript
const nearest = findNearestAirport(37.7749, -122.4194);
const nearbyOnly = findNearestAirport(37.7749, -122.4194, 25); // Within 25km
```

#### `findAirportsNearby(lat: number, lon: number, radiusKm: number, limit?: number): Airport[]`

Find all airports within radius, sorted by distance.

```typescript
const nearby = findAirportsNearby(37.7749, -122.4194, 50, 10);
nearby.forEach(airport => {
  console.log(`${airport.icao} - ${airport.name}`);
});
```

### Cache Management

#### `getAirportCacheStats(): { codeCache: CacheStatistics; searchCache: CacheStatistics }`

Get cache performance statistics.

```typescript
const stats = getAirportCacheStats();
console.log(`Code cache: ${stats.codeCache.hits} hits, ${stats.codeCache.misses} misses`);
console.log(`Hit rate: ${stats.codeCache.hitRate}%`);
console.log(`Evictions: ${stats.codeCache.evictions}`);
```

#### `clearAirportCache(): void`

Clear all caches (useful for testing).

```typescript
clearAirportCache();
```

#### `getMostAccessedAirports(limit?: number): Array<{ airport: Airport; accessCount: number }>`

Get most frequently accessed airports.

```typescript
const top10 = getMostAccessedAirports(10);
top10.forEach(({ airport, accessCount }) => {
  console.log(`${airport.icao}: ${accessCount} accesses`);
});
```

## Data Model

```typescript
interface Airport {
  icao: string;              // 4-letter ICAO code (e.g., "KSFO")
  iata?: string;             // 3-letter IATA code (e.g., "SFO")
  name: string;              // Airport name
  city?: string;             // City name
  country: string;           // Country code (ISO 2-letter)
  region?: string;           // State/region code
  latitude: number;          // Decimal degrees
  longitude: number;         // Decimal degrees
  elevation?: number;        // Feet MSL
  type?: string;             // Airport type
}
```

## Performance Tips

1. **Load data once**: Call `loadAirportData()` once at startup
2. **Let cache warm**: Default cache warming provides instant lookups
3. **Monitor stats**: Use `getAirportCacheStats()` to track performance
4. **Batch lookups**: Cache handles repeated lookups efficiently

## Cache Configuration

Default cache sizes:
- Code cache: 1000 entries
- Search cache: 500 entries

These defaults are optimized for typical usage patterns. The LRU eviction ensures the most frequently accessed data stays cached.

## Testing

The cache includes comprehensive tests:

```bash
cd packages/shared-sdk
npm test src/aviation/airports/__tests__/cache.test.ts
```

Tests cover:
- Basic get/set operations
- LRU eviction behavior
- Statistics tracking
- Batch operations
- Cache warming
- Access frequency tracking
