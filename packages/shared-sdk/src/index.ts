export * from './ai';
export * from './service';

<<<<<<< HEAD
// Aviation modules
export * from './aviation/airports';
export * from './aviation/navigation';
export * from './aviation/weather/types';

// Weather services - export with namespaced names to avoid conflicts
export {
  getCurrentWeather as getOpenWeatherMapCurrent,
  getAirportWeather as getOpenWeatherMapAirport,
} from './aviation/weather/openweathermap';

export {
  getCurrentWeather as getOpenMeteoCurrent,
  getDailyForecast as getOpenMeteoDaily,
  getHourlyForecast as getOpenMeteoHourly,
} from './aviation/weather/open-meteo';

// Aviation modules
export * as Weather from './aviation/weather';

// Integrations
export * as GoogleCalendar from './integrations/google';
=======
// Aviation data services
export {
  AirportDatabase,
  getAirportDatabase,
  searchAirports,
  getAirportByCode,
  findNearbyAirports,
} from './aviation/airports';
export type { Airport, AirportSearchOptions } from './aviation/airports';

<<<<<<< HEAD
// Aviation navigation utilities
export * from './aviation/navigation';
>>>>>>> feature/extract-navigation-utils
=======
// Aviation weather services
export * from './aviation/weather';
>>>>>>> feature/extract-weather-services
