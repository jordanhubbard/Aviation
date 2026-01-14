/**
 * OpenWeatherMap API Client
 * 
 * Provides current weather data from OpenWeatherMap.
 * Requires OPENWEATHERMAP_API_KEY environment variable.
 * 
 * Extracted from flightplanner for shared use.
 */

import { weatherCache } from './cache';

export class OpenWeatherMapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenWeatherMapError';
  }
}

export interface OpenWeatherMapResponse {
  coord?: { lat: number; lon: number };
  weather?: Array<{ id: number; main: string; description: string; icon: string }>;
  main?: {
    temp: number;
    feels_like: number;
    temp_min: number;
    temp_max: number;
    pressure: number;
    humidity: number;
  };
  wind?: { speed: number; deg: number; gust?: number };
  clouds?: { all: number };
  visibility?: number;
  dt: number;
  name: string;
}

export interface WeatherData {
  airport: string;
  conditions: string;
  temperature: number;       // Fahrenheit
  wind_speed: number;        // knots
  wind_direction: number;    // degrees
  visibility: number;        // statute miles
  ceiling: number;           // feet
  metar: string;
}

/**
 * Get API key from environment
 */
function getApiKey(): string {
  const key = process.env.OPENWEATHERMAP_API_KEY || process.env.OPENWEATHER_API_KEY;
  if (!key) {
    throw new OpenWeatherMapError('Missing OPENWEATHERMAP_API_KEY');
  }
  return key;
}

/**
 * Get current weather for coordinates
 */
export async function getCurrentWeather(lat: number, lon: number): Promise<OpenWeatherMapResponse> {
  const key = getApiKey();
  const cacheKey = `owm:current:${lat.toFixed(3)}:${lon.toFixed(3)}`;

  const fetchFn = async (): Promise<OpenWeatherMapResponse> => {
    const url = new URL('https://api.openweathermap.org/data/2.5/weather');
    url.searchParams.set('lat', lat.toString());
    url.searchParams.set('lon', lon.toString());
    url.searchParams.set('appid', key);
    url.searchParams.set('units', 'imperial');

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(20000),
    });

    if (!response.ok) {
      throw new OpenWeatherMapError(`HTTP ${response.status}`);
    }

    return await response.json() as OpenWeatherMapResponse;
  };

  return weatherCache.getOrSet(cacheKey, 300, fetchFn, true);
}

/**
 * Convert MPH to knots
 */
function mphToKnots(mph: number | null | undefined): number {
  return (mph || 0) * 0.868976;
}

/**
 * Convert meters to statute miles
 */
function metersToSM(meters: number | null | undefined): number {
  return (meters || 0) / 1609.34;
}

/**
 * Estimate ceiling from cloud percentage
 */
function estimateCeilingFt(cloudPercent: number | null | undefined): number {
  const pct = cloudPercent || 0;
  if (pct >= 75) return 1500;
  if (pct >= 50) return 3000;
  if (pct >= 25) return 5000;
  return 10000;
}

/**
 * Convert OpenWeatherMap response to simplified weather data
 */
export function toWeatherData(airportCode: string, payload: OpenWeatherMapResponse): WeatherData {
  const weather = payload.weather?.[0];
  const main = payload.main || {} as any;
  const wind = payload.wind || {} as any;
  const clouds = payload.clouds || {} as any;

  const temp_f = main.temp || 0;
  const wind_speed_kt = mphToKnots(wind.speed);
  const wind_dir = wind.deg || 0;
  const vis_sm = metersToSM(payload.visibility);
  const ceiling_ft = estimateCeilingFt(clouds.all);

  const conditions = weather?.description || weather?.main || 'Unknown';

  return {
    airport: airportCode.toUpperCase(),
    conditions,
    temperature: Math.round(temp_f),
    wind_speed: Math.round(wind_speed_kt),
    wind_direction: wind_dir,
    visibility: Math.round(vis_sm * 10) / 10,
    ceiling: Math.round(ceiling_ft),
    metar: '',
  };
}
