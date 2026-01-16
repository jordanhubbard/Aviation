# Airport Extraction Implementation Spec

**Bead:** [Aviation-o2d] Extract airport database and search to @aviation/shared-sdk
**Priority:** P0 - MVP Blocker
**Effort:** 2-3 days
**Dependencies:** None

---

## Overview

Extract airport database loading, search, and lookup functionality from flight-planner into a reusable shared SDK package.

### Current Implementation

**Location:** `apps/flight-planner/backend/app/models/airport.py` (~210 lines)

**Data Source:** `apps/flight-planner/backend/data/airports_cache.json`
- OurAirports database snapshot
- ~68,000+ airports worldwide
- Size: ~15MB uncompressed

**Key Functions:**
- `load_airport_cache()` - Load JSON into memory
- `get_airport_coordinates(code)` - Lookup by ICAO/IATA
- `search_airports(query, limit)` - Text search
- `search_airports_advanced(query, lat, lon, radius_nm, limit)` - Advanced search with proximity
- `_haversine_nm(lat1, lon1, lat2, lon2)` - Distance calculation
- `_normalize_airport_code(code)` - Code normalization
- `_candidate_codes(code)` - Generate code variations (K-prefix handling)

---

## Target Implementation

### Package Structure

```
packages/shared-sdk/
├── src/aviation/
│   ├── airports.ts          # Main airport module
│   ├── airports.test.ts     # Unit tests
│   └── types.ts             # Type definitions (updated)
├── python/aviation/
│   ├── airports.py          # Python wrapper
│   └── airports_test.py     # Python tests
├── data/
│   └── airports_cache.json  # Airport database
└── README.md                # Updated with airports docs
```

---

## TypeScript API Design

### Core Types

```typescript
// packages/shared-sdk/src/aviation/types.ts

export interface Airport {
  icao: string;              // ICAO code (e.g., "KSFO")
  iata: string;              // IATA code (e.g., "SFO")
  name: string;              // Airport name
  city: string;              // City name
  country: string;           // Country name
  latitude: number;          // Decimal degrees
  longitude: number;         // Decimal degrees
  elevation?: number;        // Elevation in feet
  type: string;              // Airport type (large_airport, medium_airport, etc.)
  distance_nm?: number;      // Distance from query point (if proximity search)
}

export interface AirportSearchOptions {
  query?: string;            // Search query (code or name)
  lat?: number;              // Latitude for proximity search
  lon?: number;              // Longitude for proximity search
  radius_nm?: number;        // Search radius in nautical miles
  limit?: number;            // Max results (default: 20)
}

export interface AirportCache {
  airports: any[];           // Raw airport data
  lastLoaded: Date;          // When cache was loaded
  version: string;           // Cache version
}
```

### Core Functions

