# @aviation/shared-sdk

Shared SDK for aviation applications providing common services, AI integration patterns, and aviation data services.

## Features

### Background Services
- `BackgroundService` - Base class for long-running services
- `AIService` - Base class for AI-powered services

### AI Integration
- `AIProvider` - Interface for AI provider implementations
- Common AI patterns and utilities

### MAC runtime task reporting

- `MacTaskCreator` submits idempotent error tasks to the MAC hub.
- `installNodeProcessErrorReporting` reports uncaught Node.js process errors.
- Configure `MAC_API_URL` and, when required, `MAC_API_TOKEN`; the project
  defaults to `Aviation`.
- CI and test processes do not create live tasks unless
  `MAC_AUTOREPORT_FORCE=1` is set explicitly.

### Aviation Data Services

#### Airport Database (`aviation/airports`)

Comprehensive airport database with search and geospatial capabilities.

**TypeScript:**
```typescript
import { searchAirports, getAirportByCode, findNearbyAirports } from '@aviation/shared-sdk';

// Search by code, name, or city
const results = searchAirports('SFO', 20);

// Get specific airport
const airport = getAirportByCode('KSFO');

// Find nearby airports
const nearby = findNearbyAirports(37.6213, -122.3790, 50, 20);
```

**Python:**
```python
from aviation import search_airports, get_airport_by_code, find_nearby_airports

# Search by code, name, or city
results = search_airports('SFO', limit=20)

# Get specific airport
airport = get_airport_by_code('KSFO')

# Find nearby airports
nearby = find_nearby_airports(37.6213, -122.3790, radius_nm=50, limit=20)
```

**Features:**
- ICAO and IATA code lookup
- Fuzzy search by name, city, country
- Proximity search (haversine distance)
- K-prefix handling for US airports (e.g., 7S5 ↔ K7S5)
- In-memory caching for performance
- < 10ms search performance

**Data:**
- 50,000+ airports worldwide
- Source: OurAirports database
- Location: `packages/shared-sdk/data/airports_cache.json`

#### Navigation Utilities (`aviation/navigation`)

Comprehensive navigation calculations for flight planning. All calculations use standard aviation units (nautical miles, knots, degrees).

**TypeScript:**
```typescript
import { distanceNM, initialBearing, fuelRequired, groundSpeed } from '@aviation/shared-sdk';

// Calculate distance and bearing from KSFO to KJFK
const distance = distanceNM(37.6213, -122.3790, 40.6413, -73.7781);
const bearing = initialBearing(37.6213, -122.3790, 40.6413, -73.7781);

// Calculate fuel required (450 kts GS, 12 GPH)
const fuel = fuelRequired(distance, 450, 12);
console.log(`${distance.toFixed(0)} NM at ${bearing.toFixed(0)}°`);
console.log(`Fuel: ${fuel.gallons.toFixed(1)} gal, Time: ${fuel.hours.toFixed(2)} hrs`);

// Wind correction
const gs = groundSpeed(450, 90, 270, 25); // TAS 450, course 90°, wind 270@25
```

**Python:**
```python
from aviation.navigation import distance_nm, initial_bearing, fuel_required, ground_speed

# Calculate distance and bearing
distance = distance_nm(37.6213, -122.3790, 40.6413, -73.7781)
bearing = initial_bearing(37.6213, -122.3790, 40.6413, -73.7781)

# Calculate fuel required
fuel = fuel_required(distance, 450, 12)
print(f"{distance:.0f} NM at {bearing:.0f}°")
print(f"Fuel: {fuel['gallons']:.1f} gal, Time: {fuel['hours']:.2f} hrs")

# Wind correction
gs = ground_speed(450, 90, 270, 25)
```

**Features:**
- **Distance Calculations:** Haversine distance, midpoint, destination from bearing/distance, great circle routes
- **Bearing Calculations:** Initial/final bearing, wind correction angle, true heading, ground speed
- **Coordinate Utilities:** Validation, normalization, DMS conversion, bounding boxes
- **Fuel Calculations:** Consumption, range, endurance, VFR/IFR reserves, weight/volume
- **Time-Speed-Distance:** ETA, flight time, IAS to TAS conversion, Mach number calculations
- **Unit Conversions:** NM/km/miles, knots/mph/kph, feet/meters

**Performance:**
- < 1ms per calculation (pure math, no I/O)
- High precision (< 0.1% error for distances > 10 NM)
- Validated against known aviation values

### OpenClaw in-app chat (server-side)

