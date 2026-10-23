/**
 * Navigation Utilities for Aviation
 * 
 * Comprehensive navigation calculations for flight planning and aviation applications.
 * All calculations use standard aviation units: nautical miles, knots, degrees.
 * 
 * @module @aviation/shared-sdk/aviation/navigation
 * 
 * @example
 * ```typescript
 * import { distanceNM, initialBearing, fuelRequired } from '@aviation/shared-sdk';
 * 
 * // Calculate distance and bearing from KSFO to KJFK
 * const dist = distanceNM(37.6213, -122.3790, 40.6413, -73.7781);
 * const bearing = initialBearing(37.6213, -122.3790, 40.6413, -73.7781);
 * 
 * // Calculate fuel required
 * const fuel = fuelRequired(dist, 450, 12); // 450 kts GS, 12 GPH
 * console.log(`${dist.toFixed(0)} NM at ${bearing.toFixed(0)}°`);
 * console.log(`Fuel: ${fuel.gallons.toFixed(1)} gal, Time: ${fuel.hours.toFixed(2)} hrs`);
 * ```
 */

// Distance calculations
export {
  EARTH_RADIUS,
  toRadians,
  toDegrees,
  haversineDistance,
  distanceNM,
  distanceKM,
  distanceMI,
  midpoint,
  destination,
  greatCircleRoute,
  convert,
} from './distance.js';

// Bearing and heading calculations
export {
  initialBearing,
  finalBearing,
  normalizeBearing,
  trueToMagnetic,
  magneticToTrue,
  windCorrectionAngle,
  trueHeading,
  groundSpeed,
  reciprocalHeading,
  headingDifference,
  isHeadingInRange,
} from './bearing.js';

// Coordinate utilities
export {
  type Coordinate,
  isValidLatitude,
  isValidLongitude,
  isValidCoordinate,
  normalizeLatitude,
  normalizeLongitude,
  normalizeCoordinate,
  parseDecimalDegrees,
  dmsToDecimal,
  decimalToDMS,
  formatDMS,
  formatCoordinate,
  boundingBox,
  isInBoundingBox,
} from './coordinates.js';

// Fuel calculations
export {
  FUEL_DENSITY,
  fuelConsumption,
  flightTime,
  fuelRequired,
  fuelRange,
  fuelEndurance,
  fuelWeight,
  fuelVolume,
  vfrFuelReserve,
  ifrFuelReserve,
  alternateFuelRequired,
  specificRange,
  specificEndurance,
} from './fuel.js';

// Time-speed-distance calculations
export {
  distance,
  speed,
  time,
  hoursToHM,
  hmToHours,
  formatTime,
  eta,
  timeEnRoute,
  averageGroundSpeed,
  speedConvert,
  iasToTas,
  tasToMach,
  machToTas,
} from './time-speed-distance.js';

// Shared navigation result types
export type {
  DistanceResult,
  BearingResult,
  TimeSpeedDistance,
  WindCorrectionResult,
  FuelCalculation,
  DistanceUnit,
  SpeedUnit,
} from './types.js';

// Wind triangle, crosswind limits and runway selection
export {
  calculateWindCorrection,
  calculateWindComponents,
  calculateGroundSpeed,
  calculateEffectiveWind,
  isCrosswindWithinLimits,
  calculateBestRunway,
} from './wind.js';

// Aircraft performance altitudes
export {
  pressureAltitude,
  densityAltitude,
  densityAltitudeFromIndicated,
  isaTemperature,
  ISA_SEA_LEVEL_PRESSURE_INHG,
  ISA_SEA_LEVEL_TEMP_C,
  ISA_LAPSE_RATE_C_PER_FT,
} from './performance.js';
