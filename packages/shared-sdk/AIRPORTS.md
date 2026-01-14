# Airport Database and Search

> Comprehensive airport lookup and search functionality for aviation applications

Part of the **@aviation/shared-sdk** package, extracted from the FlightPlanner application to provide unified airport database access across the entire Aviation monorepo.

## Features

✅ **82,870+ Airports** - Complete global airport database from OurAirports  
✅ **Fast In-Memory Cache** - Lazy loading with sub-second lookups  
✅ **ICAO/IATA Codes** - Support for both international standards  
✅ **US K-Prefix Handling** - Automatic FAA code conversion (PAO → KPAO)  
✅ **Fuzzy Text Search** - Find airports by name, city, or partial code  
✅ **Proximity Search** - Find airports within X nm of a location  
✅ **Distance Calculations** - Haversine distance in nautical miles  
✅ **Dual Language Support** - Identical APIs for TypeScript and Python

---

## Quick Start

### TypeScript

```typescript
import { getAirport, searchAirports, haversineDistance } from '@aviation/shared-sdk';

// Look up by code
const sfo = await getAirport('KSFO');
console.log(sfo.name); // "San Francisco International Airport"

// Search by text
const results = await searchAirports('San Francisco', 5);

// Calculate distance
const distance = haversineDistance(37.619, -122.375, 33.942, -118.408);
console.log(distance); // 293.32 nm (KSFO → KLAX)
```

### Python

```python
from aviation import get_airport, search_airports, haversine_distance

# Look up by code
sfo = get_airport('KSFO')
print(sfo['name'])  # "San Francisco International Airport"

# Search by text
results = search_airports('San Francisco', 5)

# Calculate distance
distance = haversine_distance(37.619, -122.375, 33.942, -118.408)
print(distance)  # 293.32 nm (KSFO → KLAX)
```

---

## API Reference

### `getAirport(code: string): Promise<Airport | null>`

Look up an airport by ICAO or IATA code.

**Supported Code Formats:**
- **ICAO codes** (4 letters): `"KSFO"`, `"EGLL"`, `"RJTT"`
- **IATA codes** (3 letters): `"SFO"`, `"LHR"`, `"HND"`
- **US FAA codes** (auto K-prefix): `"PAO"` → tries `"KPAO"`
- **With descriptions**: `"KSFO - San Francisco"`
- **Case-insensitive**: `"ksfo"`, `"KsFo"`, `"KSFO"`

**Returns:** `Airport` object or `null` if not found

**Airport Interface:**
```typescript
interface Airport {
  icao: string;          // ICAO code (e.g., "KSFO")
  iata: string;          // IATA code (e.g., "SFO")
  name: string | null;   // Airport name
  city: string;          // City name
  country: string;       // Country code (ISO 2-letter)
  latitude: number;      // Decimal degrees
  longitude: number;     // Decimal degrees
  elevation: number | null; // Feet MSL
  type: string;          // Airport type (e.g., "large_airport")
  distance_nm?: number;  // Distance in nm (proximity search only)
}
```

**Examples:**

```typescript
// ICAO code lookup
const sfo = await getAirport('KSFO');
console.log(sfo.name); // "San Francisco International Airport"

// IATA code lookup
const lax = await getAirport('LAX');
console.log(lax.icao); // "KLAX"

// US FAA code (auto K-prefix)
const pao = await getAirport('PAO');
console.log(pao.icao); // "KPAO" (Palo Alto Airport)

// Code with description
const jfk = await getAirport('KJFK - John F Kennedy');
console.log(jfk.iata); // "JFK"

// Non-existent airport
const none = await getAirport('XXXX');
console.log(none); // null
```

---

### `searchAirports(query: string, limit?: number): Promise<Airport[]>`

Search airports by text query with fuzzy matching.

**Parameters:**
- `query` - Search text (code, name, city, country)
- `limit` - Maximum results (default: 10)

**Returns:** Array of `Airport` objects sorted by relevance

**Search Scoring:**
- **1.0** - Exact code match
- **0.95** - ICAO starts with query
- **0.9** - IATA starts with query
- **0.85** - Code contains query
- **0.65** - Text contains query
- **0.5-0.7** - Fuzzy match (Levenshtein similarity)

**Examples:**

```typescript
// Search by name
const sf = await searchAirports('San Francisco', 10);
console.log(sf[0].name); // "San Francisco International Airport"

// Search by city
const oakland = await searchAirports('Oakland', 5);

// Partial code search
const san = await searchAirports('SAN', 10);
// Returns: KSAN (San Diego), SANC (Argentina), SANE (Argentina), ...

// Exact code (highest score)
const lax = await searchAirports('LAX', 5);
console.log(lax[0].icao); // "KLAX" (exact match ranks first)

// International search
const london = await searchAirports('London', 10);
// Returns: EGLL (Heathrow), EGKK (Gatwick), EGLC (City), ...
```

---

### `searchAirportsAdvanced(options: AirportSearchOptions): Promise<Airport[]>`

