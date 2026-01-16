# Weather Services Extraction Implementation Spec

**Bead:** [Aviation-dx3] Extract weather services to @aviation/shared-sdk
**Priority:** P0 - MVP Blocker
**Effort:** 3-4 days
**Dependencies:** Aviation-o2d (airports, for coordinate lookup)

---

## Overview

Extract weather data services from flight-planner into reusable shared SDK, including OpenWeatherMap, Open-Meteo, METAR parsing, and flight category calculations.

### Current Implementation

**Location:** `apps/flight-planner/backend/app/services/`
- `openweathermap.py` (~100 lines) - Current weather via OpenWeatherMap API
- `open_meteo.py` (~150 lines) - Forecast via Open-Meteo API
- `metar.py` (~120 lines) - METAR fetching and parsing from AviationWeather.gov
- `flight_recommendations.py` (~80 lines) - Flight category calculations (VFR/MVFR/IFR/LIFR)

**External APIs:**
- **OpenWeatherMap:** https://openweathermap.org/api
  - API Key: `OPENWEATHERMAP_API_KEY` (from keystore)
  - Rate Limit: 60 calls/minute (free tier)
  - TTL Cache: 5 minutes

- **Open-Meteo:** https://open-meteo.com
  - Free, no API key required
  - No strict rate limits
  - TTL Cache: 10 minutes

- **AviationWeather.gov:** https://aviationweather.gov/data/api/
  - Free, no API key required
  - Rate Limit: ~4 requests/second
  - TTL Cache: 5 minutes

---

## Target Implementation

### Package Structure

```
packages/shared-sdk/
├── src/aviation/weather/
│   ├── index.ts                    # Main exports
│   ├── openweathermap.ts           # OpenWeatherMap client
│   ├── open-meteo.ts               # Open-Meteo client
│   ├── metar.ts                    # METAR fetching/parsing
│   ├── flight-category.ts          # VFR/IFR calculations
│   ├── weather-cache.ts            # Caching utilities
│   ├── types.ts                    # Type definitions
│   ├── openweathermap.test.ts     # Tests
│   ├── open-meteo.test.ts
│   ├── metar.test.ts
│   └── flight-category.test.ts
└── python/aviation/weather/
    ├── __init__.py
    ├── openweathermap.py
    ├── open_meteo.py
    ├── metar.py
    └── flight_category.py
```

---

## TypeScript API Design

### Core Types

```typescript
// packages/shared-sdk/src/aviation/weather/types.ts

export interface WeatherData {
  airport: string;              // Airport ICAO code
  conditions: string;           // Weather description
  temperature: number;          // Temperature in Fahrenheit
  wind_speed: number;           // Wind speed in knots
  wind_direction?: number;      // Wind direction in degrees
  visibility?: number;          // Visibility in statute miles
  ceiling?: number;             // Ceiling in feet AGL
  pressure?: number;            // Pressure in inHg
  humidity?: number;            // Relative humidity %
  dewpoint?: number;            // Dewpoint in Fahrenheit
  metar?: string;               // Raw METAR text
  flight_category?: FlightCategory;
  recommendation?: string;
  warnings?: string[];
  timestamp: string;            // ISO 8601 UTC
}

export type FlightCategory = 'VFR' | 'MVFR' | 'IFR' | 'LIFR';

export interface ForecastDay {
  date: string;                 // YYYY-MM-DD
  temp_high: number;            // High temp in F
  temp_low: number;             // Low temp in F
  conditions: string;           // Weather description
  wind_speed: number;           // Wind speed in knots
  wind_direction?: number;      // Wind direction in degrees
  precipitation?: number;       // Precipitation probability %
}

export interface ForecastResponse {
  airport: string;
  days: ForecastDay[];
  generated_at: string;
}

export interface RouteWeatherPoint {
  latitude: number;
  longitude: number;
  temperature: number;
  wind_speed: number;
  wind_direction: number;
  conditions: string;
}

export interface RouteWeatherResponse {
  points: RouteWeatherPoint[];
  generated_at: string;
}

export interface MetarData {
  raw: string;                  // Raw METAR text
  station: string;              // Station ICAO
  time: string;                 // Observation time (ISO 8601)
  temperature_f?: number;
  dewpoint_f?: number;
  wind_speed_kt?: number;
  wind_direction?: number;
  wind_gust_kt?: number;
  visibility_sm?: number;
  ceiling_ft?: number;
  altimeter_inhg?: number;
  flight_category?: FlightCategory;
}

export interface WeatherCacheOptions {
  ttl_seconds: number;          // Time to live
  allow_stale_on_error: boolean;
}
```

