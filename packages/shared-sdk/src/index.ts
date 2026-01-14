export * from './ai';
export * from './service';

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
