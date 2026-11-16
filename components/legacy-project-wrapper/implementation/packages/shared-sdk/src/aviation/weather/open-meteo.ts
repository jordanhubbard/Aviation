/**
 * Open-Meteo API Client
 * 
 * Provides weather forecasts from Open-Meteo (free, no API key required).
 * Extracted from flight-planner for shared use.
 */

import { weatherCache } from './cache.js';
import type { JSONWeatherTransport } from './types.js';

export const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

export class OpenMeteoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenMeteoError';
  }
}

export interface CurrentWeather {
  temperature: number;         // Fahrenheit
  windspeed: number;           // knots
  winddirection: number;       // degrees
  weathercode: number;
  is_day: number;
  time: string;
}

export interface DailyForecast {
  date: string;
  temp_max_f: number | null;
  temp_min_f: number | null;
  precipitation_mm: number | null;
  wind_speed_max_kt: number | null;
}

export interface HourlyForecast {
  time: string;
  visibility_m: number | null;
  cloudcover_pct: number | null;
  precipitation_mm: number | null;
  wind_speed_kt: number | null;
}

/**
 * Get current weather for coordinates
 */
export async function getCurrentWeather(lat: number, lon: number): Promise<CurrentWeather> {
  const cacheKey = `om:current:${lat.toFixed(3)}:${lon.toFixed(3)}`;

  const fetchFn = async (): Promise<CurrentWeather> => {
    const url = new URL(OPEN_METEO_FORECAST_URL);
    url.searchParams.set('latitude', lat.toString());
    url.searchParams.set('longitude', lon.toString());
    url.searchParams.set('current_weather', 'true');
    url.searchParams.set('timezone', 'UTC');
    url.searchParams.set('temperature_unit', 'fahrenheit');
    url.searchParams.set('windspeed_unit', 'kn');

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      throw new OpenMeteoError(`HTTP ${response.status}`);
    }

    const payload = await response.json() as any;
    const cw = payload.current_weather;

    if (!cw || typeof cw !== 'object') {
      throw new OpenMeteoError('Unexpected Open-Meteo current_weather schema');
    }

    return cw as CurrentWeather;
  };

  return weatherCache.getOrSet(cacheKey, 600, fetchFn, true);
}

/**
 * Get daily forecast
 */
export async function getDailyForecast(
  lat: number,
  lon: number,
  days: number
): Promise<DailyForecast[]> {
  if (days < 1 || days > 16) {
    throw new OpenMeteoError('days must be between 1 and 16');
  }

  const cacheKey = `om:daily:${lat.toFixed(3)}:${lon.toFixed(3)}:${days}`;

  const fetchFn = async (): Promise<DailyForecast[]> => {
    const url = new URL(OPEN_METEO_FORECAST_URL);
    url.searchParams.set('latitude', lat.toString());
    url.searchParams.set('longitude', lon.toString());
    url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max');
    url.searchParams.set('forecast_days', days.toString());
    url.searchParams.set('timezone', 'UTC');
    url.searchParams.set('temperature_unit', 'fahrenheit');
    url.searchParams.set('windspeed_unit', 'kn');

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      throw new OpenMeteoError(`HTTP ${response.status}`);
    }

    const payload = await response.json() as any;
    const daily = payload.daily;

    if (!daily || typeof daily !== 'object') {
      throw new OpenMeteoError('Unexpected Open-Meteo response');
    }

    const times = daily.time as string[] | undefined;
    const tmax = daily.temperature_2m_max as number[] | undefined;
    const tmin = daily.temperature_2m_min as number[] | undefined;
    const precip = daily.precipitation_sum as number[] | undefined;
    const wind = daily.windspeed_10m_max as number[] | undefined;

    if (!Array.isArray(times) || !Array.isArray(tmax) || !Array.isArray(tmin)) {
      throw new OpenMeteoError('Unexpected Open-Meteo daily schema');
    }

    const out: DailyForecast[] = [];
    for (let i = 0; i < times.length; i++) {
      out.push({
        date: times[i],
        temp_max_f: tmax[i] ?? null,
        temp_min_f: tmin[i] ?? null,
        precipitation_mm: (precip && precip[i] !== undefined) ? precip[i] : null,
        wind_speed_max_kt: (wind && wind[i] !== undefined) ? wind[i] : null,
      });
    }

    return out;
  };

  return weatherCache.getOrSet(cacheKey, 1800, fetchFn, true);
}

/**
 * Get hourly forecast
 */