### OpenWeatherMap Client

```typescript
// packages/shared-sdk/src/aviation/weather/openweathermap.ts

import { createSecretLoader } from '@aviation/keystore';
import { weatherCache } from './weather-cache';
import type { WeatherData } from './types';

export class OpenWeatherMapClient {
  private apiKey: string;
  private baseUrl = 'https://api.openweathermap.org/data/2.5';
  private secrets = createSecretLoader('shared-sdk');

  constructor(apiKey?: string) {
    this.apiKey = apiKey || this.secrets.getRequired('OPENWEATHERMAP_API_KEY');
  }

  /**
   * Get current weather for coordinates
   * @param lat - Latitude
   * @param lon - Longitude
   * @returns Current weather data
   */
  async getCurrentWeather(lat: number, lon: number): Promise<any> {
    const cacheKey = `owm:current:${lat},${lon}`;
    
    return weatherCache.getOrSet(
      cacheKey,
      () => this.fetchCurrentWeather(lat, lon),
      { ttl_seconds: 300, allow_stale_on_error: true }
    );
  }

  private async fetchCurrentWeather(lat: number, lon: number): Promise<any> {
    const url = `${this.baseUrl}/weather?` +
      `lat=${lat}&lon=${lon}&appid=${this.apiKey}&units=imperial`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`OpenWeatherMap API error: ${response.status}`);
    }
    
    return response.json();
  }

  /**
   * Convert OWM response to standardized WeatherData
   */
  toWeatherData(airport: string, payload: any): WeatherData {
    return {
      airport,
      conditions: payload.weather?.[0]?.description || 'unknown',
      temperature: Math.round(payload.main?.temp || 0),
      wind_speed: this.mphToKnots(payload.wind?.speed),
      wind_direction: payload.wind?.deg,
      visibility: payload.visibility ? 
        Math.round(payload.visibility * 0.000621371 * 10) / 10 : undefined,
      humidity: payload.main?.humidity,
      pressure: payload.main?.pressure ? 
        Math.round(payload.main.pressure * 0.02953 * 100) / 100 : undefined,
      dewpoint: payload.main?.temp && payload.main?.humidity ?
        this.calculateDewpoint(payload.main.temp, payload.main.humidity) : undefined,
      timestamp: new Date().toISOString()
    };
  }

  private mphToKnots(mph?: number): number {
    return mph ? Math.round(mph * 0.868976) : 0;
  }

  private calculateDewpoint(temp: number, humidity: number): number {
    // Magnus formula approximation
    const a = 17.27;
    const b = 237.7;
    const alpha = ((a * temp) / (b + temp)) + Math.log(humidity / 100);
    return Math.round((b * alpha) / (a - alpha));
  }
}

/**
 * Singleton instance
 */
export const openWeatherMap = new OpenWeatherMapClient();

/**
 * Convenience functions
 */
export async function getCurrentWeather(
  lat: number,
  lon: number
): Promise<any> {
  return openWeatherMap.getCurrentWeather(lat, lon);
}

export function toWeatherData(airport: string, payload: any): WeatherData {
  return openWeatherMap.toWeatherData(airport, payload);
}
```

### Open-Meteo Client

