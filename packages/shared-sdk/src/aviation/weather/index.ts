/**
 * Aviation Weather Services
 * 
 * Unified weather services for aviation applications including:
 * - Current weather (OpenWeatherMap, Open-Meteo)
 * - Forecasts (Open-Meteo daily/hourly)
 * - METAR fetching and parsing (AviationWeather.gov)
 * - Flight category determination (VFR/MVFR/IFR/LIFR)
 * - Weather recommendations and warnings
 * 
 * @module @aviation/shared-sdk/aviation/weather
 */

// Export all types
export * from './types';

// Export cache
export { TTLCache, weatherCache } from './cache';

// Export OpenWeatherMap client
export {
  getCurrentWeather as owmGetCurrentWeather,
  getAirportWeather as owmGetAirportWeather,
} from './openweathermap';

// Export Open-Meteo client
export {
  getCurrentWeather as omGetCurrentWeather,
  getDailyForecast as omGetDailyForecast,
  getHourlyForecast as omGetHourlyForecast,
  samplePointsAlongRoute,
} from './open-meteo';

// Export METAR services
export {
  parseMetar,
  fetchMetarRaw,
  fetchMetarRaws,
  fetchMetar,
  fetchMetars,
} from './metar';

// Export flight category services
export {
  flightCategory,
  recommendationForCategory,
  warningsForConditions,
  estimateCeilingFtFromCloudcover,
  scoreHour,
  bestDepartureWindows,
  colorForCategory,
} from './flight-category';
