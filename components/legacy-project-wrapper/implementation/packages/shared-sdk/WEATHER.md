# Weather Services API

> Part of [@aviation/shared-sdk](./README.md)

Comprehensive weather services for aviation applications, providing current weather, forecasts, METAR data, and flight category calculations.

---

## 📦 Overview

The weather module provides:
- **OpenWeatherMap** - Current weather conditions
- **Open-Meteo** - Multi-day forecasts (free, no API key)
- **METAR** - Aviation weather reports from Aviation Weather.gov
- **Flight Categories** - FAA VFR/MVFR/IFR/LIFR calculations

---

## 🚀 Quick Start

### TypeScript

```typescript
import {
  fetchMetar,
  fetchForecast,
  createOpenWeatherMapClient,
  calculateFlightCategory
} from '@aviation/shared-sdk';

// Fetch METAR
const metar = await fetchMetar('KSFO');
console.log(`${metar.station}: ${metar.temperature}°F, ${metar.flight_category}`);

// Get 7-day forecast (no API key needed)
const forecast = await fetchForecast(37.619, -122.375, 7);
forecast.days.forEach(day => {
  console.log(`${day.date}: ${day.temp_high}°F/${day.temp_low}°F - ${day.conditions}`);
});

// Get current weather (requires API key)
const owm = createOpenWeatherMapClient(apiKey);
const weather = await owm.getCurrentWeather(37.619, -122.375);
console.log(`Current: ${weather.temperature}°F, ${weather.conditions}`);

// Calculate flight category
const category = calculateFlightCategory(visibility_sm, ceiling_ft);
console.log(`Flight category: ${category}`); // VFR, MVFR, IFR, or LIFR
```

### Python

```python
from aviation.weather import (
    calculate_flight_category,
    get_flight_category_recommendation,
    get_weather_warnings
)

# Calculate flight category
category = calculate_flight_category(visibility=4.0, ceiling=2000)
print(f"Flight category: {category}")  # "MVFR"

# Get recommendation
rec = get_flight_category_recommendation(category)
print(rec)  # "Marginal VFR - Caution advised..."

# Get warnings
warnings = get_weather_warnings(
    visibility=2.0,
    ceiling=800,
    wind_speed=25,
    wind_gust=35
)
for warning in warnings:
    print(f"⚠️  {warning}")
```

---

## 📚 API Reference

### Flight Category Calculations

#### `calculateFlightCategory(visibility, ceiling, thresholds?)`

Calculate FAA flight category based on visibility and ceiling.

**Parameters:**
- `visibility` (number) - Visibility in statute miles
- `ceiling` (number | null) - Ceiling in feet AGL (null = unlimited)
- `thresholds` (object, optional) - Custom thresholds

**Returns:** `'VFR' | 'MVFR' | 'IFR' | 'LIFR'`

**FAA Criteria:**
| Category | Visibility | Ceiling |
|----------|------------|---------|
| **VFR** | ≥ 5 SM | ≥ 3000 ft |
| **MVFR** | 3-5 SM | 1000-3000 ft |
| **IFR** | 1-3 SM | 500-1000 ft |
| **LIFR** | < 1 SM | < 500 ft |

**Examples:**
```typescript
calculateFlightCategory(10, 5000);    // "VFR"
calculateFlightCategory(4, 2000);     // "MVFR"
calculateFlightCategory(2, 800);      // "IFR"
calculateFlightCategory(0.5, 300);    // "LIFR"
calculateFlightCategory(10, null);    // "VFR" (unlimited ceiling)
```

---

### METAR Client

#### `fetchMetar(icao)`

Fetch and parse METAR for an airport from AviationWeather.gov.

**Parameters:**
- `icao` (string) - Airport ICAO code

**Returns:** `Promise<METARData | null>`