```typescript
// packages/shared-sdk/src/aviation/weather/open-meteo.ts

import { weatherCache } from './weather-cache';
import type { ForecastDay, RouteWeatherPoint } from './types';

export class OpenMeteoClient {
  private baseUrl = 'https://api.open-meteo.com/v1';

  /**
   * Get forecast for coordinates
   * @param lat - Latitude
   * @param lon - Longitude
   * @param days - Number of forecast days (1-16)
   * @returns Forecast data
   */
  async getForecast(
    lat: number,
    lon: number,
    days: number = 7
  ): Promise<ForecastDay[]> {
    const cacheKey = `open-meteo:forecast:${lat},${lon}:${days}`;
    
    const data = await weatherCache.getOrSet(
      cacheKey,
      () => this.fetchForecast(lat, lon, days),
      { ttl_seconds: 600, allow_stale_on_error: true }
    );
    
    return this.parseForecast(data);
  }

  private async fetchForecast(
    lat: number,
    lon: number,
    days: number
  ): Promise<any> {
    const url = `${this.baseUrl}/forecast?` +
      `latitude=${lat}&longitude=${lon}&` +
      `daily=temperature_2m_max,temperature_2m_min,weathercode,` +
      `windspeed_10m_max,winddirection_10m_dominant&` +
      `temperature_unit=fahrenheit&windspeed_unit=kn&` +
      `forecast_days=${Math.min(days, 16)}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Open-Meteo API error: ${response.status}`);
    }
    
    return response.json();
  }

  private parseForecast(data: any): ForecastDay[] {
    const days: ForecastDay[] = [];
    const daily = data.daily || {};
    
    for (let i = 0; i < (daily.time || []).length; i++) {
      days.push({
        date: daily.time[i],
        temp_high: Math.round(daily.temperature_2m_max?.[i] || 0),
        temp_low: Math.round(daily.temperature_2m_min?.[i] || 0),
        conditions: this.weatherCodeToDescription(daily.weathercode?.[i]),
        wind_speed: Math.round(daily.windspeed_10m_max?.[i] || 0),
        wind_direction: daily.winddirection_10m_dominant?.[i]
      });
    }
    
    return days;
  }

  /**
   * Sample weather along a route
   * @param points - Array of [lat, lon] coordinates
   * @param maxPoints - Max points to sample (default: 10)
   */
  async getRouteWeather(
    points: Array<[number, number]>,
    maxPoints: number = 10
  ): Promise<RouteWeatherPoint[]> {
    // Sample evenly along route
    const sampledPoints = this.samplePoints(points, maxPoints);
    
    // Fetch weather for each point in parallel
    const weatherPromises = sampledPoints.map(([lat, lon]) =>
      this.getCurrentWeatherAtPoint(lat, lon)
    );
    
    return Promise.all(weatherPromises);
  }

  private samplePoints(
    points: Array<[number, number]>,
    maxPoints: number
  ): Array<[number, number]> {
    if (points.length <= maxPoints) {
      return points;
    }
    
    const step = (points.length - 1) / (maxPoints - 1);
    const sampled: Array<[number, number]> = [];
    
    for (let i = 0; i < maxPoints; i++) {
      const index = Math.round(i * step);
      sampled.push(points[index]);
    }
    
    return sampled;
  }

  private async getCurrentWeatherAtPoint(
    lat: number,
    lon: number
  ): Promise<RouteWeatherPoint> {
    const url = `${this.baseUrl}/forecast?` +
      `latitude=${lat}&longitude=${lon}&` +
      `current_weather=true&` +
      `temperature_unit=fahrenheit&windspeed_unit=kn`;
    
    const response = await fetch(url);
    const data = await response.json();
    const current = data.current_weather || {};
    
    return {
      latitude: lat,
      longitude: lon,
      temperature: Math.round(current.temperature || 0),
      wind_speed: Math.round(current.windspeed || 0),
      wind_direction: current.winddirection || 0,
      conditions: this.weatherCodeToDescription(current.weathercode)
    };
  }

  private weatherCodeToDescription(code: number): string {
    const codes: { [key: number]: string } = {
      0: 'Clear sky',
      1: 'Mainly clear',
      2: 'Partly cloudy',
      3: 'Overcast',
      45: 'Fog',
      48: 'Depositing rime fog',
      51: 'Light drizzle',
      53: 'Moderate drizzle',
      55: 'Dense drizzle',
      61: 'Slight rain',
      63: 'Moderate rain',
      65: 'Heavy rain',
      71: 'Slight snow',
      73: 'Moderate snow',
      75: 'Heavy snow',
      95: 'Thunderstorm'
    };
    
    return codes[code] || 'Unknown';
  }
}

/**
 * Singleton instance
 */
export const openMeteo = new OpenMeteoClient();
```

