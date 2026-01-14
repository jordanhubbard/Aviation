/**
 * Weather Services for Aviation
 * 
 * Comprehensive weather data services for flight planning.
 * Supports multiple weather APIs with caching and error handling.
 * 
 * @module @aviation/shared-sdk/aviation/weather
 * 
 * @example
 * ```typescript
 * import { fetchMetarRaw, parseMetar, flightCategory } from '@aviation/shared-sdk';
 * 
 * // Fetch and parse METAR
 * const raw = await fetchMetarRaw('KSFO');
 * const parsed = parseMetar(raw);
 * 
 * // Determine flight category
 * const category = flightCategory(parsed.visibility_sm, parsed.ceiling_ft);
 * console.log(`KSFO: ${category}`);
 * ```
 */

// Cache
export { WeatherCache, weatherCache } from './cache';

// METAR
export {
  fetchMetarRaw,
  fetchMetarRaws,
  parseMetar,
  type MetarData,
} from './metar';

// OpenWeatherMap
export {
  getCurrentWeather as getOpenWeatherMapCurrent,
  toWeatherData,
  OpenWeatherMapError,
  type OpenWeatherMapResponse,
  type WeatherData,
} from './openweathermap';

// Open-Meteo
export {
  getCurrentWeather as getOpenMeteoCurrent,
  getDailyForecast,
  getHourlyForecast,
  samplePointsAlongRoute,
  OpenMeteoError,
  type CurrentWeather,
  type DailyForecast,
  type HourlyForecast,
} from './open-meteo';

// Flight Category
export {
  flightCategory,
  recommendationForCategory,
  warningsForConditions,
  colorForCategory,
  metersToSM,
  estimateCeilingFromCloudCover,
  estimateCeilingFtFromCloudcover,
  scoreHour,
  bestDepartureWindows,
  DEFAULT_THRESHOLDS,
  type FlightCategory,
  type FlightCategoryThresholds,
  type DepartureWindow,
  type HourlyData,
} from './flight-category';
