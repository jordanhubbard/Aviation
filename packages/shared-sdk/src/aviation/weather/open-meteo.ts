/**
 * Open-Meteo API client
 * 
 * Fetches weather forecast data from Open-Meteo API.
 * No API key required - free and open source!
 * 
 * @module aviation/weather/open-meteo
 */

import type { WeatherForecast, ForecastDay, WeatherClientOptions } from './types.js';
import { calculateFlightCategory } from './flight-category.js';
import { weatherCache, generateCacheKey, DEFAULT_CACHE_TTL } from './weather-cache.js';

/**
 * Open-Meteo daily forecast API response
 */
interface OpenMeteoDailyResponse {
  latitude: number;
  longitude: number;
  timezone: string;
  daily: {
    time: string[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
    precipitation_probability_max: number[];
    windspeed_10m_max: number[];
    winddirection_10m_dominant: number[];
    weathercode: number[];
    cloudcover_mean?: number[];
  };
}

/**
 * Weather code to description mapping (WMO codes)
 */
const WEATHER_CODE_MAP: Record<number, string> = {
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
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail'
};

/**
 * Open-Meteo client for weather forecasts
 */
export class OpenMeteoClient {
  private baseUrl: string;
  private timeout: number;
  private enableCache: boolean;
  private cacheTtl: number;

  constructor(options: WeatherClientOptions = {}) {
    this.baseUrl = options.baseUrl || 'https://api.open-meteo.com/v1';
    this.timeout = options.timeout || 5000;
    this.enableCache = options.enableCache ?? true;
    this.cacheTtl = options.cacheTtl || DEFAULT_CACHE_TTL.forecast;
  }

  /**
   * Get weather code description
   */
  private getWeatherDescription(code: number): string {
    return WEATHER_CODE_MAP[code] || 'Unknown';
  }

  /**
   * Convert mm to inches
   */
  private mmToInches(mm: number): number {
    return mm / 25.4;
  }

  /**
   * Estimate cloud cover from weather code
   */
  private estimateCloudCover(code: number): number {
    if (code === 0) return 0; // Clear
    if (code === 1) return 25; // Mainly clear
    if (code === 2) return 50; // Partly cloudy
    if (code === 3) return 100; // Overcast
    return 50; // Default
  }

  /**
   * Fetch daily weather forecast from Open-Meteo
   * 
   * @param lat - Latitude
   * @param lon - Longitude
   * @param days - Number of forecast days (1-16, default 7)
   * @param airport - Airport ICAO code (optional)
   * @returns Weather forecast or null if fetch fails
   * 
   * @example
   * ```typescript
   * const client = new OpenMeteoClient();
   * const forecast = await client.getForecast(37.619, -122.375, 7, 'KSFO');
   * if (forecast) {
   *   forecast.days.forEach(day => {
   *     console.log(`${day.date}: ${day.temp_high}°F / ${day.temp_low}°F`);
   *     console.log(`  ${day.conditions}, ${day.precipitation_probability}% rain`);
   *   });
   * }
   * ```
   */
  async getForecast(lat: number, lon: number, days: number = 7, airport?: string): Promise<WeatherForecast | null> {
    if (days < 1 || days > 16) {
      throw new Error('days must be between 1 and 16');
    }

    const cacheKey = `${generateCacheKey('open-meteo', lat, lon)}:${days}`;
    
    // Check cache
    if (this.enableCache) {
      const cached = weatherCache.get<WeatherForecast>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      const params = new URLSearchParams({
        latitude: lat.toString(),
        longitude: lon.toString(),
        daily: [
          'temperature_2m_max',
          'temperature_2m_min',
          'precipitation_sum',
          'precipitation_probability_max',
          'windspeed_10m_max',
          'winddirection_10m_dominant',
          'weathercode',
          'cloudcover_mean'
        ].join(','),
        forecast_days: days.toString(),
        timezone: 'UTC',
        temperature_unit: 'fahrenheit',
        windspeed_unit: 'kn',
        precipitation_unit: 'mm'
      });

      const url = `${this.baseUrl}/forecast?${params}`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return null;
      }

      const data = await response.json() as OpenMeteoDailyResponse;
      
      // Parse daily forecasts
      const forecastDays: ForecastDay[] = [];
      
      for (let i = 0; i < data.daily.time.length; i++) {
        const weatherCode = data.daily.weathercode[i];
        const cloudCover = data.daily.cloudcover_mean?.[i] ?? this.estimateCloudCover(weatherCode);
        
        // Estimate ceiling from cloud cover
        let ceiling: number | null = null;
        if (cloudCover >= 75) ceiling = 1500;
        else if (cloudCover >= 50) ceiling = 3000;
        else if (cloudCover >= 25) ceiling = 5000;
        else ceiling = null; // Clear

        // Estimate visibility (10 SM default, reduced for fog/heavy precip)
        let visibility = 10;
        if (weatherCode === 45 || weatherCode === 48) visibility = 0.5; // Fog
        else if (weatherCode >= 61 && weatherCode <= 65) visibility = 5; // Rain
        else if (weatherCode >= 71 && weatherCode <= 77) visibility = 3; // Snow

        const flight_category = calculateFlightCategory(visibility, ceiling);

        forecastDays.push({
          date: data.daily.time[i],
          temp_high: data.daily.temperature_2m_max[i],
          temp_low: data.daily.temperature_2m_min[i],
          conditions: this.getWeatherDescription(weatherCode),
          wind_speed: data.daily.windspeed_10m_max[i],
          wind_direction: data.daily.winddirection_10m_dominant[i],
          precipitation_probability: data.daily.precipitation_probability_max[i],
          precipitation_amount: this.mmToInches(data.daily.precipitation_sum[i]),
          cloud_cover: cloudCover,
          flight_category
        });
      }

      const forecast: WeatherForecast = {
        latitude: lat,
        longitude: lon,
        airport,
        days: forecastDays,
        timestamp: new Date().toISOString(),
        source: 'open-meteo'
      };

      // Cache the result
      if (this.enableCache) {
        weatherCache.set(cacheKey, forecast, this.cacheTtl);
      }

      return forecast;
    } catch (error) {
      // Network error or timeout
      return null;
    }
  }
}

/**
 * Singleton Open-Meteo client instance
 */
export const openMeteoClient = new OpenMeteoClient();

/**
 * Convenience function to fetch weather forecast
 * 
 * @param lat - Latitude
 * @param lon - Longitude
 * @param days - Number of forecast days (1-16, default 7)
 * @param airport - Airport ICAO code (optional)
 * @returns Weather forecast or null if fetch fails
 * 
 * @example
 * ```typescript
 * const forecast = await fetchForecast(37.619, -122.375, 7);
 * if (forecast) {
 *   console.log(`7-day forecast for ${forecast.latitude}, ${forecast.longitude}`);
 *   forecast.days.forEach(day => {
 *     console.log(`${day.date}: ${day.conditions}`);
 *   });
 * }
 * ```
 */
export async function fetchForecast(
  lat: number,
  lon: number,
  days: number = 7,
  airport?: string
): Promise<WeatherForecast | null> {
  return openMeteoClient.getForecast(lat, lon, days, airport);
}
