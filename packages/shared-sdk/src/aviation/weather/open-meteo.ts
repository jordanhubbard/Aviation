/**
 * Open-Meteo API client for aviation weather
 * 
 * Provides weather forecasts from Open-Meteo API (free, no API key required).
 * Supports current weather, daily forecasts, and hourly forecasts.
 */

import { weatherCache } from './cache';
import {
  OpenMeteoCurrentWeather,
  OpenMeteoDailyForecast,
  OpenMeteoHourlyForecast,
  WeatherError,
} from './types';

/**
 * Get current weather from Open-Meteo API
 * 
 * @param lat - Latitude
 * @param lon - Longitude
 * @returns Current weather conditions
 * @throws WeatherError if API call fails
 */
export async function getCurrentWeather(
  lat: number,
  lon: number
): Promise<OpenMeteoCurrentWeather> {
  const cacheKey = `om:current:${lat.toFixed(3)}:${lon.toFixed(3)}`;

  return weatherCache.getOrSet(
    cacheKey,
    600, // 10 minute TTL
    async () => {
      const params = new URLSearchParams({
        latitude: lat.toString(),
        longitude: lon.toString(),
        current_weather: 'true',
        timezone: 'UTC',
        temperature_unit: 'fahrenheit',
        windspeed_unit: 'kn',
      });

      const url = `https://api.open-meteo.com/v1/forecast?${params}`;

      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'aviation-shared-sdk',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const payload = await response.json() as any;
        const currentWeather = payload.current_weather;

        if (!currentWeather || typeof currentWeather !== 'object') {
          throw new Error('Unexpected Open-Meteo current_weather schema');
        }

        return currentWeather as OpenMeteoCurrentWeather;
      } catch (error) {
        throw new WeatherError(
          `Failed to fetch Open-Meteo data: ${error}`,
          'Open-Meteo',
          error instanceof Error ? error : undefined
        );
      }
    },
    true // Allow stale data on error
  );
}

/**
 * Get daily weather forecast from Open-Meteo API
 * 
 * @param lat - Latitude
 * @param lon - Longitude
 * @param days - Number of forecast days (1-16)
 * @returns Array of daily forecasts
 * @throws WeatherError if API call fails or days is out of range
 */
export async function getDailyForecast(
  lat: number,
  lon: number,
  days: number = 7
): Promise<OpenMeteoDailyForecast[]> {
  if (days < 1 || days > 16) {
    throw new WeatherError(
      'days must be between 1 and 16',
      'Open-Meteo'
    );
  }

  const cacheKey = `om:daily:${lat.toFixed(3)}:${lon.toFixed(3)}:${days}`;

  return weatherCache.getOrSet(
    cacheKey,
    1800, // 30 minute TTL
    async () => {
      const params = new URLSearchParams({
        latitude: lat.toString(),
        longitude: lon.toString(),
        daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max',
        forecast_days: days.toString(),
        timezone: 'UTC',
        temperature_unit: 'fahrenheit',
        windspeed_unit: 'kn',
      });

      const url = `https://api.open-meteo.com/v1/forecast?${params}`;

      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'aviation-shared-sdk',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const payload = await response.json() as any;
        const daily = payload.daily;

        if (!daily || typeof daily !== 'object') {
          throw new Error('Unexpected Open-Meteo response');
        }

        const times = daily.time as string[];
        const tmax = daily.temperature_2m_max as number[];
        const tmin = daily.temperature_2m_min as number[];
        const precip = daily.precipitation_sum as number[] | undefined;
        const wind = daily.windspeed_10m_max as number[] | undefined;

        if (!Array.isArray(times) || !Array.isArray(tmax) || !Array.isArray(tmin)) {
          throw new Error('Unexpected Open-Meteo daily schema');
        }

        const forecasts: OpenMeteoDailyForecast[] = [];
        for (let i = 0; i < times.length; i++) {
          forecasts.push({
            date: times[i],
            temp_max_f: i < tmax.length ? tmax[i] : null,
            temp_min_f: i < tmin.length ? tmin[i] : null,
            precipitation_mm: precip && i < precip.length ? precip[i] : null,
            wind_speed_max_kt: wind && i < wind.length ? wind[i] : null,
          });
        }

        return forecasts;
      } catch (error) {
        throw new WeatherError(
          `Failed to fetch Open-Meteo daily forecast: ${error}`,
          'Open-Meteo',
          error instanceof Error ? error : undefined
        );
      }
    },
    true // Allow stale data on error
  );
}

/**
 * Get hourly weather forecast from Open-Meteo API
 * 
 * @param lat - Latitude
 * @param lon - Longitude
 * @param hours - Number of forecast hours (1-168)
 * @returns Array of hourly forecasts
 * @throws WeatherError if API call fails or hours is out of range
 */
export async function getHourlyForecast(
  lat: number,
  lon: number,
  hours: number = 24
): Promise<OpenMeteoHourlyForecast[]> {
  if (hours < 1 || hours > 168) {
    throw new WeatherError(
      'hours must be between 1 and 168',
      'Open-Meteo'
    );
  }

  const cacheKey = `om:hourly:${lat.toFixed(3)}:${lon.toFixed(3)}:${hours}`;

  return weatherCache.getOrSet(
    cacheKey,
    1800, // 30 minute TTL
    async () => {
      const params = new URLSearchParams({
        latitude: lat.toString(),
        longitude: lon.toString(),
        hourly: 'visibility,cloudcover,precipitation,windspeed_10m',
        forecast_days: '2',
        timezone: 'UTC',
        windspeed_unit: 'kn',
      });

      const url = `https://api.open-meteo.com/v1/forecast?${params}`;

      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'aviation-shared-sdk',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const payload = await response.json() as any;
        const hourly = payload.hourly;

        if (!hourly || typeof hourly !== 'object') {
          throw new Error('Unexpected Open-Meteo hourly schema');
        }

        const times = hourly.time as string[];
        const vis = hourly.visibility as number[] | undefined;
        const clouds = hourly.cloudcover as number[] | undefined;
        const precip = hourly.precipitation as number[] | undefined;
        const wind = hourly.windspeed_10m as number[] | undefined;

        if (!Array.isArray(times)) {
          throw new Error('Unexpected Open-Meteo hourly schema');
        }

        const forecasts: OpenMeteoHourlyForecast[] = [];
        for (let i = 0; i < Math.min(times.length, hours); i++) {
          forecasts.push({
            time: times[i],
            visibility_m: vis && i < vis.length ? vis[i] : null,
            cloudcover_pct: clouds && i < clouds.length ? clouds[i] : null,
            precipitation_mm: precip && i < precip.length ? precip[i] : null,
            wind_speed_kt: wind && i < wind.length ? wind[i] : null,
          });
        }

        return forecasts;
      } catch (error) {
        throw new WeatherError(
          `Failed to fetch Open-Meteo hourly forecast: ${error}`,
          'Open-Meteo',
          error instanceof Error ? error : undefined
        );
      }
    },
    true // Allow stale data on error
  );
}

/**
 * Sample points along a route for weather forecasting
 * 
 * @param points - Array of [lat, lon] coordinates
 * @param interval - Sample every Nth point
 * @returns Sampled points
 */
export function samplePointsAlongRoute(
  points: Array<[number, number]>,
  interval: number = 5
): Array<[number, number]> {
  const step = Math.max(1, interval);
  const sampled: Array<[number, number]> = [];

  for (let i = 0; i < points.length; i += step) {
    sampled.push(points[i]);
  }

  return sampled;
}
