# Weather Briefing Service

> Part of the [Aviation Monorepo](../../README.md)

AI-powered aviation weather briefing service using the shared aviation SDK.

## Features

- 🌤️ **Airport Briefings** - Comprehensive weather briefings for any airport
- 🛫 **Route Briefings** - Multi-airport weather analysis (departure → destination → alternates)
- 📊 **Flight Categories** - Automatic VFR/MVFR/IFR/LIFR determination
- ⚠️ **Weather Warnings** - Automated warnings for hazardous conditions
- ⏰ **Departure Windows** - Find best times to fly based on hourly forecasts
- 💾 **Smart Caching** - 5-minute TTL cache for performance

## Quick Start

```bash
cd apps/weather-briefing
make build
make start
```

## Installation

```bash
npm install
```

## Usage

### Generate Airport Briefing

```typescript
import { WeatherBriefingService } from './service';

const service = new WeatherBriefingService({
  name: 'weather-briefing',
  enabled: true,
});

await service.start();

// Get briefing for KSFO
const briefing = await service.generateAirportBriefing('KSFO');

console.log(briefing.briefing);
```

### Example Airport Briefing Output

```
AVIATION WEATHER BRIEFING - KSFO
Generated: 2026-01-14T08:30:00.000Z

METAR: KSFO 141756Z 27015KT 10SM FEW015 SCT250 14/09 A3012 RMK AO2

CONDITIONS:
  Temperature: 57°F
  Wind: 270° at 15 knots
  Visibility: 10.0 SM
  Ceiling: Not reported

FLIGHT CATEGORY: VFR
Recommendation: VFR conditions. Routine VFR flight should be feasible.
```

### Generate Route Briefing

```typescript
const routeBriefing = await service.generateRouteBriefing(
  'KSFO',  // Departure
  'KJFK',  // Destination
  ['KORD'] // Alternates (optional)
);

console.log(`Route: ${routeBriefing.departure} → ${routeBriefing.destination}`);
console.log(`Overall: ${routeBriefing.overallCategory}`);
console.log(`Recommendation: ${routeBriefing.recommendation}`);

routeBriefing.briefings.forEach(b => {
  console.log(`\n${b.icao}: ${b.category}`);
  console.log(b.briefing);
});
```

### Find Best Departure Windows

```typescript
const windows = await service.getBestDepartureWindows(
  'KSFO',
  37.6213,
  -122.3790,
  24 // Next 24 hours
);

windows.forEach(w => {
  console.log(`${w.start_time} - ${w.end_time}`);
  console.log(`  Category: ${w.flight_category}, Score: ${w.score}`);
});
```

### Example Departure Windows

```
2026-01-14T09:00 - 2026-01-14T12:00
  Category: VFR, Score: 385.2

2026-01-14T13:00 - 2026-01-14T16:00
  Category: VFR, Score: 378.5

2026-01-14T06:00 - 2026-01-14T09:00
  Category: MVFR, Score: 295.3
```

## API Reference

### WeatherBriefingService Methods

#### `generateAirportBriefing(icao: string): Promise<AirportBriefing>`

Generate a comprehensive weather briefing for a single airport.

**Returns:**
```typescript
{
  icao: string;
  metar: string | null;
  category: FlightCategory;
  recommendation: string;
  warnings: string[];
  conditions: {
    temperature_f?: number;
    wind_speed_kt?: number;
    wind_direction?: number;
    visibility_sm?: number;
    ceiling_ft?: number;
  };
  briefing: string;  // Formatted human-readable briefing
  timestamp: Date;
}
```

#### `generateRouteBriefing(departure: string, destination: string, alternates?: string[]): Promise<RouteBriefing>`

Generate weather briefing for entire route.

**Returns:**
```typescript
{
  departure: string;
  destination: string;
  route: string[];
  briefings: AirportBriefing[];
  overallCategory: FlightCategory;
  recommendation: string;
  warnings: string[];
  timestamp: Date;
}
```

#### `getBestDepartureWindows(icao: string, lat: number, lon: number, hours?: number): Promise<DepartureWindow[]>`

