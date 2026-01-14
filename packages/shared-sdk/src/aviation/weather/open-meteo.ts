/**
 * Open-Meteo API Client
 * 
 * Provides weather forecasts from Open-Meteo (free, no API key required).
 * Extracted from flightplanner for shared use.
 */

import { weatherCache } from './cache';

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
    const url = new URL('https://api.open-meteo.com/v1/forecast');
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
    const url = new URL('https://api.open-meteo.com/v1/forecast');
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
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', lat.toString());
    url.searchParams.set('longitude', lon.toString());
    url.searchParams.set('hourly', 'visibility,cloudcover,precipitation,windspeed_10m');
    url.searchParams.set('forecast_days', '2');
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
