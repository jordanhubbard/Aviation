/**
 * Weather services for aviation applications
 * 
 * Provides weather data from multiple sources:
 * - OpenWeatherMap (current weather)
 * - Open-Meteo (forecasts)
 * - AviationWeather.gov (METAR)
 * - Flight category calculations
 * 
 * @module aviation/weather
 */

// Export types
export * from './types.js';

// Export flight category calculations
export * from './flight-category.js';

// Export weather clients
export * from './openweathermap.js';
export * from './open-meteo.js';
export * from './metar.js';

// Export caching utilities
export * from './weather-cache.js';