Find optimal departure times based on weather forecast.

**Parameters:**
- `icao` - Airport identifier
- `lat` - Latitude
- `lon` - Longitude
- `hours` - Forecast window (default: 24)

**Returns:** Array of 3-hour windows sorted by score (higher = better)

#### `clearCache(): void`

Clear cached briefings (forces fresh data fetch).

#### `getCacheStats(): { airports: number; routes: number }`

Get cache statistics.

## Integration with Shared SDK

### Weather Services Used

```typescript
import { Weather } from '@aviation/shared-sdk';

// METAR fetching
const metar = await Weather.fetchMetarRaw('KSFO');

// METAR parsing
const parsed = Weather.parseMetar(metar);

// Flight category
const category = Weather.flightCategory(
  parsed.visibility_sm,
  parsed.ceiling_ft
);

// Recommendations
const rec = Weather.recommendationForCategory(category);

// Warnings
const warnings = Weather.warningsForConditions(
  parsed.visibility_sm,
  parsed.ceiling_ft,
  parsed.wind_speed_kt
);

// Hourly forecast
const hourly = await Weather.omGetHourlyForecast(lat, lon, 24);

// Best windows
const windows = Weather.bestDepartureWindows(hourly, 3, 3);
```

## Configuration

### API Keys (Optional)

```bash
# OpenWeatherMap (optional - for enhanced features)
npm run keystore set weather-briefing OPENWEATHERMAP_API_KEY "your-key"
```

**Note:** Service works without API keys using free METAR data from AviationWeather.gov.

### Cache Settings

Edit `src/service.ts` to adjust cache TTL:

```typescript
// Current: 5 minutes (300000 ms)
if (cached && Date.now() - cached.timestamp.getTime() < 300000) {
  return cached;
}
```

## Example Use Cases

### Pre-Flight Planning

```typescript
// Get weather for departure and destination
const route = await service.generateRouteBriefing('KDEN', 'KPHX');

if (route.overallCategory === 'VFR') {
  console.log('✅ Good weather for flight');
} else {
  console.log('⚠️  Check conditions carefully');
  route.warnings.forEach(w => console.log(`  ${w}`));
}
```

### Flight School Dispatch

```typescript
// Check if conditions are suitable for training
const briefing = await service.generateAirportBriefing('KPAO');

if (briefing.category === 'VFR' && briefing.warnings.length === 0) {
  console.log('✅ Good conditions for student flights');
} else {
  console.log('⚠️  Training flights may be restricted');
}
```

### Commercial Operations

```typescript
// Find best departure time
const windows = await service.getBestDepartureWindows(
  'KATL',
  33.6407,
  -84.4277,
  12 // Next 12 hours
);

const bestWindow = windows[0];
console.log(`Recommended departure: ${bestWindow.start_time}`);
console.log(`Expected conditions: ${bestWindow.flight_category}`);
```

## Development

### Building

```bash
make build
# or
npm run build
```

### Running

```bash
make start
# or
npm start
```

### Testing

```bash
make test
# or
npm test
```

## Tech Stack

- **TypeScript** - Type-safe development
- **@aviation/shared-sdk** - Weather and aviation utilities
- **@aviation/keystore** - Secure secret management
- **Node.js** - Runtime environment

## Future Enhancements

- [ ] AI-powered narrative briefings (GPT-4 integration)
- [ ] TAF (Terminal Aerodrome Forecast) analysis
- [ ] NOTAM integration
- [ ] PIREPs (Pilot Reports) inclusion
- [ ] Graphical weather displays
- [ ] WebSocket for real-time updates
- [ ] Email/SMS briefing delivery
- [ ] Multi-day forecast analysis
- [ ] Historical weather trends
- [ ] Integration with flight planning systems

## License

MIT

## Related

- [@aviation/shared-sdk](../../packages/shared-sdk/) - Weather services and utilities
- [@aviation/keystore](../../packages/keystore/) - Encrypted secret management
- [flight-tracker](../flight-tracker/) - Real-time flight tracking
- [flight-planner](../flight-planner/) - VFR flight planning
