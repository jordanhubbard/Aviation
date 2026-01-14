# Flight Tracker

> Part of the [Aviation Monorepo](../../README.md)

Real-time flight tracking application with integrated weather monitoring using the shared aviation SDK.

## Features

- ✈️ **Flight Tracking** - Monitor flights in real-time
- 🌤️ **Weather Integration** - Live METAR data for airports
- 📊 **Flight Categories** - Automatic VFR/MVFR/IFR/LIFR determination
- ⚠️ **Weather Warnings** - Alerts for low visibility, ceilings, and high winds
- 🔄 **Background Service** - Continuous monitoring with configurable polling

## Quick Start

```bash
cd apps/flight-tracker
make build
make start
```

## Installation

### Dependencies

```bash
npm install
```

### API Keys (Optional)

For production flight data, configure API keys:

```bash
# FlightAware API
npm run keystore set flight-tracker FLIGHTAWARE_API_KEY "your-key"

# AviationStack API
npm run keystore set flight-tracker AVIATIONSTACK_API_KEY "your-key"

# Other flight data APIs
npm run keystore set flight-tracker FLIGHT_API_KEY "your-key"
```

**Note:** The application will run in demo mode without API keys, using sample flights.

## Usage

### Running the Service

```bash
# Build
npm run build

# Start service
npm start

# Development mode (watch)
npm run dev
```

The service will:
1. Start monitoring flights every 2 minutes
2. Fetch METARs for origin and destination airports
3. Calculate flight categories (VFR/MVFR/IFR/LIFR)
4. Display weather warnings
5. Log flight status with weather conditions

### Example Output

```
✈️  Flight Tracker Service is now monitoring flights...
📊 Tracking 2 flights

[2026-01-14T08:15:00.000Z] 🔄 Polling flight data...
🌤️  Fetching weather for 4 airports...
   🟢 KSFO: VFR - 57°F, 15kt
   🟢 KJFK: VFR - 45°F, 12kt
   🔵 KATL: MVFR - 68°F, 8kt
      ⚠️  Low ceiling (2000 ft).
   🟢 KLAX: VFR - 72°F, 10kt

📡 Tracked Flights:
────────────────────────────────────────────────────────────────────────────────

✈️  UAL123: KSFO → KJFK
   Altitude: 35000ft, Speed: 450kts
   🟢 Origin (KSFO): VFR
      VFR conditions. Routine VFR flight should be feasible.
   🟢 Destination (KJFK): VFR
      VFR conditions. Routine VFR flight should be feasible.

✈️  DAL456: KATL → KLAX
   Altitude: 38000ft, Speed: 480kts
   🔵 Origin (KATL): MVFR
      Marginal VFR conditions. Consider delaying, changing route, or filing IFR if qualified.
   🟢 Destination (KLAX): VFR
      VFR conditions. Routine VFR flight should be feasible.
────────────────────────────────────────────────────────────────────────────────
```

## Integration with Shared SDK

This application demonstrates full integration with `@aviation/shared-sdk`:

### Weather Services

```typescript
import {
  fetchMetarRaw,
  parseMetar,
  flightCategory,
  recommendationForCategory,
  warningsForConditions,
} from '@aviation/shared-sdk';

// Fetch METAR
const metar = await fetchMetarRaw('KSFO');

// Parse METAR
const parsed = parseMetar(metar);
// { wind_direction: 270, wind_speed_kt: 15, visibility_sm: 10, ... }

// Determine flight category
const category = flightCategory(parsed.visibility_sm, parsed.ceiling_ft);
// "VFR"

// Get recommendation
const recommendation = recommendationForCategory(category);
// "VFR conditions. Routine VFR flight should be feasible."

// Get warnings
const warnings = warningsForConditions(
  parsed.visibility_sm,
  parsed.ceiling_ft,
  parsed.wind_speed_kt
);
// ["High winds (25 kt)."]
```

### Background Service Pattern

```typescript
import { BackgroundService, ServiceConfig } from '@aviation/shared-sdk';

class FlightTrackerService extends BackgroundService {
  protected async onStart(): Promise<void> {
    // Service initialization
  }

  protected async onStop(): Promise<void> {
    // Cleanup
  }
}

const service = new FlightTrackerService({
  name: 'flight-tracker',
  enabled: true,
  autoStart: true,
});

await service.start();
```

### Keystore Integration

```typescript
import { createSecretLoader } from '@aviation/keystore';

const secrets = createSecretLoader('flight-tracker');
const apiKey = secrets.get('FLIGHT_API_KEY');
```

## API

### FlightTrackerService Methods

#### `getAirportConditions(icao: string): AirportConditions | undefined`

Get cached weather conditions for an airport.

```typescript
const conditions = service.getAirportConditions('KSFO');
console.log(conditions);
// {
//   icao: 'KSFO',
//   metar: 'KSFO 141756Z 27015KT 10SM FEW015 SCT250 14/09 A3012',
//   category: 'VFR',
//   recommendation: 'VFR conditions...',
//   warnings: [],
//   lastUpdated: Date
// }
```

#### `getTrackedFlights(): FlightInfo[]`

Get all currently tracked flights.

#### `addFlight(flight: FlightInfo): void`

Add a flight to track.

```typescript
service.addFlight({
  callsign: 'SWA789',
  origin: 'KDEN',
  destination: 'KPHX',
  altitude: 37000,
  speed: 455,
});
```

#### `removeFlight(callsign: string): void`

Remove a flight from tracking.

## Development

### Building

```bash
make build
# or
npm run build
```

### Testing

```bash
make test
# or
npm test
```

### Cleaning

```bash
make clean
# or
npm run clean
```

## Tech Stack

- **TypeScript** - Type-safe development
- **@aviation/shared-sdk** - Weather and aviation utilities
- **@aviation/keystore** - Secure secret management
- **Node.js** - Runtime environment

## Configuration

### Polling Interval

Edit `src/service.ts` to change polling frequency:

```typescript
this.intervalId = setInterval(() => {
  this.pollFlightData();
}, 120000); // 2 minutes (in milliseconds)
```

### Demo Flights

Edit `addDemoFlights()` method to customize tracked flights:

```typescript
private addDemoFlights(): void {
  this.trackedFlights.set('YOUR001', {
    callsign: 'YOUR001',
    origin: 'KDEN',
    destination: 'KORD',
    altitude: 39000,
    speed: 470,
  });
}
```

## Future Enhancements

- [ ] Integrate with real flight data APIs (FlightAware, AviationStack)
- [ ] Add WebSocket for real-time updates
- [ ] Implement flight path tracking with coordinates
- [ ] Add database persistence for historical data
- [ ] Create web dashboard UI
- [ ] Add alerting for weather changes
- [ ] Implement flight plan validation
- [ ] Add NOTAM integration
- [ ] Support multiple data sources with fallback

## License

MIT

## Related

- [@aviation/shared-sdk](../../packages/shared-sdk/) - Aviation utilities and weather services
- [@aviation/keystore](../../packages/keystore/) - Encrypted secret management
- [weather-briefing](../weather-briefing/) - AI-powered weather briefings
- [flightplanner](../flightplanner/) - VFR flight planning