### METAR Client

```typescript
// packages/shared-sdk/src/aviation/weather/metar.ts

import { weatherCache } from './weather-cache';
import type { MetarData } from './types';

export class MetarClient {
  private baseUrl = 'https://aviationweather.gov/api/data/metar';

  /**
   * Fetch METAR for single station
   * @param station - ICAO code
   * @returns Raw METAR text or null
   */
  async fetchMetar(station: string): Promise<string | null> {
    const cacheKey = `metar:${station.toUpperCase()}`;
    
    return weatherCache.getOrSet(
      cacheKey,
      () => this.fetchMetarRaw(station),
      { ttl_seconds: 300, allow_stale_on_error: true }
    );
  }

  private async fetchMetarRaw(station: string): Promise<string | null> {
    const url = `${this.baseUrl}?ids=${station.toUpperCase()}&format=raw`;
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        return null;
      }
      
      const text = await response.text();
      return text.trim() || null;
    } catch (error) {
      console.error('METAR fetch error:', error);
      return null;
    }
  }

  /**
   * Fetch METARs for multiple stations
   * @param stations - Array of ICAO codes
   * @returns Map of station -> METAR text
   */
  async fetchMetars(
    stations: string[]
  ): Promise<Map<string, string | null>> {
    const results = new Map<string, string | null>();
    
    // Fetch in parallel
    const promises = stations.map(async station => {
      const metar = await this.fetchMetar(station);
      results.set(station.toUpperCase(), metar);
    });
    
    await Promise.all(promises);
    return results;
  }

  /**
   * Parse METAR text
   * @param raw - Raw METAR text
   * @returns Parsed METAR data
   */
  parseMetar(raw: string): MetarData {
    const parts = raw.trim().split(/\s+/);
    const parsed: MetarData = {
      raw,
      station: parts[0] || '',
      time: this.parseTime(parts[1])
    };

    for (const part of parts) {
      // Temperature and dewpoint: 12/10
      if (/^M?\d+\/M?\d+$/.test(part)) {
        const [temp, dew] = part.split('/');
        parsed.temperature_f = this.celsiusToFahrenheit(this.parseTemp(temp));
        parsed.dewpoint_f = this.celsiusToFahrenheit(this.parseTemp(dew));
      }
      
      // Wind: 27015G25KT
      else if (/^\d{5}(G\d+)?KT$/.test(part)) {
        const match = part.match(/^(\d{3})(\d{2})(G(\d+))?KT$/);
        if (match) {
          parsed.wind_direction = parseInt(match[1]);
          parsed.wind_speed_kt = parseInt(match[2]);
          if (match[4]) {
            parsed.wind_gust_kt = parseInt(match[4]);
          }
        }
      }
      
      // Visibility: 10SM
      else if (/^\d+SM$/.test(part)) {
        parsed.visibility_sm = parseInt(part);
      }
      
      // Altimeter: A2992
      else if (/^A\d{4}$/.test(part)) {
        const altim = parseInt(part.substring(1));
        parsed.altimeter_inhg = altim / 100;
      }
      
      // Ceiling: BKN015, OVC025
      else if (/^(BKN|OVC)\d{3}$/.test(part)) {
        const height = parseInt(part.substring(3)) * 100;
        if (!parsed.ceiling_ft || height < parsed.ceiling_ft) {
          parsed.ceiling_ft = height;
        }
      }
    }

    return parsed;
  }

  private parseTime(timeStr: string): string {
    // Parse DDHHMMZ format
    // For simplicity, return current date with parsed time
    const day = parseInt(timeStr.substring(0, 2));
    const hour = parseInt(timeStr.substring(2, 4));
    const minute = parseInt(timeStr.substring(4, 6));
    
    const now = new Date();
    const parsed = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      day,
      hour,
      minute
    ));
    
    return parsed.toISOString();
  }

  private parseTemp(temp: string): number {
    return temp.startsWith('M') ? 
      -parseInt(temp.substring(1)) : 
      parseInt(temp);
  }

  private celsiusToFahrenheit(celsius: number): number {
    return Math.round(celsius * 9 / 5 + 32);
  }
}

/**
 * Singleton instance
 */
export const metarClient = new MetarClient();
```