Advanced search with text query and/or proximity filtering.

**Options:**
```typescript
interface AirportSearchOptions {
  query?: string;      // Text search query (optional)
  limit?: number;      // Max results (default: 20)
  lat?: number;        // Reference latitude (optional)
  lon?: number;        // Reference longitude (optional)
  radius_nm?: number;  // Search radius in nm (optional, requires lat/lon)
}
```

**Returns:** Array of `Airport` objects sorted by relevance (text search) or distance (proximity search)

**Proximity Search Features:**
- All results include `distance_nm` field
- Sorted by distance (closest first)
- Optional radius filtering
- Can be combined with text search

**Examples:**

```typescript
// Text search (same as searchAirports)
const results = await searchAirportsAdvanced({ 
  query: 'International', 
  limit: 10 
});

// Proximity search (all airports within 50nm)
const nearby = await searchAirportsAdvanced({
  lat: 37.619,        // KSFO coordinates
  lon: -122.375,
  radius_nm: 50,
  limit: 20
});
console.log(nearby[0].icao);        // "KSFO" (closest)
console.log(nearby[0].distance_nm); // 0.02 nm

// Find 10 closest airports (no radius limit)
const closest = await searchAirportsAdvanced({
  lat: 37.619,
  lon: -122.375,
  limit: 10
});
// Returns airports sorted by distance

// Combined text + proximity search
const combined = await searchAirportsAdvanced({
  query: 'International',
  lat: 37.619,
  lon: -122.375,
  radius_nm: 100,
  limit: 10
});
// Returns airports matching "International" within 100nm,
// ranked by relevance score then distance
```

---

### `haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number`

Calculate great circle distance between two points on Earth.

**Parameters:**
- `lat1`, `lon1` - Starting coordinates (decimal degrees)
- `lat2`, `lon2` - Ending coordinates (decimal degrees)

**Returns:** Distance in nautical miles

**Formula:** Uses the haversine formula with Earth radius = 3440.065 nm

**Examples:**

```typescript
// KSFO to KLAX
const distance1 = haversineDistance(37.619, -122.375, 33.942, -118.408);
console.log(distance1); // 293.32 nm

// KJFK to KLAX (transcontinental)
const distance2 = haversineDistance(40.640, -73.779, 33.942, -118.408);
console.log(distance2); // 2145.90 nm

// Same point
const distance3 = haversineDistance(37.619, -122.375, 37.619, -122.375);
console.log(distance3); // 0 nm

// International (YSSY to YMML - Sydney to Melbourne)
const distance4 = haversineDistance(-33.946, 151.177, -37.669, 144.841);
console.log(distance4); // 442.87 nm
```

---

## Common Use Cases

### 1. Flight Planning

```typescript
import { getAirport, haversineDistance } from '@aviation/shared-sdk';

async function planRoute(departure: string, destination: string) {
  const dep = await getAirport(departure);
  const dest = await getAirport(destination);
  
  if (!dep || !dest) {
    throw new Error('Airport not found');
  }
  
  const distance = haversineDistance(
    dep.latitude, dep.longitude,
    dest.latitude, dest.longitude
  );
  
  console.log(`Route: ${dep.icao} → ${dest.icao}`);
  console.log(`Distance: ${distance.toFixed(2)} nm`);
  
  return { dep, dest, distance };
}

await planRoute('KSFO', 'KJFK');
```

### 2. Airport Search UI

```typescript
import { searchAirports } from '@aviation/shared-sdk';

async function handleSearchInput(query: string) {
  if (query.length < 2) return [];
  
  const results = await searchAirports(query, 10);
  
  return results.map(airport => ({
    label: `${airport.icao} - ${airport.name}`,
    value: airport.icao,
    subtitle: `${airport.city}, ${airport.country}`
  }));
}

// User types "San F"
const suggestions = await handleSearchInput('San F');
// Returns: [
//   { label: "KSFO - San Francisco Intl", value: "KSFO", subtitle: "San Francisco, US" },
//   ...
// ]
```

### 3. Find Nearest Airports

```typescript
import { searchAirportsAdvanced } from '@aviation/shared-sdk';

async function findNearestAirports(lat: number, lon: number, count: number = 5) {
  const results = await searchAirportsAdvanced({
    lat,
    lon,
    limit: count
  });
  
  return results.map(airport => ({
    ...airport,
    distanceMiles: (airport.distance_nm! * 1.15078).toFixed(1)
  }));
}

// Find 5 nearest airports to current location
const nearest = await findNearestAirports(37.5, -122.3, 5);
console.log(nearest);
// [
//   { icao: "KSFO", name: "San Francisco Intl", distance_nm: 7.23, distanceMiles: "8.3" },
//   { icao: "KOAK", name: "Oakland Intl", distance_nm: 12.45, distanceMiles: "14.3" },
//   ...
// ]
```

### 4. Alternate Airport Selection

