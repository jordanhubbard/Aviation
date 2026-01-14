# Navigation Utilities Extraction Implementation Spec

**Bead:** [Aviation-ywm] Extract navigation utilities to @aviation/shared-sdk
**Priority:** P0 - MVP Blocker
**Effort:** 2 days
**Dependencies:** None

---

## Overview

Extract navigation and distance calculation utilities from flightplanner into reusable shared SDK, including great circle distance, bearing calculations, coordinate utilities, and time/speed/distance calculations.

### Current Implementation

**Location:** `apps/flightplanner/backend/app/models/airport.py`
- `_haversine_nm(lat1, lon1, lat2, lon2)` - Distance in nautical miles (~20 lines)

**Additional Sources:**
- Flight planning calculations (implicit in route building)
- Time/speed/distance calculations (scattered across codebase)
- Coordinate validation and normalization

---

## Target Implementation

### Package Structure

```
packages/shared-sdk/
├── src/aviation/navigation/
│   ├── index.ts                 # Main exports
│   ├── distance.ts              # Distance calculations
│   ├── bearing.ts               # Bearing calculations
│   ├── coordinates.ts           # Coordinate utilities
│   ├── tsd.ts                   # Time/speed/distance
│   ├── types.ts                 # Type definitions
│   ├── distance.test.ts         # Tests
│   ├── bearing.test.ts
│   ├── coordinates.test.ts
│   └── tsd.test.ts
└── python/aviation/navigation/
    ├── __init__.py
    ├── distance.py
    ├── bearing.py
    ├── coordinates.py
    └── tsd.py
```

---

## TypeScript API Design

### Core Types

```typescript
// packages/shared-sdk/src/aviation/navigation/types.ts

export interface Coordinate {
  latitude: number;              // Decimal degrees
  longitude: number;             // Decimal degrees
  altitude?: number;             // Feet MSL (optional)
}

export interface DistanceResult {
  nautical_miles: number;
  statute_miles: number;
  kilometers: number;
}

export interface BearingResult {
  initial_bearing: number;       // Degrees (0-360)
  final_bearing: number;         // Degrees (0-360)
  magnetic_variation?: number;   // Degrees (if available)
}

export interface TimeSpeedDistance {
  time_hours?: number;           // Time in hours
  speed_knots?: number;          // Speed in knots
  distance_nm?: number;          // Distance in nautical miles
}

export type DistanceUnit = 'nm' | 'sm' | 'km';
export type SpeedUnit = 'knots' | 'mph' | 'kmh';
```

### Distance Calculations

```typescript
// packages/shared-sdk/src/aviation/navigation/distance.ts

/**
 * Constants for distance calculations
 */
export const EARTH_RADIUS = {
  NM: 3440.065,      // Nautical miles
  SM: 3958.8,        // Statute miles
  KM: 6371.0,        // Kilometers
  METERS: 6371000    // Meters
};

/**
 * Calculate great circle distance between two coordinates
 * Uses the Haversine formula for accuracy
 * 
 * @param lat1 - Starting latitude (decimal degrees)
 * @param lon1 - Starting longitude (decimal degrees)
 * @param lat2 - Ending latitude (decimal degrees)
 * @param lon2 - Ending longitude (decimal degrees)
 * @param unit - Distance unit (default: 'nm')
 * @returns Distance in specified unit
 * 
 * @example
 * // Distance from KSFO to KJFK
 * const dist = haversineDistance(37.62, -122.38, 40.64, -73.78);
 * console.log(dist); // ~2095 NM
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  unit: DistanceUnit = 'nm'
): number {
  const R = EARTH_RADIUS[unit.toUpperCase() as keyof typeof EARTH_RADIUS];
  
  const φ1 = toRadians(lat1);
  const φ2 = toRadians(lat2);
  const Δφ = toRadians(lat2 - lat1);
  const Δλ = toRadians(lon2 - lon1);

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Calculate distance with all units
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): DistanceResult {
  return {
    nautical_miles: haversineDistance(lat1, lon1, lat2, lon2, 'nm'),
    statute_miles: haversineDistance(lat1, lon1, lat2, lon2, 'sm'),
    kilometers: haversineDistance(lat1, lon1, lat2, lon2, 'km')
  };
}

/**
 * Calculate distance between two Coordinate objects
 */
export function distanceBetween(
  coord1: Coordinate,
  coord2: Coordinate,
  unit: DistanceUnit = 'nm'
): number {
  return haversineDistance(
    coord1.latitude,
    coord1.longitude,
    coord2.latitude,
    coord2.longitude,
    unit
  );
}

/**
 * Calculate total distance along a route
 * @param waypoints - Array of coordinates
 * @param unit - Distance unit (default: 'nm')
 * @returns Total distance
 */
export function totalRouteDistance(
  waypoints: Coordinate[],
  unit: DistanceUnit = 'nm'
): number {
  if (waypoints.length < 2) return 0;

  let total = 0;
  for (let i = 1; i < waypoints.length; i++) {
    total += distanceBetween(waypoints[i - 1], waypoints[i], unit);
  }

  return total;
}

/**
 * Check if two coordinates are within a certain distance
 * @param coord1 - First coordinate
 * @param coord2 - Second coordinate
 * @param radius - Radius in nautical miles
 * @returns True if within radius
 */
export function isWithinRadius(
  coord1: Coordinate,
  coord2: Coordinate,
  radius: number
): boolean {
  const distance = distanceBetween(coord1, coord2, 'nm');
  return distance <= radius;
}

/**
 * Convert degrees to radians
 */
export function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Convert radians to degrees
 */
export function toDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}
```

