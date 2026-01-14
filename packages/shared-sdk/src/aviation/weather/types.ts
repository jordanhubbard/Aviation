/**
 * Weather types for aviation applications
 * 
 * Provides type definitions for weather data from various sources:
 * - OpenWeatherMap (current weather)
 * - Open-Meteo (forecasts)
 * - AviationWeather.gov (METAR)
 * - Flight category calculations
 * 
 * @module aviation/weather/types
 */

/**
 * Flight category based on visibility and ceiling
 * VFR: Visual Flight Rules (best conditions)
 * MVFR: Marginal VFR (caution advised)
 * IFR: Instrument Flight Rules (poor conditions)
 * LIFR: Low IFR (very poor conditions)
 */
export type FlightCategory = 'VFR' | 'MVFR' | 'IFR' | 'LIFR';

/**
 * Current weather data at a location
 */
export interface WeatherData {
  /** Airport ICAO code (if applicable) */
  airport?: string;
  
  /** Latitude of location */
  latitude: number;
  
  /** Longitude of location */
  longitude: number;
  
  /** Weather description (e.g., "Clear sky", "Light rain") */
  conditions: string;
  
  /** Temperature in Fahrenheit */
  temperature: number;
  
  /** Wind speed in knots */
  wind_speed: number;
  
  /** Wind direction in degrees (0-360, optional) */
  wind_direction?: number;
  
  /** Wind gust speed in knots (optional) */
  wind_gust?: number;
  
  /** Visibility in statute miles (optional) */
  visibility?: number;
  
  /** Ceiling in feet AGL (Above Ground Level, optional) */
  ceiling?: number;
  
  /** Pressure in inHg (optional) */
  pressure?: number;
  
  /** Relative humidity percentage (optional) */
  humidity?: number;
  
  /** Dewpoint in Fahrenheit (optional) */
  dewpoint?: number;
  
  /** Raw METAR text (if from METAR source) */
  metar?: string;
  
  /** Calculated flight category (optional) */
  flight_category?: FlightCategory;
  
  /** Flight recommendation text (optional) */
  recommendation?: string;
  
  /** Weather warnings array (optional) */
  warnings?: string[];
  
  /** Timestamp of data (ISO 8601 UTC) */
  timestamp: string;
  
  /** Data source (e.g., "openweathermap", "metar") */
  source: string;
}

/**
 * Forecast for a single day
 */
export interface ForecastDay {
  /** Date in YYYY-MM-DD format */
  date: string;
  
  /** High temperature in Fahrenheit */
  temp_high: number;
  
  /** Low temperature in Fahrenheit */
  temp_low: number;
  
  /** Weather conditions description */
  conditions: string;
  
  /** Wind speed in knots */
  wind_speed: number;
  
  /** Wind direction in degrees (optional) */
  wind_direction?: number;
  
  /** Precipitation probability (0-100 %) */
  precipitation_probability: number;
  
  /** Precipitation amount in inches (optional) */
  precipitation_amount?: number;
  
  /** Cloud cover percentage (0-100 %) */
  cloud_cover?: number;
  
  /** Flight category for midday (optional) */
  flight_category?: FlightCategory;
}

/**
 * Multi-day weather forecast
 */
export interface WeatherForecast {
  /** Latitude of location */
  latitude: number;
  
  /** Longitude of location */
  longitude: number;
  
  /** Airport ICAO code (if applicable) */
  airport?: string;
  
  /** Array of forecast days */
  days: ForecastDay[];
  
  /** Timestamp of forecast generation (ISO 8601 UTC) */
  timestamp: string;
  
  /** Data source */
  source: string;
}

/**
 * Parsed METAR components
 */
export interface METARData {
  /** Raw METAR text */
  raw: string;
  
  /** Airport ICAO code */
  station: string;
  
  /** Observation time (ISO 8601 UTC) */
  time: string;
  
  /** Wind information */
  wind: {
    /** Wind direction in degrees */
    direction: number;
    /** Wind speed in knots */
    speed: number;
    /** Gust speed in knots (optional) */
    gust?: number;
    /** Variable wind direction (optional) */
    variable?: boolean;
  };
  
  /** Visibility in statute miles */
  visibility: number;
  
  /** Temperature in Fahrenheit */
  temperature: number;
  
  /** Dewpoint in Fahrenheit */
  dewpoint: number;
  
  /** Altimeter setting in inHg */
  altimeter: number;
  
  /** Cloud layers */
  clouds: Array<{
    /** Coverage (SKC, FEW, SCT, BKN, OVC) */
    coverage: string;
    /** Altitude in feet AGL */
    altitude: number;
  }>;
  
  /** Weather conditions (e.g., "RA" for rain, "SN" for snow) */
  conditions: string[];
  
  /** Flight category calculated from visibility and ceiling */
  flight_category: FlightCategory;
  
  /** Ceiling in feet AGL (lowest BKN or OVC layer, or null) */
  ceiling: number | null;
  
  /** Remarks section (optional) */
  remarks?: string;
}

/**
 * Weather cache entry
 */
export interface WeatherCacheEntry<T> {
  /** Cached data */
  data: T;
  
  /** Timestamp when cached (milliseconds since epoch) */
  cached_at: number;
  
  /** TTL in milliseconds */
  ttl: number;
}

/**
 * Options for weather API clients
 */
export interface WeatherClientOptions {
  /** API key (if required) */
  apiKey?: string;
  
  /** Base URL override (optional) */
  baseUrl?: string;
  
  /** Cache TTL in milliseconds (optional) */
  cacheTtl?: number;
  
  /** Enable caching (default: true) */
  enableCache?: boolean;
  
  /** Request timeout in milliseconds (default: 5000) */
  timeout?: number;
}

/**
 * Flight category thresholds
 */
export interface FlightCategoryThresholds {
  /** VFR minimum visibility (statute miles) */
  vfr_visibility: number;
  
  /** VFR minimum ceiling (feet AGL) */
  vfr_ceiling: number;
  
  /** MVFR minimum visibility (statute miles) */
  mvfr_visibility: number;
  
  /** MVFR minimum ceiling (feet AGL) */
  mvfr_ceiling: number;
  
  /** IFR minimum visibility (statute miles) */
  ifr_visibility: number;
  
  /** IFR minimum ceiling (feet AGL) */
  ifr_ceiling: number;
}

/**
 * Standard FAA flight category thresholds
 */
export const STANDARD_THRESHOLDS: FlightCategoryThresholds = {
  vfr_visibility: 5.0,
  vfr_ceiling: 3000,
  mvfr_visibility: 3.0,
  mvfr_ceiling: 1000,
  ifr_visibility: 1.0,
  ifr_ceiling: 500
};