```typescript
import { searchAirportsAdvanced } from '@aviation/shared-sdk';

async function findAlternates(departure: string, maxDistance: number = 100) {
  const dep = await getAirport(departure);
  if (!dep) return [];
  
  const alternates = await searchAirportsAdvanced({
    lat: dep.latitude,
    lon: dep.longitude,
    radius_nm: maxDistance,
    limit: 20
  });
  
  // Filter out the departure airport and only include airports with runways
  return alternates.filter(a => 
    a.icao !== dep.icao && 
    ['large_airport', 'medium_airport'].includes(a.type)
  );
}

const alternates = await findAlternates('KSFO', 100);
console.log(`Found ${alternates.length} alternate airports within 100nm`);
```

### 5. Airport Information Display

```typescript
import { getAirport } from '@aviation/shared-sdk';

async function getAirportInfo(code: string) {
  const airport = await getAirport(code);
  if (!airport) return null;
  
  return {
    full_name: `${airport.name} (${airport.icao}/${airport.iata})`,
    location: `${airport.city}, ${airport.country}`,
    coordinates: `${airport.latitude.toFixed(4)}°, ${airport.longitude.toFixed(4)}°`,
    elevation: airport.elevation ? `${airport.elevation} ft MSL` : 'Unknown',
    type: airport.type.replace('_', ' ').toUpperCase()
  };
}

const info = await getAirportInfo('KSFO');
console.log(info);
// {
//   full_name: "San Francisco International Airport (KSFO/SFO)",
//   location: "San Francisco, US",
//   coordinates: "37.6190°, -122.3750°",
//   elevation: "13 ft MSL",
//   type: "LARGE AIRPORT"
// }
```

---

## Performance

### Benchmarks

**TypeScript (Node.js 20+):**
- `getAirport()`: < 50ms (cached)
- `searchAirports()`: < 250ms (82K airports, fuzzy matching)
- `searchAirportsAdvanced()` (text): < 200ms
- `searchAirportsAdvanced()` (geo): < 200ms
- `haversineDistance()`: < 1ms

**Python (3.11+):**
- `get_airport()`: < 50ms (cached)
- `search_airports()`: < 2s (82K airports, difflib matching)
- `search_airports_advanced()` (text): < 2s
- `search_airports_advanced()` (geo): < 500ms
- `haversine_distance()`: < 1ms

### Optimization Tips

1. **Cache airports in your application:**
   ```typescript
   // Pre-load commonly used airports
   const commonAirports = await Promise.all([
     getAirport('KSFO'), getAirport('KLAX'), getAirport('KJFK')
   ]);
   ```

2. **Limit search results:**
   ```typescript
   // Only get what you need
   const results = await searchAirports('International', 5);
   ```

3. **Use exact codes when possible:**
   ```typescript
   // Fastest (direct lookup)
   const sfo = await getAirport('KSFO');
   
   // Slower (text search)
   const results = await searchAirports('San Francisco', 1);
   ```

---

## Data Source

**Airport Data:** [OurAirports](https://ourairports.com/data/)  
**Coverage:** 82,870+ airports worldwide  
**Last Updated:** January 2026

**Included Data:**
- ICAO & IATA codes
- Airport names
- Coordinates (lat/lon)
- Elevation
- City & country
- Airport type

---

## Testing

### TypeScript

```bash
cd packages/shared-sdk
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

**Coverage:** 41 tests, >80% code coverage

### Python

```bash
cd packages/shared-sdk/python
python -m pytest tests/test_airports.py -v
python -m pytest tests/ --cov=aviation --cov-report=html
```

**Coverage:** 39 tests, >80% code coverage

---

## Migration Guide

Migrating from `apps/flightplanner/backend/app/models/airport.py`:

**Before:**
```python
from app.models.airport import get_airport_coordinates, search_airports_advanced

airport = get_airport_coordinates('KSFO')
results = search_airports_advanced(query='San Francisco', limit=10)
```

**After:**
```python
from aviation import get_airport, search_airports_advanced

airport = get_airport('KSFO')
results = search_airports_advanced(query='San Francisco', limit=10)
```

**Changes:**
- ✅ Function names simplified (`get_airport_coordinates` → `get_airport`)
- ✅ Return type consistent (always `dict` or `None`)
- ✅ Empty string handling improved (returns `None` instead of first airport)
- ✅ Added TypeScript support
- ✅ Comprehensive test coverage

---

## Contributing

When adding features to airport search:

1. **Add to both TypeScript and Python** (API parity)
2. **Write tests** (target >80% coverage)
3. **Update this documentation**
4. **Run linters and tests:**
   ```bash
   # TypeScript
   npm run lint
   npm test
   
   # Python
   black python/aviation/
   flake8 python/aviation/
   python -m pytest python/tests/
   ```

---

## License

MIT - Part of the Aviation Monorepo

**Bead:** Aviation-o2d (P0 - MVP Blocker)  
**Package:** @aviation/shared-sdk v0.1.0