```typescript
// packages/shared-sdk/src/aviation/airports.ts

/**
 * Airport database and search functionality
 */
export class AirportDatabase {
  private cache: AirportCache | null = null;
  private cachePromise: Promise<void> | null = null;

  /**
   * Load airport database into memory
   * Automatically called on first use
   */
  async load(): Promise<void>;

  /**
   * Get airport by ICAO or IATA code
   * @param code - ICAO or IATA code (e.g., "KSFO", "SFO")
   * @returns Airport data or null if not found
   * @example
   * const sfo = await airportDb.getAirport("KSFO");
   */
  async getAirport(code: string): Promise<Airport | null>;

  /**
   * Search airports by query string
   * @param query - Search term (code or name)
   * @param limit - Max results (default: 20)
   * @returns Array of matching airports sorted by relevance
   * @example
   * const results = await airportDb.search("San Francisco", 10);
   */
  async search(query: string, limit?: number): Promise<Airport[]>;

  /**
   * Advanced search with proximity filtering
   * @param options - Search options
   * @returns Array of matching airports
   * @example
   * // Find airports near San Francisco within 50nm
   * const nearby = await airportDb.searchAdvanced({
   *   lat: 37.62,
   *   lon: -122.38,
   *   radius_nm: 50,
   *   limit: 10
   * });
   */
  async searchAdvanced(options: AirportSearchOptions): Promise<Airport[]>;

  /**
   * Calculate distance between two coordinates
   * @param lat1 - First latitude
   * @param lon1 - First longitude
   * @param lat2 - Second latitude
   * @param lon2 - Second longitude
   * @returns Distance in nautical miles
   */
  static haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number;

  /**
   * Normalize airport code
   * Handles formats like "KPAO", "PAO", "KPAO - Palo Alto"
   */
  private normalizeCode(code: string): string;

  /**
   * Generate candidate codes for lookup
   * Handles K-prefix variations (US airports)
   */
  private candidateCodes(code: string): string[];

  /**
   * Extract latitude/longitude from airport data
   */
  private extractCoordinates(airport: any): [number, number] | null;

  /**
   * Score search relevance
   */
  private scoreMatch(query: string, airport: any): number;
}

/**
 * Singleton instance for convenience
 */
export const airportDatabase = new AirportDatabase();

/**
 * Convenience functions
 */
export async function getAirport(code: string): Promise<Airport | null> {
  return airportDatabase.getAirport(code);
}

export async function searchAirports(
  query: string,
  limit?: number
): Promise<Airport[]> {
  return airportDatabase.search(query, limit);
}

export async function searchAirportsAdvanced(
  options: AirportSearchOptions
): Promise<Airport[]> {
  return airportDatabase.searchAdvanced(options);
}

export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  return AirportDatabase.haversineDistance(lat1, lon1, lat2, lon2);
}
```

---

## Implementation Details

### 1. Data Loading

```typescript
async load(): Promise<void> {
  // Prevent concurrent loads
  if (this.cachePromise) {
    return this.cachePromise;
  }

  if (this.cache) {
    return; // Already loaded
  }

  this.cachePromise = (async () => {
    try {
      // Load from data directory
      const dataPath = path.join(__dirname, '../../data/airports_cache.json');
      const data = await fs.promises.readFile(dataPath, 'utf-8');
      const airports = JSON.parse(data);

      this.cache = {
        airports,
        lastLoaded: new Date(),
        version: '1.0'
      };

      console.log(`Loaded ${airports.length} airports into cache`);
    } catch (error) {
      console.error('Failed to load airport cache:', error);
      throw error;
    } finally {
      this.cachePromise = null;
    }
  })();

  return this.cachePromise;
}
```

### 2. Code Normalization

```typescript
private normalizeCode(code: string): string {
  if (!code) return '';

  // Handle formats like "KPAO - Palo Alto Airport"
  const beforeDash = code.split(/\s*[-–—]\s*/)[0];
  const token = beforeDash.trim().split(/\s+/)[0];
  const upper = token.toUpperCase();

  // Valid airport code: 3-5 alphanumeric characters
  if (/^[A-Z0-9]{3,5}$/.test(upper)) {
    return upper;
  }

  return code.trim().toUpperCase();
}

private candidateCodes(code: string): string[] {
  const codes = new Set<string>([code]);

  // US airports: Try with/without K prefix
  // FAA codes like "7S5" are stored as "K7S5"
  if (!code.startsWith('K') && 
      (code.length === 3 || (code.length === 4 && /\d/.test(code)))) {
    codes.add(`K${code}`);
  }

  if (code.startsWith('K') && code.length >= 4) {
    codes.add(code.substring(1));
  }

  return Array.from(codes);
}
```

### 3. Search Scoring

```typescript
private scoreMatch(query: string, airport: any): number {
  const q = query.toLowerCase();
  const icao = (airport.icao || '').toLowerCase();
  const iata = (airport.iata || '').toLowerCase();
  const name = (airport.name || '').toLowerCase();
  const city = (airport.city || '').toLowerCase();
  const country = (airport.country || '').toLowerCase();

  // Exact code match (highest priority)
  if (q === icao || q === iata) return 1.0;

  // Code starts with query
  if (icao.startsWith(q)) return 0.95;
  if (iata.startsWith(q)) return 0.9;

  // Code contains query
  if (icao.includes(q) || iata.includes(q)) return 0.85;

  // Name/city contains query
  const text = `${name} ${city} ${country}`;
  if (text.includes(q)) return 0.65;

  // Fuzzy match (difflib-style)
  const ratio = Math.max(
    this.sequenceMatcher(q, icao),
    this.sequenceMatcher(q, iata),
    this.sequenceMatcher(q, name)
  );

  if (ratio < 0.6) return 0; // No match

  return 0.5 + (ratio - 0.6) * 0.5; // 0.5 to 0.7
}

private sequenceMatcher(a: string, b: string): number {
  // Simple Levenshtein-based similarity
  // TODO: Implement proper algorithm or use library
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  
  // Simplified: count matching characters
  let matches = 0;
  const minLen = Math.min(a.length, b.length);
  for (let i = 0; i < minLen; i++) {
    if (a[i] === b[i]) matches++;
  }
  
  return matches / maxLen;
}
```

