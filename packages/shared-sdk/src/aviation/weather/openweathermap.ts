/**
 * OpenWeatherMap API client for aviation weather
 * 
 * Provides current weather conditions from OpenWeatherMap API.
 * Requires OPENWEATHERMAP_API_KEY or OPENWEATHER_API_KEY in environment/keystore.
 */

import { weatherCache } from './cache';
import {
  OpenWeatherMapResponse,
  WeatherData,
  WeatherError,
  WeatherApiKeyError,
} from './types';

/**
 * Get API key from environment or keystore
 */
function getApiKey(): string {
  // Check environment variables
  const key =
    process.env.OPENWEATHERMAP_API_KEY ||
    process.env.OPENWEATHER_API_KEY;

  if (!key) {
    throw new WeatherApiKeyError('OpenWeatherMap');
  }

  return key;
}

/**
 * Convert miles per hour to knots
 */
function mphToKnots(mph: number | null | undefined): number {
  if (mph == null) return 0;
  return mph * 0.868976;
}

/**
 * Convert meters to statute miles
 */
function metersToSm(meters: number | null | undefined): number {
  if (meters == null) return 0;
  return meters / 1609.34;
}

/**
 * Estimate ceiling from cloud percentage (rough heuristic)
 */
function estimateCeilingFt(cloudPct: number | null | undefined): number {
  if (cloudPct == null) return 10000;

  if (cloudPct >= 75) return 1500;
  if (cloudPct >= 50) return 3000;
  if (cloudPct >= 25) return 5000;
  return 10000;
}

/**
 * Convert OpenWeatherMap response to standardized WeatherData
 */
function toWeatherData(
  airportCode: string,
  payload: OpenWeatherMapResponse
): WeatherData {
  const weather = payload.weather?.[0] || {};
  const main = payload.main || {};
  const wind = payload.wind || {};
  const clouds = payload.clouds || {};

  const tempF = main.temp || 0;
  const windSpeedKt = mphToKnots(wind.speed);
  const windDir = wind.deg || 0;
  const visSm = metersToSm(payload.visibility);
  const ceilingFt = estimateCeilingFt(clouds.all);

  const conditions = weather.description || weather.main || 'Unknown';

  return {
    airport: airportCode.toUpperCase(),
    conditions,
    temperature: Math.round(tempF),
    wind_speed: Math.round(windSpeedKt),
    wind_direction: windDir,
    visibility: Math.round(visSm * 10) / 10,
    ceiling: Math.round(ceilingFt),
    metar: '',
  };
}

/**
 * Fetch current weather from OpenWeatherMap API
 * 
 * @param lat - Latitude
 * @param lon - Longitude
 * @returns Current weather conditions
 * @throws WeatherError if API call fails
 */
export async function getCurrentWeather(
  lat: number,
  lon: number
): Promise<OpenWeatherMapResponse> {
  const apiKey = getApiKey();
  const cacheKey = `owm:current:${lat.toFixed(3)}:${lon.toFixed(3)}`;

  return weatherCache.getOrSet(
    cacheKey,
    300, // 5 minute TTL
    async () => {
      const params = new URLSearchParams({
        lat: lat.toString(),
        lon: lon.toString(),
        appid: apiKey,
        units: 'imperial',
      });

      const url = `https://api.openweathermap.org/data/2.5/weather?${params}`;

      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'aviation-shared-sdk',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json() as OpenWeatherMapResponse;
      } catch (error) {
        throw new WeatherError(
          `Failed to fetch OpenWeatherMap data: ${error}`,
          'OpenWeatherMap',
          error instanceof Error ? error : undefined
        );
      }
    },
    true // Allow stale data on error
  );
}

/**
 * Get standardized weather data for an airport
 * 
 * @param airportCode - ICAO airport code
 * @param lat - Airport latitude
 * @param lon - Airport longitude
 * @returns Standardized weather data
 */
export async function getAirportWeather(
  airportCode: string,
  lat: number,
  lon: number
): Promise<WeatherData> {
  const payload = await getCurrentWeather(lat, lon);
  return toWeatherData(airportCode, payload);
}