### Bearing Calculations

```typescript
// packages/shared-sdk/src/aviation/navigation/bearing.ts

/**
 * Calculate initial bearing from point 1 to point 2
 * @returns Bearing in degrees (0-360)
 */
export function initialBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const φ1 = toRadians(lat1);
  const φ2 = toRadians(lat2);
  const Δλ = toRadians(lon2 - lon1);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) -
            Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  const θ = Math.atan2(y, x);

  return (toDegrees(θ) + 360) % 360;
}

/**
 * Calculate final bearing arriving at point 2 from point 1
 * @returns Bearing in degrees (0-360)
 */
export function finalBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  // Final bearing is initial bearing from point 2 to point 1, reversed
  const bearing = initialBearing(lat2, lon2, lat1, lon1);
  return (bearing + 180) % 360;
}

/**
 * Calculate both initial and final bearings
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): BearingResult {
  return {
    initial_bearing: Math.round(initialBearing(lat1, lon1, lat2, lon2)),
    final_bearing: Math.round(finalBearing(lat1, lon1, lat2, lon2))
  };
}

/**
 * Calculate bearing between two Coordinate objects
 */
export function bearingBetween(
  coord1: Coordinate,
  coord2: Coordinate
): BearingResult {
  return calculateBearing(
    coord1.latitude,
    coord1.longitude,
    coord2.latitude,
    coord2.longitude
  );
}

/**
 * Calculate destination point given distance and bearing
 * @param lat - Starting latitude
 * @param lon - Starting longitude
 * @param distance - Distance in nautical miles
 * @param bearing - Bearing in degrees
 * @returns Destination coordinate
 */
export function destinationPoint(
  lat: number,
  lon: number,
  distance: number,
  bearing: number
): Coordinate {
  const R = 3440.065; // Earth radius in NM
  const δ = distance / R; // Angular distance
  const θ = toRadians(bearing);

  const φ1 = toRadians(lat);
  const λ1 = toRadians(lon);

  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(δ) +
    Math.cos(φ1) * Math.sin(δ) * Math.cos(θ)
  );

  const λ2 = λ1 + Math.atan2(
    Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
    Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2)
  );

  return {
    latitude: toDegrees(φ2),
    longitude: toDegrees(λ2)
  };
}

/**
 * Normalize bearing to 0-360 range
 */
export function normalizeBearing(bearing: number): number {
  return ((bearing % 360) + 360) % 360;
}

/**
 * Calculate reciprocal bearing
 */
export function reciprocalBearing(bearing: number): number {
  return (bearing + 180) % 360;
}

/**
 * Calculate magnetic bearing from true bearing
 * @param trueBearing - True bearing in degrees
 * @param variation - Magnetic variation in degrees (east positive)
 * @returns Magnetic bearing in degrees
 */
export function trueToMagnetic(
  trueBearing: number,
  variation: number
): number {
  return normalizeBearing(trueBearing - variation);
}

/**
 * Calculate true bearing from magnetic bearing
 */
export function magneticToTrue(
  magneticBearing: number,
  variation: number
): number {
  return normalizeBearing(magneticBearing + variation);
}
```

### Coordinate Utilities

