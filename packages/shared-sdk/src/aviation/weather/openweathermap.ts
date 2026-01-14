/**
 * OpenWeatherMap API client
 * 
 * Fetches current weather data from OpenWeatherMap API.
 * Requires API key from keystore.
 * 
 * @module aviation/weather/openweathermap
 */

import type { WeatherData, WeatherClientOptions } from './types.js';
import { calculateFlightCategory, getFlightCategoryRecommendation, getWeatherWarnings } from './flight-category.js';
import { weatherCache, generateCacheKey, DEFAULT_CACHE_TTL } from './weather-cache.js';

/**
 * OpenWeatherMap API response structure
 */
interface OpenWeatherMapResponse {
  coord: {
    lon: number;
    lat: number;
  };
  weather: Array<{
    id: number;
    main: string;
    description: string;
    icon: string;
  }>;
  main: {
    temp: number;
    feels_like: number;
    temp_min: number;
    temp_max: number;
    pressure: number;
    humidity: number;
  };
  visibility?: number;
  wind: {
    speed: number;
    deg?: number;
    gust?: number;
  };
  clouds: {
    all: number;
  };
  dt: number;
  sys: {
    country: string;
    sunrise: number;
    sunset: number;
  };
  timezone: number;
  name: string;
}

/**
 * OpenWeatherMap client
 */
export class OpenWeatherMapClient {
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;
  private enableCache: boolean;
  private cacheTtl: number;

  constructor(options: WeatherClientOptions) {
    if (!options.apiKey) {
      throw new Error('OpenWeatherMap API key is required');
    }

    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl || 'https://api.openweathermap.org/data/2.5';
    this.timeout = options.timeout || 5000;
    this.enableCache = options.enableCache ?? true;
    this.cacheTtl = options.cacheTtl || DEFAULT_CACHE_TTL.current;
  }

  /**
   * Convert MPH to knots
   */
  private mphToKnots(mph: number): number {
    return mph * 0.868976;
  }

  /**
   * Convert meters to statute miles
   */
  private metersToSM(meters: number): number {
    return meters / 1609.34;
  }

  /**
   * Estimate ceiling from cloud percentage
   * This is a rough approximation since OpenWeatherMap doesn't provide actual ceiling
   */
  private estimateCeiling(cloudPercent: number): number {
    if (cloudPercent >= 75) return 1500; // Overcast
    if (cloudPercent >= 50) return 3000; // Broken
    if (cloudPercent >= 25) return 5000; // Scattered
    return 10000; // Few/Clear
  }

  /**
   * Convert inHg to hPa
   */
  private inHgToHPa(inHg: number): number {
    return inHg * 33.8639;
  }

  /**
   * Convert hPa to inHg
   */
  private hPaToInHg(hPa: number): number {
    return hPa / 33.8639;
  }

  /**
   * Fetch current weather from OpenWeatherMap
   * 
   * @param lat - Latitude
   * @param lon - Longitude
   * @param airport - Airport ICAO code (optional)
   * @returns Weather data or null if fetch fails
   * 
   * @example
   * ```typescript
   * const client = new OpenWeatherMapClient({ apiKey: 'your-api-key' });
   * const weather = await client.getCurrentWeather(37.619, -122.375, 'KSFO');
   * if (weather) {
   *   console.log(`${weather.airport}: ${weather.temperature}°F`);
   *   console.log(`Flight category: ${weather.flight_category}`);
   * }
   * ```
   */
  async getCurrentWeather(lat: number, lon: number, airport?: string): Promise<WeatherData | null> {
    const cacheKey = generateCacheKey('openweathermap', lat, lon);
    
    // Check cache
    if (this.enableCache) {
      const cached = weatherCache.get<WeatherData>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      const url = `${this.baseUrl}/weather?lat=${lat}&lon=${lon}&appid=${this.apiKey}&units=imperial`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return null;
      }

      const data = await response.json() as OpenWeatherMapResponse;
      
      // Extract weather data
      const temperature = data.main.temp;
      const wind_speed = this.mphToKnots(data.wind.speed);
      const wind_direction = data.wind.deg;
      const wind_gust = data.wind.gust ? this.mphToKnots(data.wind.gust) : undefined;
      const visibility = data.visibility ? this.metersToSM(data.visibility) : undefined;
      const ceiling = this.estimateCeiling(data.clouds.all);
      const pressure = this.hPaToInHg(data.main.pressure);
      const humidity = data.main.humidity;
      const dewpoint = temperature - ((100 - humidity) / 5); // Approximation
      const conditions = data.weather[0]?.description || 'Unknown';

      // Calculate flight category
      const flight_category = calculateFlightCategory(visibility || 10, ceiling);
      const recommendation = getFlightCategoryRecommendation(flight_category);
      const warnings = getWeatherWarnings(visibility || 10, ceiling, wind_speed, wind_gust);

      const weatherData: WeatherData = {
        airport,
        latitude: lat,
        longitude: lon,
        conditions,
        temperature,
        wind_speed,
        wind_direction,
        wind_gust,
        visibility,
        ceiling,
        pressure,
        humidity,
        dewpoint,
        flight_category,
        recommendation,
        warnings,
        timestamp: new Date(data.dt * 1000).toISOString(),
        source: 'openweathermap'
      };

      // Cache the result
      if (this.enableCache) {
        weatherCache.set(cacheKey, weatherData, this.cacheTtl);
      }

      return weatherData;
    } catch (error) {
      // Network error or timeout
      return null;
    }
  }
}

/**
 * Create OpenWeatherMap client with API key from environment or keystore
 * 
 * @param apiKey - OpenWeatherMap API key
 * @param options - Client options
 * @returns OpenWeatherMap client instance
 * 
 * @example
 * ```typescript
 * const client = createOpenWeatherMapClient('your-api-key');
 * const weather = await client.getCurrentWeather(37.619, -122.375);
 * ```
 */
export function createOpenWeatherMapClient(
  apiKey: string,
  options: Omit<WeatherClientOptions, 'apiKey'> = {}
): OpenWeatherMapClient {
  return new OpenWeatherMapClient({ ...options, apiKey });
}
