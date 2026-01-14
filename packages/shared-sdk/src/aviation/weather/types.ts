/**
 * Type definitions for aviation weather services
 * 
 * This module provides TypeScript types for weather data from various sources:
 * - OpenWeatherMap API
 * - Open-Meteo API
 * - AviationWeather.gov METAR API
 */

/**
 * Flight categories based on visibility and ceiling
 * 
 * - VFR: Visual Flight Rules (ceiling ≥3000ft, visibility ≥5sm)
 * - MVFR: Marginal VFR (ceiling 1000-3000ft, visibility 3-5sm)
 * - IFR: Instrument Flight Rules (ceiling 500-1000ft, visibility 1-3sm)
 * - LIFR: Low IFR (ceiling <500ft, visibility <1sm)
 * - UNKNOWN: Insufficient data
 */
export type FlightCategory = 'VFR' | 'MVFR' | 'IFR' | 'LIFR' | 'UNKNOWN';

/**
 * Thresholds for determining flight categories
 */
export interface FlightCategoryThresholds {
  vfr_ceiling_ft: number;
  vfr_visibility_sm: number;
  mvfr_ceiling_ft: number;
  mvfr_visibility_sm: number;
  ifr_ceiling_ft: number;
  ifr_visibility_sm: number;
}

/**
 * Default FAA thresholds for flight categories
 */
export const DEFAULT_THRESHOLDS: FlightCategoryThresholds = {
  vfr_ceiling_ft: 3000,
  vfr_visibility_sm: 5.0,
  mvfr_ceiling_ft: 1000,
  mvfr_visibility_sm: 3.0,
  ifr_ceiling_ft: 500,
  ifr_visibility_sm: 1.0,
};

/**
 * Standardized weather data structure
 */
export interface WeatherData {
  /** Airport ICAO code */
  airport: string;
  /** Weather conditions description */
  conditions: string;
  /** Temperature in Fahrenheit */
  temperature: number;
  /** Wind speed in knots */
  wind_speed: number;
  /** Wind direction in degrees (0-360) */
  wind_direction: number;
  /** Visibility in statute miles */
  visibility: number;
  /** Ceiling in feet AGL */
  ceiling: number;
  /** Raw METAR if available */
  metar?: string;
}

/**
 * OpenWeatherMap API response (partial)
 */
export interface OpenWeatherMapResponse {
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
  wind: {
    speed: number;
    deg: number;
    gust?: number;
  };
  clouds: {
    all: number;
  };
  visibility?: number;
  dt: number;
  timezone: number;
  name: string;
}

/**
 * Open-Meteo current weather response
 */
export interface OpenMeteoCurrentWeather {
  temperature: number;
  windspeed: number;
  winddirection: number;
  weathercode: number;
  time: string;
}

/**
 * Open-Meteo daily forecast item
 */
export interface OpenMeteoDailyForecast {
  date: string;
  temp_max_f: number | null;
  temp_min_f: number | null;
  precipitation_mm: number | null;
  wind_speed_max_kt: number | null;
}

/**
 * Open-Meteo hourly forecast item
 */
export interface OpenMeteoHourlyForecast {
  time: string;
  visibility_m: number | null;
  cloudcover_pct: number | null;
  precipitation_mm: number | null;
  wind_speed_kt: number | null;
}

/**
 * Parsed METAR data
 */
export interface ParsedMetar {
  wind_direction?: number;
  wind_speed_kt?: number;
  visibility_sm?: number;
  temperature_f?: number;
  ceiling_ft?: number;
}

/**
 * Weather warnings
 */
export interface WeatherWarnings {
  visibility?: string;
  ceiling?: string;
  wind?: string;
}

/**
 * Departure window recommendation
 */
export interface DepartureWindow {
  start_time: string;
  end_time: string;
  score: number;
  flight_category: FlightCategory;
}

/**
 * Error class for weather service errors
 */
export class WeatherError extends Error {
  constructor(message: string, public readonly serviceName: string, public readonly cause?: Error) {
    super(message);
    this.name = 'WeatherError';
  }
}

/**
 * Error class for API key issues
 */
export class WeatherApiKeyError extends WeatherError {
  constructor(serviceName: string) {
    super(`Missing API key for ${serviceName}`, serviceName);
    this.name = 'WeatherApiKeyError';
  }
}