```typescript
// packages/shared-sdk/src/aviation/navigation/coordinates.ts

/**
 * Validate coordinate values
 */
export function isValidCoordinate(lat: number, lon: number): boolean {
  return (
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180 &&
    !isNaN(lat) &&
    !isNaN(lon) &&
    isFinite(lat) &&
    isFinite(lon)
  );
}

/**
 * Validate Coordinate object
 */
export function validateCoordinate(coord: Coordinate): boolean {
  return isValidCoordinate(coord.latitude, coord.longitude);
}

/**
 * Normalize longitude to -180 to +180 range
 */
export function normalizeLongitude(lon: number): number {
  while (lon > 180) lon -= 360;
  while (lon < -180) lon += 360;
  return lon;
}

/**
 * Normalize latitude to -90 to +90 range
 */
export function normalizeLatitude(lat: number): number {
  if (lat > 90) return 90;
  if (lat < -90) return -90;
  return lat;
}

/**
 * Format coordinate as DMS (Degrees Minutes Seconds)
 * @example
 * formatDMS(37.62, -122.38)
 * // Returns: "37°37'12\"N 122°22'48\"W"
 */
export function formatDMS(lat: number, lon: number): string {
  const latStr = formatLatitudeDMS(lat);
  const lonStr = formatLongitudeDMS(lon);
  return `${latStr} ${lonStr}`;
}

export function formatLatitudeDMS(lat: number): string {
  const abs = Math.abs(lat);
  const degrees = Math.floor(abs);
  const minutes = Math.floor((abs - degrees) * 60);
  const seconds = Math.round(((abs - degrees) * 60 - minutes) * 60);
  const direction = lat >= 0 ? 'N' : 'S';
  
  return `${degrees}°${minutes}'${seconds}"${direction}`;
}

export function formatLongitudeDMS(lon: number): string {
  const abs = Math.abs(lon);
  const degrees = Math.floor(abs);
  const minutes = Math.floor((abs - degrees) * 60);
  const seconds = Math.round(((abs - degrees) * 60 - minutes) * 60);
  const direction = lon >= 0 ? 'E' : 'W';
  
  return `${degrees}°${minutes}'${seconds}"${direction}`;
}

/**
 * Format coordinate as decimal degrees
 */
export function formatDecimal(lat: number, lon: number, precision: number = 6): string {
  return `${lat.toFixed(precision)}, ${lon.toFixed(precision)}`;
}

/**
 * Parse DMS string to decimal degrees
 * @example
 * parseDMS("37°37'12\"N 122°22'48\"W")
 * // Returns: [37.62, -122.38]
 */
export function parseDMS(dms: string): [number, number] | null {
  // Simple regex-based parser
  const pattern = /(\d+)°(\d+)'(\d+(?:\.\d+)?)[""]([NSEW])\s+(\d+)°(\d+)'(\d+(?:\.\d+)?)[""]([NSEW])/;
  const match = dms.match(pattern);
  
  if (!match) return null;
  
  const lat = parseInt(match[1]) + 
              parseInt(match[2]) / 60 + 
              parseFloat(match[3]) / 3600;
  const latSign = match[4] === 'N' ? 1 : -1;
  
  const lon = parseInt(match[5]) + 
              parseInt(match[6]) / 60 + 
              parseFloat(match[7]) / 3600;
  const lonSign = match[8] === 'E' ? 1 : -1;
  
  return [lat * latSign, lon * lonSign];
}

/**
 * Calculate midpoint between two coordinates
 */
export function midpoint(coord1: Coordinate, coord2: Coordinate): Coordinate {
  const φ1 = toRadians(coord1.latitude);
  const φ2 = toRadians(coord2.latitude);
  const λ1 = toRadians(coord1.longitude);
  const Δλ = toRadians(coord2.longitude - coord1.longitude);

  const Bx = Math.cos(φ2) * Math.cos(Δλ);
  const By = Math.cos(φ2) * Math.sin(Δλ);

  const φ3 = Math.atan2(
    Math.sin(φ1) + Math.sin(φ2),
    Math.sqrt((Math.cos(φ1) + Bx) * (Math.cos(φ1) + Bx) + By * By)
  );

  const λ3 = λ1 + Math.atan2(By, Math.cos(φ1) + Bx);

  return {
    latitude: toDegrees(φ3),
    longitude: toDegrees(λ3)
  };
}

/**
 * Interpolate between two coordinates
 * @param coord1 - Start coordinate
 * @param coord2 - End coordinate
 * @param fraction - Fraction between 0 and 1
 * @returns Interpolated coordinate
 */