### 4. Haversine Distance

```typescript
static haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3440.065; // Earth radius in nautical miles
  
  const toRad = (deg: number) => deg * (Math.PI / 180);
  
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}
```

---

## Python Wrapper

```python
# packages/shared-sdk/python/aviation/airports.py

import json
import math
import os
from typing import List, Optional, Dict, Any, Tuple
from dataclasses import dataclass

@dataclass
class Airport:
    """Airport information"""
    icao: str
    iata: str
    name: str
    city: str
    country: str
    latitude: float
    longitude: float
    elevation: Optional[int] = None
    type: str = ""
    distance_nm: Optional[float] = None

class AirportDatabase:
    """Airport database with search capabilities"""
    
    def __init__(self):
        self._cache: Optional[List[Dict[str, Any]]] = None
    
    def load(self) -> None:
        """Load airport cache"""
        if self._cache is not None:
            return
        
        # Load from data directory
        data_path = os.path.join(
            os.path.dirname(__file__),
            '../../data/airports_cache.json'
        )
        
        with open(data_path, 'r') as f:
            self._cache = json.load(f)
        
        print(f"Loaded {len(self._cache)} airports into cache")
    
    def get_airport(self, code: str) -> Optional[Airport]:
        """Get airport by ICAO or IATA code"""
        self.load()
        
        code_upper = self._normalize_code(code)
        candidates = self._candidate_codes(code_upper)
        
        for airport in self._cache:
            icao = (airport.get('icao') or '').upper()
            iata = (airport.get('iata') or '').upper()
            
            if icao in candidates or iata in candidates:
                return self._to_airport(airport)
        
        return None
    
    def search(self, query: str, limit: int = 20) -> List[Airport]:
        """Search airports by query"""
        return self.search_advanced(query=query, limit=limit)
    
    def search_advanced(
        self,
        query: Optional[str] = None,
        lat: Optional[float] = None,
        lon: Optional[float] = None,
        radius_nm: Optional[float] = None,
        limit: int = 20
    ) -> List[Airport]:
        """Advanced airport search with proximity"""
        self.load()
        
        q = (query or '').strip().lower()
        has_geo = lat is not None and lon is not None
        
        if not q and not has_geo:
            return []
        
        candidates = []
        seen = set()
        
        for airport in self._cache:
            coords = self._extract_coords(airport)
            if coords is None:
                continue
            
            lat_a, lon_a = coords
            
            # Calculate distance if geo search
            dist_nm = None
            if has_geo:
                dist_nm = self.haversine_distance(lat, lon, lat_a, lon_a)
                if radius_nm is not None and dist_nm > radius_nm:
                    continue
            
            # Score text match
            score = 0.0
            if q:
                score = self._score_match(q, airport)
                if score < 0.6:
                    continue
            
            # Convert to Airport
            result = self._to_airport(airport)
            if dist_nm is not None:
                result.distance_nm = round(dist_nm, 2)
            
            # Deduplicate
            key = result.icao or result.iata or f"{result.latitude},{result.longitude}"
            if key in seen:
                continue
            seen.add(key)
            
            candidates.append((score, dist_nm or float('inf'), result))
        
        # Sort by relevance or distance
        if has_geo and not q:
            candidates.sort(key=lambda x: x[1])
        else:
            candidates.sort(key=lambda x: (-x[0], x[1]))
        
        return [x[2] for x in candidates[:limit]]
    
    @staticmethod
    def haversine_distance(
        lat1: float,
        lon1: float,
        lat2: float,
        lon2: float
    ) -> float:
        """Calculate distance in nautical miles"""
        R = 3440.065  # Earth radius in NM
        
        φ1 = math.radians(lat1)
        φ2 = math.radians(lat2)
        Δφ = math.radians(lat2 - lat1)
        Δλ = math.radians(lon2 - lon1)
        
        a = (math.sin(Δφ / 2) ** 2 +
             math.cos(φ1) * math.cos(φ2) * math.sin(Δλ / 2) ** 2)
        
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        
        return R * c
    
    # ... (similar private methods as TypeScript)

# Singleton instance
_airport_db = AirportDatabase()

def get_airport(code: str) -> Optional[Airport]:
    """Get airport by code"""
    return _airport_db.get_airport(code)

def search_airports(query: str, limit: int = 20) -> List[Airport]:
    """Search airports"""
    return _airport_db.search(query, limit)
```

