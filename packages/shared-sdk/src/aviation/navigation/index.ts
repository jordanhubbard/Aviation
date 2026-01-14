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
} from './distance';

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
} from './bearing';

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
} from './coordinates';

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
} from './fuel';

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
} from './time-speed-distance';