export function interpolate(
  coord1: Coordinate,
  coord2: Coordinate,
  fraction: number
): Coordinate {
  const φ1 = toRadians(coord1.latitude);
  const φ2 = toRadians(coord2.latitude);
  const λ1 = toRadians(coord1.longitude);
  const λ2 = toRadians(coord2.longitude);

  const a = Math.sin((1 - fraction) * φ1) * Math.cos(φ1);
  const b = Math.sin(fraction * φ2) * Math.cos(φ2);

  const φ = Math.atan2(
    a + b,
    Math.sqrt(Math.pow(Math.cos((1 - fraction) * φ1), 2) +
              Math.pow(Math.cos(fraction * φ2), 2))
  );

  const λ = λ1 * (1 - fraction) + λ2 * fraction;

  return {
    latitude: toDegrees(φ),
    longitude: toDegrees(λ)
  };
}
```

### Time/Speed/Distance Calculations

```typescript
// packages/shared-sdk/src/aviation/navigation/tsd.ts

/**
 * Time-Speed-Distance calculations
 * Solves for missing value given two others
 */

export interface TSDResult extends TimeSpeedDistance {
  calculated: 'time' | 'speed' | 'distance';
}

/**
 * Calculate time given speed and distance
 * @param speed_knots - Speed in knots (TAS or ground speed)
 * @param distance_nm - Distance in nautical miles
 * @returns Time in hours
 */
export function calculateTime(
  speed_knots: number,
  distance_nm: number
): number {
  if (speed_knots <= 0) {
    throw new Error('Speed must be greater than zero');
  }
  return distance_nm / speed_knots;
}

/**
 * Calculate speed given time and distance
 * @param time_hours - Time in hours
 * @param distance_nm - Distance in nautical miles
 * @returns Speed in knots
 */
export function calculateSpeed(
  time_hours: number,
  distance_nm: number
): number {
  if (time_hours <= 0) {
    throw new Error('Time must be greater than zero');
  }
  return distance_nm / time_hours;
}

/**
 * Calculate distance given time and speed
 * @param time_hours - Time in hours
 * @param speed_knots - Speed in knots
 * @returns Distance in nautical miles
 */
export function calculateDistance(
  time_hours: number,
  speed_knots: number
): number {
  return time_hours * speed_knots;
}

/**
 * Solve T/S/D problem (provide any two, get third)
 */
export function solveTSD(input: TimeSpeedDistance): TSDResult {
  const { time_hours, speed_knots, distance_nm } = input;

  // Count provided values
  const provided = [time_hours, speed_knots, distance_nm].filter(
    v => v !== undefined && v !== null
  ).length;

  if (provided !== 2) {
    throw new Error('Must provide exactly two of: time, speed, distance');
  }

  // Solve for missing value
  if (time_hours === undefined) {
    return {
      time_hours: calculateTime(speed_knots!, distance_nm!),
      speed_knots,
      distance_nm,
      calculated: 'time'
    };
  }

  if (speed_knots === undefined) {
    return {
      time_hours,
      speed_knots: calculateSpeed(time_hours, distance_nm!),
      distance_nm,
      calculated: 'speed'
    };
  }

  if (distance_nm === undefined) {
    return {
      time_hours,
      speed_knots,
      distance_nm: calculateDistance(time_hours, speed_knots),
      calculated: 'distance'
    };
  }

  throw new Error('All three values provided - nothing to calculate');
}

/**
 * Convert time in hours to HH:MM format
 */
