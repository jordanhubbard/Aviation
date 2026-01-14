# @aviation/shared-sdk

Shared SDK for aviation applications with weather services, AI methodology, and common utilities.

## Features

### ✈️ Aviation Weather Services

Comprehensive weather data services for flight planning:

- **OpenWeatherMap Integration** - Current weather conditions
- **Open-Meteo Integration** - Free weather forecasts (daily/hourly)
- **METAR Services** - Fetch and parse METARs from AviationWeather.gov
- **Flight Categories** - Automatic VFR/MVFR/IFR/LIFR determination
- **Smart Caching** - TTL-based caching with stale data fallback
- **Weather Recommendations** - Flight planning guidance and warnings

### 🤖 AI Integration

Base patterns for AI-powered aviation applications.

### 🛠️ Background Services

Base classes for long-running aviation services.

## Installation

```bash
npm install @aviation/shared-sdk
```

Or for use in the monorepo:

```json
{
  "dependencies": {
    "@aviation/shared-sdk": "*"
  }
}
```

## Quick Start

### Weather Services (TypeScript)

```typescript
import { Weather } from '@aviation/shared-sdk';

// Fetch METAR
const metar = await Weather.fetchMetarRaw('KSFO');
console.log(metar); // "KSFO 141756Z 27015KT 10SM FEW015 SCT250 14/09 A3012 RMK AO2"

// Parse METAR
const parsed = Weather.parseMetar(metar);
console.log(parsed);
// {
//   wind_direction: 270,
//   wind_speed_kt: 15,
//   visibility_sm: 10,
//   temperature_f: 57,
//   ceiling_ft: undefined
// }

// Determine flight category
const category = Weather.flightCategory(
  parsed.visibility_sm,
  parsed.ceiling_ft || 10000
);
console.log(category); // "VFR"

// Get recommendation
const recommendation = Weather.recommendationForCategory(category);
console.log(recommendation);
// "VFR conditions. Routine VFR flight should be feasible."

// Fetch current weather from OpenWeatherMap
const weather = await Weather.owmGetAirportWeather('KSFO', 37.6213, -122.3790);
console.log(weather);
// {
//   airport: 'KSFO',
//   conditions: 'clear sky',
//   temperature: 57,
//   wind_speed: 13,
//   wind_direction: 270,
//   visibility: 10,
//   ceiling: 10000
// }

// Get Open-Meteo forecast
const forecast = await Weather.omGetHourlyForecast(37.6213, -122.3790, 24);
console.log(forecast[0]);
// {
//   time: '2026-01-14T00:00',
//   visibility_m: 16000,
//   cloudcover_pct: 25,
//   precipitation_mm: 0,
//   wind_speed_kt: 12
// }

// Find best departure windows
const windows = Weather.bestDepartureWindows(forecast, 3, 3);
console.log(windows);
// [
//   {
//     start_time: '2026-01-14T09:00',
//     end_time: '2026-01-14T12:00',
//     score: 385.2,
//     flight_category: 'VFR'
//   },
//   ...
// ]
```

### Weather Services (Python)

```python
from aviation.weather import (
    fetch_metar_raw,
    parse_metar,
    flight_category,
    recommendation_for_category,
)

# Fetch METAR
metar = fetch_metar_raw("KSFO")
print(metar)

# Parse METAR
parsed = parse_metar(metar)
print(parsed)

# Determine flight category
category = flight_category(
    visibility_sm=parsed.get("visibility_sm"),
    ceiling_ft=parsed.get("ceiling_ft", 10000),
)
print(category)  # "VFR"

# Get recommendation
rec = recommendation_for_category(category)
print(rec)
```

### Background Services

```typescript
import { BackgroundService } from '@aviation/shared-sdk';

class FlightTrackerService extends BackgroundService {
  protected async onStart(): Promise<void> {
    console.log('Flight tracker starting...');
    // Initialize your service
  }

  protected async onStop(): Promise<void> {
    console.log('Flight tracker stopping...');
    // Cleanup
  }
}

const service = new FlightTrackerService({
  name: 'flight-tracker',
  enabled: true,
});

await service.start();
```

## API Reference

### Weather Services

#### METAR Services

```typescript
// Fetch raw METAR
fetchMetarRaw(station: string): Promise<string | null>

// Fetch multiple METARs
fetchMetarRaws(stations: string[]): Promise<Map<string, string | null>>

// Parse METAR string
parseMetar(raw: string): ParsedMetar

// Fetch and parse METAR
fetchMetar(station: string): Promise<ParsedMetar | null>
```