---

## Testing Requirements

### Unit Tests (TypeScript)

```typescript
// packages/shared-sdk/src/aviation/airports.test.ts

import { AirportDatabase, getAirport, searchAirports, haversineDistance } from './airports';

describe('AirportDatabase', () => {
  let db: AirportDatabase;

  beforeAll(async () => {
    db = new AirportDatabase();
    await db.load();
  });

  describe('getAirport', () => {
    test('finds airport by ICAO code', async () => {
      const airport = await db.getAirport('KSFO');
      expect(airport).not.toBeNull();
      expect(airport?.icao).toBe('KSFO');
      expect(airport?.name).toContain('San Francisco');
    });

    test('finds airport by IATA code', async () => {
      const airport = await db.getAirport('SFO');
      expect(airport).not.toBeNull();
      expect(airport?.icao).toBe('KSFO');
    });

    test('handles K-prefix variations', async () => {
      const withK = await db.getAirport('KPAO');
      const withoutK = await db.getAirport('PAO');
      expect(withK?.icao).toBe(withoutK?.icao);
    });

    test('returns null for unknown code', async () => {
      const airport = await db.getAirport('XXXX');
      expect(airport).toBeNull();
    });

    test('handles code with description', async () => {
      const airport = await db.getAirport('KSFO - San Francisco Intl');
      expect(airport?.icao).toBe('KSFO');
    });
  });

  describe('search', () => {
    test('searches by airport name', async () => {
      const results = await db.search('San Francisco', 10);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toContain('San Francisco');
    });

    test('searches by ICAO code', async () => {
      const results = await db.search('KJFK', 5);
      expect(results[0].icao).toBe('KJFK');
    });

    test('searches by city', async () => {
      const results = await db.search('Seattle', 10);
      expect(results.some(a => a.city.includes('Seattle'))).toBe(true);
    });

    test('respects limit parameter', async () => {
      const results = await db.search('airport', 5);
      expect(results.length).toBeLessThanOrEqual(5);
    });

    test('returns results sorted by relevance', async () => {
      const results = await db.search('LAX', 5);
      expect(results[0].icao).toBe('KLAX'); // Exact match first
    });
  });

  describe('searchAdvanced', () => {
    test('finds airports by proximity', async () => {
      const results = await db.searchAdvanced({
        lat: 37.62,
        lon: -122.38,
        radius_nm: 50,
        limit: 10
      });
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].distance_nm).toBeDefined();
      expect(results[0].distance_nm!).toBeLessThanOrEqual(50);
    });

    test('combines text search with proximity', async () => {
      const results = await db.searchAdvanced({
        query: 'San',
        lat: 37.62,
        lon: -122.38,
        radius_nm: 100,
        limit: 5
      });
      
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(a => a.name.includes('San'))).toBe(true);
    });

    test('sorts by distance when no query', async () => {
      const results = await db.searchAdvanced({
        lat: 37.62,
        lon: -122.38,
        radius_nm: 50
      });
      
      // Results should be sorted by distance
      for (let i = 1; i < results.length; i++) {
        expect(results[i].distance_nm!).toBeGreaterThanOrEqual(
          results[i - 1].distance_nm!
        );
      }
    });
  });

  describe('haversineDistance', () => {
    test('calculates distance correctly', () => {
      // KSFO to KJFK
      const dist = haversineDistance(37.62, -122.38, 40.64, -73.78);
      expect(dist).toBeCloseTo(2095, 0); // ~2095 NM
    });

    test('returns zero for same coordinates', () => {
      const dist = haversineDistance(37.62, -122.38, 37.62, -122.38);
      expect(dist).toBe(0);
    });

    test('handles southern/western hemispheres', () => {
      const dist = haversineDistance(-33.95, 18.60, -34.05, 151.18);
      expect(dist).toBeGreaterThan(0);
    });
  });

  describe('performance', () => {
    test('search completes in < 10ms', async () => {
      const start = Date.now();
      await db.search('airport', 20);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(10);
    });

    test('proximity search completes in < 20ms', async () => {
      const start = Date.now();
      await db.searchAdvanced({
        lat: 37.62,
        lon: -122.38,
        radius_nm: 100
      });
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(20);
    });
  });
});
```