**METARData:**
```typescript
interface METARData {
  raw: string;                    // Raw METAR text
  station: string;                // Airport ICAO
  time: string;                   // ISO 8601 UTC
  wind: {
    direction: number;            // Degrees
    speed: number;                // Knots
    gust?: number;                // Knots
    variable: boolean;
  };
  visibility: number;             // Statute miles
  temperature: number;            // Fahrenheit
  dewpoint: number;               // Fahrenheit
  altimeter: number;              // inHg
  clouds: Array<{
    coverage: string;             // SKC, FEW, SCT, BKN, OVC
    altitude: number;             // Feet AGL
  }>;
  conditions: string[];           // RA, SN, BR, etc.
  flight_category: FlightCategory;
  ceiling: number | null;         // Feet AGL
  remarks?: string;
}
```

**Example:**
```typescript
const metar = await fetchMetar('KSFO');
if (metar) {
  console.log(`${metar.station} METAR:`);
  console.log(`  Temperature: ${metar.temperature}°F`);
  console.log(`  Wind: ${metar.wind.speed} kts from ${metar.wind.direction}°`);
  console.log(`  Visibility: ${metar.visibility} SM`);
  console.log(`  Flight Category: ${metar.flight_category}`);
}
```

---

### OpenWeatherMap Client

#### `createOpenWeatherMapClient(apiKey, options?)`

Create OpenWeatherMap client for current weather data.

**Parameters:**
- `apiKey` (string) - OpenWeatherMap API key (required)
- `options` (object, optional) - Client configuration

**Returns:** `OpenWeatherMapClient`

#### `client.getCurrentWeather(lat, lon, airport?)`

Fetch current weather at coordinates.

**Parameters:**
- `lat` (number) - Latitude
- `lon` (number) - Longitude
- `airport` (string, optional) - Airport ICAO code

**Returns:** `Promise<WeatherData | null>`

**WeatherData:**
```typescript
interface WeatherData {
  airport?: string;
  latitude: number;
  longitude: number;
  conditions: string;             // "Clear sky", "Light rain", etc.
  temperature: number;            // Fahrenheit
  wind_speed: number;             // Knots
  wind_direction?: number;        // Degrees
  wind_gust?: number;             // Knots
  visibility?: number;            // Statute miles
  ceiling?: number;               // Feet AGL
  pressure?: number;              // inHg
  humidity?: number;              // Percent
  dewpoint?: number;              // Fahrenheit
  flight_category?: FlightCategory;
  recommendation?: string;
  warnings?: string[];
  timestamp: string;              // ISO 8601 UTC
  source: string;                 // "openweathermap"
}
```

**Example:**
```typescript
const client = createOpenWeatherMapClient('your-api-key');
const weather = await client.getCurrentWeather(37.619, -122.375, 'KSFO');

if (weather) {
  console.log(`Current weather at ${weather.airport}:`);
  console.log(`  ${weather.conditions}, ${weather.temperature}°F`);
  console.log(`  Wind: ${weather.wind_speed} kts`);
  console.log(`  Flight category: ${weather.flight_category}`);
  
  if (weather.warnings && weather.warnings.length > 0) {
    console.log('  Warnings:');
    weather.warnings.forEach(w => console.log(`    ⚠️  ${w}`));
  }
}
```

---

### Open-Meteo Client

#### `fetchForecast(lat, lon, days?, airport?)`

Fetch multi-day weather forecast from Open-Meteo (free, no API key).

**Parameters:**
- `lat` (number) - Latitude
- `lon` (number) - Longitude
- `days` (number, optional) - Forecast days (1-16, default 7)
- `airport` (string, optional) - Airport ICAO code

**Returns:** `Promise<WeatherForecast | null>`

**WeatherForecast:**
```typescript
interface WeatherForecast {
  latitude: number;
  longitude: number;
  airport?: string;
  days: ForecastDay[];
  timestamp: string;              // ISO 8601 UTC
  source: string;                 // "open-meteo"
}

interface ForecastDay {
  date: string;                   // YYYY-MM-DD
  temp_high: number;              // Fahrenheit
  temp_low: number;               // Fahrenheit
  conditions: string;             // "Clear sky", "Light rain", etc.
  wind_speed: number;             // Knots
  wind_direction?: number;        // Degrees
  precipitation_probability: number;  // Percent
  precipitation_amount?: number;  // Inches
  cloud_cover?: number;           // Percent
  flight_category?: FlightCategory;
}
```