The SDK provides an OpenClaw client for the aviation-chat proxy or app backends. **Do not use from the browser** (API key must stay server-side).

- The **aviation-chat proxy** reads Gateway URL and API key from **environment variables first** (for Railway and other deployments), then keystore. See `apps/aviation-chat/README.md` and `docs/OPENCLAW_CHAT.md`.
- When calling the client yourself, pass `baseUrl` and `apiKey` (from env or keystore). Call `sendMessage({ message, userId, appId, appContextPrefix?, conversationId?, history? })`.
- The proxy loads each app's `CLAUDE.md` (or `AI_CONTEXT.md`) and passes it as `appContextPrefix` so OpenClaw can give app-specific advice.

```typescript
import { createOpenClawClient } from '@aviation/shared-sdk';
import { createSecretLoader } from '@aviation/keystore';

// Prefer env (e.g. Railway), then keystore
const secrets = createSecretLoader('aviation-chat');
const baseUrl = process.env.OPENCLAW_BASE_URL ?? secrets.get('OPENCLAW_BASE_URL') ?? 'http://localhost:31415';
const apiKey = process.env.OPENCLAW_API_KEY ?? process.env.OPENCLAW_GATEWAY_TOKEN ?? secrets.get('OPENCLAW_API_KEY') ?? secrets.get('OPENCLAW_GATEWAY_TOKEN');

const client = createOpenClawClient({ baseUrl, apiKey });
const result = await client.sendMessage({
  message: 'How do I add a fuel stop?',
  userId: 'user-123',
  appId: 'flight-planner',
  appContextPrefix: claudeMdContent,
});
console.log(result.content);
```

## Installation

Within the monorepo, this package is referenced via `workspace:*` in dependent `package.json` files and installed automatically by `pnpm install` at the repo root.

## Usage

### TypeScript

```typescript
import { BackgroundService, AirportDatabase } from '@aviation/shared-sdk';

class MyService extends BackgroundService {
  private airports = new AirportDatabase();
  
  protected async onStart(): Promise<void> {
    const airport = this.airports.getByIcao('KSFO');
    console.log('Found:', airport?.name);
  }
  
  protected async onStop(): Promise<void> {
    // Cleanup
  }
}
```

### Python

```python
from aviation import AirportDatabase

db = AirportDatabase()
airport = db.get_by_icao('KSFO')
print(f'Found: {airport.name}')
```

## API Reference

### Airport Database

#### TypeScript API

**`AirportDatabase`**
- `getAirportCoordinates(code: string): Airport | null`
- `searchAirports(options: AirportSearchOptions): Airport[]`
- `search(query: string, limit?: number): Airport[]`
- `findNearby(lat: number, lon: number, radiusNm: number, limit?: number): Airport[]`
- `getByIcao(icao: string): Airport | null`
- `getByIata(iata: string): Airport | null`

**Convenience Functions:**
- `searchAirports(query: string, limit?: number): Airport[]`
- `getAirportByCode(code: string): Airport | null`
- `findNearbyAirports(lat: number, lon: number, radiusNm: number, limit?: number): Airport[]`

#### Python API

**`AirportDatabase`**
- `get_airport_coordinates(code: str) -> Optional[Airport]`
- `search_airports(**options) -> List[Airport]`
- `search(query: str, limit: int = 20) -> List[Airport]`
- `find_nearby(lat: float, lon: float, radius_nm: float, limit: int = 20) -> List[Airport]`
- `get_by_icao(icao: str) -> Optional[Airport]`
- `get_by_iata(iata: str) -> Optional[Airport]`

**Convenience Functions:**
- `search_airports(query: str, limit: int = 20) -> List[Airport]`
- `get_airport_by_code(code: str) -> Optional[Airport]`
- `find_nearby_airports(lat: float, lon: float, radius_nm: float, limit: int = 20) -> List[Airport]`

### Airport Data Structure

```typescript
interface Airport {
  icao: string;           // ICAO code (e.g., "KSFO")
  iata: string;           // IATA code (e.g., "SFO")
  name: string;           // Airport name
  city: string;           // City
  country: string;        // Country
  latitude: number;       // Latitude
  longitude: number;      // Longitude
  elevation?: number;     // Elevation in feet
  type?: string;          // Airport type
  distance_nm?: number;   // Distance in NM (proximity searches only)
}
```

## Development

```bash
# Build
pnpm run build

# Watch mode
pnpm run dev

# Run tests (162 tests via Vitest)
pnpm test

# Clean
pnpm run clean
```

## License

MIT