### Test Coverage Target

- **Overall:** >80%
- **Core functions:** 100% (getAirport, search, searchAdvanced)
- **Distance calculations:** 100%
- **Edge cases:** All tested

---

## Migration Path

### Step 1: Move Data File
```bash
cp apps/flight-planner/backend/data/airports_cache.json packages/shared-sdk/data/
```

### Step 2: Implement TypeScript Version
- Port Python logic to TypeScript
- Add proper types
- Implement tests

### Step 3: Create Python Wrapper
- Match TypeScript API
- Reuse same data file
- Add Python tests

### Step 4: Integrate into Accident-Tracker
```typescript
// apps/aviation-accident-tracker/backend/src/geo/airports.ts
import { getAirport, searchAirports } from '@aviation/shared-sdk';

export async function lookupAirport(code: string) {
  return await getAirport(code);
}
```

### Step 5: Update Flightplanner (Later)
- Replace `app/models/airport.py` with shared SDK
- Update imports
- Verify tests still pass

---

## Dependencies

### NPM Packages
- None (pure JavaScript implementation)

### Data Files
- `airports_cache.json` (15MB)
- Source: https://ourairports.com/data/

### Optional Enhancements
- `fuzzysort` or `fuse.js` for better fuzzy matching
- LRU cache for frequently accessed airports

---

## Acceptance Criteria

- [ ] TypeScript implementation complete and tested
- [ ] Python wrapper complete and tested
- [ ] Data file moved to shared location
- [ ] Search performance <10ms for typical queries
- [ ] Proximity search <20ms
- [ ] Haversine distance accuracy <0.1% error
- [ ] Test coverage >80%
- [ ] Documentation with examples
- [ ] Singleton pattern for easy import
- [ ] Ready for use in accident-tracker
- [ ] No breaking changes to flight-planner interface

---

## Timeline

**Day 1:**
- Set up package structure
- Move data file
- Implement core TypeScript classes
- Implement getAirport and basic search

**Day 2:**
- Implement advanced search with proximity
- Implement haversine distance
- Add scoring and ranking
- Write comprehensive tests

**Day 3:**
- Create Python wrapper
- Python tests
- Documentation
- Performance optimization
- Code review and refinement

---

## Risk Mitigation

### Risks
1. **Large data file** (15MB) in npm package
2. **Memory usage** from loading entire cache
3. **Search performance** with large dataset
4. **Fuzzy matching** accuracy

### Mitigation
1. ✅ Consider gzip compression or streaming
2. ✅ Lazy loading (load on first use)
3. ✅ Benchmark and optimize if needed
4. ✅ Start simple, enhance later if needed

---

## Success Metrics

- ✅ Search queries <10ms (p95)
- ✅ Memory usage <20MB after load
- ✅ Test coverage >80%
- ✅ Zero API changes needed post-launch
- ✅ Accident-tracker integration seamless
- ✅ Flightplanner migration straightforward

---

**Status:** Ready for implementation
**Assigned:** TBD
**Start Date:** TBD
**Target Completion:** 2-3 days
