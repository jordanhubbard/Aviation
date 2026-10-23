/**
 * Aviation datetime utilities
 * 
 * Provides comprehensive date/time handling for aviation applications including
 * UTC/Zulu conversions, timezone management, and aviation-specific formatting.
 * 
 * @module datetime
 */

export {
  // Current time
  utcNow,
  
  // UTC conversions
  toUtc,
  
  // Zulu time
  toZulu,
  fromZulu,
  
  // Formatting
  formatDateTime,
  formatFlightTime,
  parseFlightTime,
  
  // Sunrise/sunset
  calculateSunriseSunset,
  isNight,
  
  // Flight time calculations
  addFlightTime,
  getTimeDifference,
} from './utils.js';