#### OpenWeatherMap

```typescript
// Get current weather (raw API response)
owmGetCurrentWeather(lat: number, lon: number): Promise<OpenWeatherMapResponse>

// Get standardized airport weather
owmGetAirportWeather(
  airportCode: string,
  lat: number,
  lon: number
): Promise<WeatherData>
```

#### Open-Meteo

```typescript
// Get current weather
omGetCurrentWeather(lat: number, lon: number): Promise<OpenMeteoCurrentWeather>

// Get daily forecast (1-16 days)
omGetDailyForecast(
  lat: number,
  lon: number,
  days?: number
): Promise<OpenMeteoDailyForecast[]>

// Get hourly forecast (1-168 hours)
omGetHourlyForecast(
  lat: number,
  lon: number,
  hours?: number
): Promise<OpenMeteoHourlyForecast[]>

// Sample route points
samplePointsAlongRoute(
  points: Array<[number, number]>,
  interval?: number
): Array<[number, number]>
```

#### Flight Categories

```typescript
// Determine flight category
flightCategory(
  visibility_sm: number | null,
  ceiling_ft: number | null,
  thresholds?: FlightCategoryThresholds
): FlightCategory

// Get recommendation
recommendationForCategory(category: FlightCategory): string

// Get warnings
warningsForConditions(
  visibility_sm: number | null,
  ceiling_ft: number | null,
  wind_speed_kt: number | null
): string[]

// Estimate ceiling from cloud cover
estimateCeilingFtFromCloudcover(cloud_pct: number | null): number | null

// Score weather hour (higher = better)
scoreHour(
  category: FlightCategory,
  precipitation_mm: number | null,
  wind_speed_kt: number | null
): number

// Find best departure windows
bestDepartureWindows(
  hourly: OpenMeteoHourlyForecast[],
  windowHours?: number,
  maxWindows?: number
): DepartureWindow[]

// Get color for flight category
colorForCategory(category: FlightCategory): string
```

### Types

```typescript
type FlightCategory = 'VFR' | 'MVFR' | 'IFR' | 'LIFR' | 'UNKNOWN';

interface FlightCategoryThresholds {
  vfr_ceiling_ft: number;      // Default: 3000
  vfr_visibility_sm: number;   // Default: 5.0
  mvfr_ceiling_ft: number;     // Default: 1000
  mvfr_visibility_sm: number;  // Default: 3.0
  ifr_ceiling_ft: number;      // Default: 500
  ifr_visibility_sm: number;   // Default: 1.0
}

interface ParsedMetar {
  wind_direction?: number;
  wind_speed_kt?: number;
  visibility_sm?: number;
  temperature_f?: number;
  ceiling_ft?: number;
}

interface WeatherData {
  airport: string;
  conditions: string;
  temperature: number;
  wind_speed: number;
  wind_direction: number;
  visibility: number;
  ceiling: number;
  metar?: string;
}

interface DepartureWindow {
  start_time: string;
  end_time: string;
  score: number;
  flight_category: FlightCategory;
}
```

## Configuration

### API Keys

Weather services require API keys to be set in environment variables or keystore:

**OpenWeatherMap:**
```bash
export OPENWEATHERMAP_API_KEY="your-key-here"
# OR
export OPENWEATHER_API_KEY="your-key-here"
```

**Open-Meteo:**
No API key required (free service)

**AviationWeather.gov:**
No API key required (government service)

### Caching

Weather data is automatically cached with TTL:

- **METAR**: 5 minutes
- **OpenWeatherMap**: 5 minutes
- **Open-Meteo current**: 10 minutes
- **Open-Meteo forecast**: 30 minutes

Cache supports stale data fallback on API failures.

## Development

```bash
# Build
npm run build

# Watch mode
npm run dev

# Type check
npm run type-check

# Clean
npm run clean
```

## Requirements

- Node.js >= 18.0.0 (for native `fetch` API)
- TypeScript >= 5.0.0

## License

MIT

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## Related Packages

- [@aviation/keystore](../keystore/) - Encrypted secrets management
- [@aviation/ui-framework](../ui-framework/) - Multi-modal UI framework

## Applications Using This SDK

- **aviation-accident-tracker** - Accident and incident tracking
- **flight-tracker** - Real-time flight tracking
- **flightplanner** - VFR flight planning
- **flightschool** - Flight school management
- **foreflight-dashboard** - Logbook analysis
- **weather-briefing** - AI-powered weather briefings