export async function getHourlyForecast(
  lat: number,
  lon: number,
  hours: number = 24
): Promise<HourlyForecast[]> {
  if (hours < 1 || hours > 168) {
    throw new OpenMeteoError('hours must be between 1 and 168');
  }

  const cacheKey = `om:hourly:${lat.toFixed(3)}:${lon.toFixed(3)}:${hours}`;

  const fetchFn = async (): Promise<HourlyForecast[]> => {
    const url = new URL(OPEN_METEO_FORECAST_URL);
    url.searchParams.set('latitude', lat.toString());
    url.searchParams.set('longitude', lon.toString());
    url.searchParams.set('hourly', 'visibility,cloudcover,precipitation,windspeed_10m');
    const forecastDays = Math.min(7, Math.max(1, Math.ceil(hours / 24) + 1));
    url.searchParams.set('forecast_days', forecastDays.toString());
    url.searchParams.set('timezone', 'UTC');
    url.searchParams.set('windspeed_unit', 'kn');

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      throw new OpenMeteoError(`HTTP ${response.status}`);
    }

    const payload = await response.json() as any;
    const hourly = payload.hourly;

    if (!hourly || typeof hourly !== 'object') {
      throw new OpenMeteoError('Unexpected Open-Meteo hourly schema');
    }

    const times = hourly.time as string[] | undefined;
    const vis = hourly.visibility as number[] | undefined;
    const clouds = hourly.cloudcover as number[] | undefined;
    const precip = hourly.precipitation as number[] | undefined;
    const wind = hourly.windspeed_10m as number[] | undefined;

    if (!Array.isArray(times)) {
      throw new OpenMeteoError('Unexpected Open-Meteo hourly schema');
    }

    const out: HourlyForecast[] = [];
    for (let i = 0; i < Math.min(times.length, hours); i++) {
      out.push({
        time: times[i],
        visibility_m: (vis && vis[i] !== undefined) ? vis[i] : null,
        cloudcover_pct: (clouds && clouds[i] !== undefined) ? clouds[i] : null,
        precipitation_mm: (precip && precip[i] !== undefined) ? precip[i] : null,
        wind_speed_kt: (wind && wind[i] !== undefined) ? wind[i] : null,
      });
    }

    return out;
  };

  return weatherCache.getOrSet(cacheKey, 1800, fetchFn, true);
}

/**
 * Sample points along a route (simple every-Nth sampling)
 */
export function samplePointsAlongRoute(
  points: Array<[number, number]>,
  interval: number = 5
): Array<[number, number]> {
  const step = Math.max(1, interval);
  return points.filter((_, i) => i % step === 0);
}

export class OpenMeteoPressureError extends OpenMeteoError {
  constructor(readonly kind: 'request' | 'provider' | 'response') {
    super(kind === 'request' ? 'Invalid Open-Meteo pressure-level request' : 'Open-Meteo pressure-level forecast unavailable');
    this.name = 'OpenMeteoPressureError';
  }
}

const PRESSURE_LEVELS = [1000, 925, 850, 700, 500, 300, 250, 200];
const PRESSURE_UNITS = [
  ['wind_speed', 'kn'], ['wind_direction', '°'],
  ['temperature', '°C'], ['geopotential_height', 'm'],
] as const;
export interface PressureLevelForecastPlan {
  url: string;
  params: Record<string, string | number>;
  levels_hpa: number[];
}

/** Pure planning, including common normalization for application cache keys. */
export function planPressureLevelForecast(lat: number, lon: number, levels: readonly number[], hours: number): PressureLevelForecastPlan {
  if (typeof lat !== 'number' || !Number.isFinite(lat) || lat < -90 || lat > 90
      || typeof lon !== 'number' || !Number.isFinite(lon) || lon < -180 || lon > 180
      || !Array.isArray(levels) || levels.length < 1 || levels.length > 8
      || typeof hours !== 'number' || !Number.isInteger(hours) || hours < 1 || hours > 72) throw new OpenMeteoPressureError('request');
  const normalized: number[] = [];
  for (const level of levels) {
    if (typeof level !== 'number' || !Number.isInteger(level) || !PRESSURE_LEVELS.includes(level)) throw new OpenMeteoPressureError('request');
    if (!normalized.includes(level)) normalized.push(level);
  }
  return {
    url: OPEN_METEO_FORECAST_URL,
    params: {
      latitude: lat, longitude: lon,
      hourly: normalized.flatMap(level => PRESSURE_UNITS.map(([field]) => `${field}_${level}hPa`)).join(','),
      wind_speed_unit: 'kn', temperature_unit: 'celsius', timezone: 'UTC', forecast_hours: hours,
    },
    levels_hpa: normalized,
  };
}

function pressureRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

/** Trusted transport owns HTTP/time/byte bounds; data remains an unchanged forecast. */
export async function getPressureLevelForecast(lat: number, lon: number, levels: readonly number[], hours: number,
  transport: JSONWeatherTransport): Promise<{ url: string; data: Record<string, unknown>; levels_hpa: number[] }> {
  const plan = planPressureLevelForecast(lat, lon, levels, hours);
  if (typeof transport !== 'function') throw new OpenMeteoPressureError('request');
  let value: unknown;
  try { value = await transport(plan.url, plan.params); }
  catch { throw new OpenMeteoPressureError('provider'); }
  if (!pressureRecord(value) || typeof value.utc_offset_seconds !== 'number' || value.utc_offset_seconds !== 0
      || !pressureRecord(value.hourly) || !pressureRecord(value.hourly_units)) throw new OpenMeteoPressureError('response');
  const hourly = value.hourly, units = value.hourly_units, times = hourly.time;
  if (!Array.isArray(times) || times.length < 1 || times.length > hours) throw new OpenMeteoPressureError('response');
  for (const level of plan.levels_hpa) {
    for (const [field, unit] of PRESSURE_UNITS) {
      const variable = `${field}_${level}hPa`, array = hourly[variable];
      if (!Array.isArray(array) || array.length !== times.length || units[variable] !== unit) throw new OpenMeteoPressureError('response');
    }
  }
  return { url: plan.url, data: value, levels_hpa: plan.levels_hpa };
}