export function hoursToHHMM(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Convert HH:MM format to hours
 */
export function hhmmToHours(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h + m / 60;
}

/**
 * Convert knots to other speed units
 */
export function convertSpeed(speed: number, from: SpeedUnit, to: SpeedUnit): number {
  const toKnots: { [key in SpeedUnit]: number } = {
    knots: 1,
    mph: 1.15078,
    kmh: 1.852
  };

  const speedInKnots = speed / toKnots[from];
  return speedInKnots * toKnots[to];
}

/**
 * Calculate ground speed given TAS and wind
 * @param tas_knots - True airspeed in knots
 * @param heading - Aircraft heading (degrees)
 * @param wind_direction - Wind from direction (degrees)
 * @param wind_speed - Wind speed in knots
 * @returns Ground speed in knots
 */
export function calculateGroundSpeed(
  tas_knots: number,
  heading: number,
  wind_direction: number,
  wind_speed: number
): number {
  // Convert to radians
  const hdg = toRadians(heading);
  const windDir = toRadians(wind_direction);

  // Calculate wind components
  const headwind = wind_speed * Math.cos(windDir - hdg);
  const crosswind = wind_speed * Math.sin(windDir - hdg);

  // Calculate ground speed
  const groundSpeed = Math.sqrt(
    Math.pow(tas_knots + headwind, 2) + Math.pow(crosswind, 2)
  );

  return Math.round(groundSpeed);
}

/**
 * Calculate fuel required
 * @param distance_nm - Distance in nautical miles
 * @param speed_knots - Ground speed in knots
 * @param fuel_burn_gph - Fuel burn rate in gallons per hour
 * @returns Fuel required in gallons
 */
export function calculateFuelRequired(
  distance_nm: number,
  speed_knots: number,
  fuel_burn_gph: number
): number {
  const time = calculateTime(speed_knots, distance_nm);
  return time * fuel_burn_gph;
}
```

---

## Testing Requirements

### Unit Tests

```typescript
// Test haversine distance
describe('haversineDistance', () => {
  test('KSFO to KJFK', () => {
    const dist = haversineDistance(37.62, -122.38, 40.64, -73.78);
    expect(dist).toBeCloseTo(2095, 0);
  });

  test('same point returns zero', () => {
    const dist = haversineDistance(37.62, -122.38, 37.62, -122.38);
    expect(dist).toBe(0);
  });

  test('unit conversions', () => {
    const nm = haversineDistance(37.62, -122.38, 40.64, -73.78, 'nm');
    const sm = haversineDistance(37.62, -122.38, 40.64, -73.78, 'sm');
    const km = haversineDistance(37.62, -122.38, 40.64, -73.78, 'km');
    
    expect(sm / nm).toBeCloseTo(1.15078, 2);
    expect(km / nm).toBeCloseTo(1.852, 2);
  });
});

// Test bearing calculations
describe('bearingCalculations', () => {
  test('north bearing', () => {
    const bearing = initialBearing(0, 0, 1, 0);
    expect(bearing).toBeCloseTo(0, 0);
  });

  test('east bearing', () => {
    const bearing = initialBearing(0, 0, 0, 1);
    expect(bearing).toBeCloseTo(90, 0);
  });

  test('KSFO to KJFK', () => {
    const bearing = initialBearing(37.62, -122.38, 40.64, -73.78);
    expect(bearing).toBeGreaterThan(60);
    expect(bearing).toBeLessThan(90);
  });

  test('reciprocal bearing', () => {
    const bearing = 45;
    expect(reciprocalBearing(bearing)).toBe(225);
  });
});

// Test TSD calculations
describe('TSD calculations', () => {
  test('calculate time', () => {
    const time = calculateTime(120, 240); // 120 kts, 240 nm
    expect(time).toBe(2); // 2 hours
  });

  test('calculate speed', () => {
    const speed = calculateSpeed(2, 240); // 2 hours, 240 nm
    expect(speed).toBe(120); // 120 kts
  });

  test('calculate distance', () => {
    const dist = calculateDistance(2, 120); // 2 hours, 120 kts
    expect(dist).toBe(240); // 240 nm
  });

  test('solve TSD for time', () => {
    const result = solveTSD({ speed_knots: 120, distance_nm: 240 });
    expect(result.time_hours).toBe(2);
    expect(result.calculated).toBe('time');
  });
});

// Performance tests
describe('performance', () => {
  test('distance calculation < 1ms', () => {
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      haversineDistance(37.62, -122.38, 40.64, -73.78);
    }
    const elapsed = performance.now() - start;
    expect(elapsed / 1000).toBeLessThan(1); // < 1ms per call
  });
});
```

### Test Coverage Target

- **Overall:** 100% (navigation is critical)
- **All functions:** 100% coverage
- **Edge cases:** All tested (equator, poles, dateline)

---

## Migration Path

1. Implement TypeScript navigation utilities
2. Comprehensive unit tests
3. Precision validation against known values
4. Python wrapper
5. Integrate into accident-tracker
6. Update flightplanner later

---

## Acceptance Criteria

- [ ] All distance calculations implemented
- [ ] All bearing calculations implemented
- [ ] All coordinate utilities implemented
- [ ] TSD calculations implemented
- [ ] Precision validated (<0.1% error)
- [ ] Tests passing (100% coverage)
- [ ] Performance optimized (<1ms per calculation)
- [ ] Python wrapper functional
- [ ] Documentation complete with examples
- [ ] Ready for use in all apps

---

## Timeline

**Day 1:** Distance + bearing calculations + tests
**Day 2:** Coordinate utilities + TSD + Python wrapper + docs

---

**Status:** Ready for implementation
**Dependencies:** None
**Target Completion:** 2 days