### Flight Category Calculator

```typescript
// packages/shared-sdk/src/aviation/weather/flight-category.ts

import type { FlightCategory } from './types';

export function calculateFlightCategory(
  visibility_sm: number | undefined,
  ceiling_ft: number | undefined
): FlightCategory {
  const vis = visibility_sm ?? 10;
  const ceil = ceiling_ft ?? 10000;

  // LIFR: Ceiling < 500' or visibility < 1 SM
  if (ceil < 500 || vis < 1) {
    return 'LIFR';
  }

  // IFR: Ceiling 500-1000' or visibility 1-3 SM
  if (ceil < 1000 || vis < 3) {
    return 'IFR';
  }

  // MVFR: Ceiling 1000-3000' or visibility 3-5 SM
  if (ceil < 3000 || vis < 5) {
    return 'MVFR';
  }

  // VFR: Ceiling >= 3000' and visibility >= 5 SM
  return 'VFR';
}

export function getRecommendation(category: FlightCategory): string {
  const recommendations: { [key in FlightCategory]: string } = {
    VFR: 'Good conditions for visual flight',
    MVFR: 'Marginal VFR conditions - use caution',
    IFR: 'IFR conditions - instrument rating required',
    LIFR: 'Low IFR conditions - experienced IFR pilots only'
  };

  return recommendations[category];
}

export function getWarnings(
  temperature: number,
  dewpoint: number,
  wind_speed: number
): string[] {
  const warnings: string[] = [];

  // Icing conditions
  if (temperature <= 32 && temperature >= 0) {
    warnings.push('Potential icing conditions');
  }

  // Fog risk
  const spread = temperature - dewpoint;
  if (spread <= 3) {
    warnings.push('Fog likely');
  }

  // High winds
  if (wind_speed >= 25) {
    warnings.push('High wind conditions');
  }

  return warnings;
}
```

### Weather Cache

```typescript
// packages/shared-sdk/src/aviation/weather/weather-cache.ts

interface CacheEntry<T> {
  value: T;
  expires_at: number;
  fetched_at: number;
}

export class WeatherCache {
  private cache = new Map<string, CacheEntry<any>>();
  private maxSize = 1000;

  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: { ttl_seconds: number; allow_stale_on_error: boolean }
  ): Promise<T> {
    const now = Date.now();
    const entry = this.cache.get(key);

    // Return cached if not expired
    if (entry && entry.expires_at > now) {
      return entry.value;
    }

    // Fetch new data
    try {
      const value = await fetcher();
      
      this.cache.set(key, {
        value,
        expires_at: now + options.ttl_seconds * 1000,
        fetched_at: now
      });

      // Prune cache if too large
      if (this.cache.size > this.maxSize) {
        this.prune();
      }

      return value;
    } catch (error) {
      // Return stale data if allowed
      if (options.allow_stale_on_error && entry) {
        console.warn(`Using stale cache for ${key}:`, error);
        return entry.value;
      }
      
      throw error;
    }
  }

  clear(): void {
    this.cache.clear();
  }

  private prune(): void {
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].fetched_at - b[1].fetched_at);
    
    // Remove oldest 20%
    const toRemove = Math.floor(this.maxSize * 0.2);
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0]);
    }
  }
}

/**
 * Singleton cache instance
 */
export const weatherCache = new WeatherCache();
```

