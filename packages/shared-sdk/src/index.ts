export * from './ai';
export * from './service';

// Caching
export * from './cache';

// Aviation data services
export {
  AirportDatabase,
  getAirportDatabase,
  searchAirports,
  getAirportByCode,
  findNearbyAirports,
} from './aviation/airports';
export type { Airport, AirportSearchOptions } from './aviation/airports';

// Aviation navigation utilities
export * from './aviation/navigation';

// Aviation weather services - explicit exports with explicit path
export {
  // Cache
  WeatherCache,
  weatherCache,
  // METAR
  fetchMetarRaw,
  fetchMetarRaws,
  parseMetar,
  type MetarData,
  // OpenWeatherMap
  getOpenWeatherMapCurrent,
  toWeatherData,
  OpenWeatherMapError,
  type OpenWeatherMapResponse,
  type WeatherData,
  // Open-Meteo
  getOpenMeteoCurrent,
  getDailyForecast,
  getHourlyForecast,
  samplePointsAlongRoute,
  OpenMeteoError,
  type CurrentWeather,
  type DailyForecast,
  type HourlyForecast,
  // Flight Category
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
} from './aviation/weather/index';

// Integrations
export * as GoogleCalendar from './integrations/google';