**Example:**
```typescript
const forecast = await fetchForecast(37.619, -122.375, 7, 'KSFO');

if (forecast) {
  console.log(`7-day forecast for ${forecast.airport}:`);
  forecast.days.forEach(day => {
    console.log(`\n${day.date}:`);
    console.log(`  High/Low: ${day.temp_high}°F / ${day.temp_low}°F`);
    console.log(`  ${day.conditions}`);
    console.log(`  Wind: ${day.wind_speed} kts`);
    console.log(`  Precip: ${day.precipitation_probability}%`);
    console.log(`  Flight category: ${day.flight_category}`);
  });
}
```

---

## 🔧 Configuration

### Caching

All weather clients use TTL-based caching by default:
- **Current weather:** 5 minutes
- **METAR:** 5 minutes
- **Forecast:** 10 minutes

To disable caching:
```typescript
const client = new OpenWeatherMapClient({
  apiKey: 'your-key',
  enableCache: false
});
```

To customize TTL:
```typescript
const client = new OpenWeatherMapClient({
  apiKey: 'your-key',
  cacheTtl: 10 * 60 * 1000  // 10 minutes in milliseconds
});
```

### Timeouts

Default timeout is 5 seconds. To customize:
```typescript
const client = new OpenWeatherMapClient({
  apiKey: 'your-key',
  timeout: 10000  // 10 seconds
});
```

---

## 🎨 UI Integration

### Color Codes

```typescript
import { getFlightCategoryColor } from '@aviation/shared-sdk';

const color = getFlightCategoryColor('VFR');  // "#00A000" (green)
```

| Category | Color | Hex |
|----------|-------|-----|
| **VFR** | 🟢 Green | `#00A000` |
| **MVFR** | 🔵 Blue | `#0080FF` |
| **IFR** | 🔴 Red | `#FF0000` |
| **LIFR** | 🟣 Magenta | `#C000C0` |

---

## 🔑 API Keys

### OpenWeatherMap

1. Sign up at https://openweathermap.org/api
2. Get your API key
3. Store in keystore:
   ```bash
   npm run keystore set your-app OPENWEATHERMAP_API_KEY "your-key"
   ```

**Rate Limits (Free Tier):**
- 60 calls/minute
- 1,000,000 calls/month

### Open-Meteo

✅ No API key required!  
✅ Free and open source  
✅ No strict rate limits

### AviationWeather.gov

✅ No API key required!  
⚠️ Rate limit: ~4 requests/second

---

## 📊 Data Sources

| Source | Data | API Key | Rate Limit | Cost |
|--------|------|---------|------------|------|
| **OpenWeatherMap** | Current weather | ✅ Required | 60/min | Free tier |
| **Open-Meteo** | Forecasts | ❌ Not needed | None | Free |
| **AviationWeather.gov** | METAR | ❌ Not needed | ~4/sec | Free |

---

## 🧪 Testing

### TypeScript
```bash
cd packages/shared-sdk
npm test
```

### Python
```python
from aviation.weather import calculate_flight_category

# Test VFR
assert calculate_flight_category(10, 5000) == 'VFR'

# Test MVFR
assert calculate_flight_category(4, 2000) == 'MVFR'

# Test IFR
assert calculate_flight_category(2, 800) == 'IFR'

# Test LIFR
assert calculate_flight_category(0.5, 300) == 'LIFR'
```

---

## 📝 Notes

**Python API Parity:**  
Full Python implementations of weather clients (OpenWeatherMap, Open-Meteo, METAR) are planned for a future release. Currently, Python provides:
- ✅ Flight category calculations (complete)
- ⏳ Weather API clients (use TypeScript or app-specific implementations)

Applications can use:
1. Python flight category functions (implemented)
2. Existing app-specific weather services
3. TypeScript weather APIs

---

## 🤝 Contributing

Found a bug or want to contribute? See [CONTRIBUTING.md](../../CONTRIBUTING.md).

---

## 📜 License

MIT License - See [LICENSE](../../LICENSE)

---

*Part of the Aviation monorepo - Single source of truth for aviation data.*