---

## Testing Requirements

### Unit Tests

```typescript
// packages/shared-sdk/src/aviation/weather/openweathermap.test.ts

describe('OpenWeatherMapClient', () => {
  let client: OpenWeatherMapClient;

  beforeEach(() => {
    client = new OpenWeatherMapClient('test-key');
  });

  test('converts mph to knots', () => {
    const knots = client.mphToKnots(10);
    expect(knots).toBeCloseTo(8.69, 1);
  });

  test('formats weather data correctly', () => {
    const mockPayload = {
      weather: [{ description: 'clear sky' }],
      main: { temp: 72, humidity: 65 },
      wind: { speed: 10, deg: 280 }
    };
    
    const weather = client.toWeatherData('KSFO', mockPayload);
    expect(weather.airport).toBe('KSFO');
    expect(weather.temperature).toBe(72);
    expect(weather.wind_speed).toBeGreaterThan(0);
  });

  // Mock API tests
  test('fetches current weather', async () => {
    // TODO: Mock fetch
  });
});

describe('FlightCategory', () => {
  test('calculates VFR correctly', () => {
    expect(calculateFlightCategory(10, 5000)).toBe('VFR');
  });

  test('calculates MVFR correctly', () => {
    expect(calculateFlightCategory(4, 2000)).toBe('MVFR');
  });

  test('calculates IFR correctly', () => {
    expect(calculateFlightCategory(2, 800)).toBe('IFR');
  });

  test('calculates LIFR correctly', () => {
    expect(calculateFlightCategory(0.5, 400)).toBe('LIFR');
  });

  test('handles missing values', () => {
    expect(calculateFlightCategory(undefined, undefined)).toBe('VFR');
  });
});

describe('MetarParser', () => {
  const client = new MetarClient();

  test('parses complete METAR', () => {
    const raw = 'KSFO 121856Z 27015G25KT 10SM FEW015 BKN250 12/10 A2990';
    const parsed = client.parseMetar(raw);
    
    expect(parsed.station).toBe('KSFO');
    expect(parsed.wind_direction).toBe(270);
    expect(parsed.wind_speed_kt).toBe(15);
    expect(parsed.wind_gust_kt).toBe(25);
    expect(parsed.visibility_sm).toBe(10);
    expect(parsed.temperature_f).toBeCloseTo(54, 0);
    expect(parsed.altimeter_inhg).toBeCloseTo(29.90, 2);
  });

  test('handles negative temperatures', () => {
    const raw = 'KJFK 121851Z 31008KT M05/M10 A2992';
    const parsed = client.parseMetar(raw);
    
    expect(parsed.temperature_f).toBeLessThan(32);
    expect(parsed.dewpoint_f).toBeLessThan(32);
  });
});
```

---

## Migration Path

1. Create shared SDK weather module structure
2. Implement TypeScript versions
3. Configure keystore integration
4. Write comprehensive tests
5. Create Python wrappers
6. Integrate into accident-tracker (optional)
7. Update flight-planner later

---

## Acceptance Criteria

- [ ] All weather clients implemented (OWM, Open-Meteo, METAR)
- [ ] Caching working (5-10min TTL)
- [ ] API keys from keystore
- [ ] Flight category calculations working
- [ ] All tests passing (>80% coverage)
- [ ] Python wrappers functional
- [ ] Documentation complete
- [ ] Rate limiting handled gracefully
- [ ] Error handling robust

---

## Timeline

**Days 1-2:** OpenWeatherMap + METAR clients
**Day 3:** Open-Meteo client + flight category
**Day 4:** Caching, testing, Python wrappers, docs

---

**Status:** Ready for implementation
**Dependencies:** Aviation-o2d (airports for coordinate lookup)
**Target Completion:** 3-4 days
