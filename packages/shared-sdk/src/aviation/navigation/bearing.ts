/**
 * Bearing calculations for aviation navigation
 * 
 * Provides true bearing, magnetic bearing, and related calculations
 * for navigation between coordinates.
 * 
 * @module aviation/navigation/bearing
 */

import type { Coordinate, BearingResult } from './types.js';

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Convert radians to degrees
 */
function toDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

/**
 * Normalize bearing to 0-360 range
 */
function normalizeBearing(bearing: number): number {
  let normalized = bearing % 360;
  if (normalized < 0) {
    normalized += 360;
  }
  return normalized;
}

/**
 * Calculate initial bearing from one point to another
 * 
 * @param lat1 - Starting latitude in degrees
 * @param lon1 - Starting longitude in degrees
 * @param lat2 - Ending latitude in degrees
 * @param lon2 - Ending longitude in degrees
 * @returns Initial true bearing in degrees (0-360)
 * 
 * @example
 * ```typescript
 * // Bearing from San Francisco to Los Angeles
 * const bearing = calculateInitialBearing(37.7749, -122.4194, 34.0522, -118.2437);
 * console.log(bearing); // ~133° (southeast)
 * ```
 */
export function calculateInitialBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);
  const dLon = toRadians(lon2 - lon1);
  
  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
            Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  
  const bearingRad = Math.atan2(y, x);
  const bearingDeg = toDegrees(bearingRad);
  
  return normalizeBearing(bearingDeg);
}

/**
 * Calculate final bearing (arrival bearing) from one point to another
 * 
 * The final bearing is different from the initial bearing on long routes
 * due to the Earth's curvature.
 * 
 * @param lat1 - Starting latitude in degrees
 * @param lon1 - Starting longitude in degrees
 * @param lat2 - Ending latitude in degrees
 * @param lon2 - Ending longitude in degrees
 * @returns Final true bearing in degrees (0-360)
 * 
 * @example
 * ```typescript
 * // Final bearing arriving at Los Angeles from San Francisco
 * const bearing = calculateFinalBearing(37.7749, -122.4194, 34.0522, -118.2437);
 * console.log(bearing); // ~135° (slightly different from initial)
 * ```
 */
export function calculateFinalBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  // Final bearing is the reverse of the initial bearing from destination to origin
  const reverseBearing = calculateInitialBearing(lat2, lon2, lat1, lon1);
  return normalizeBearing(reverseBearing + 180);
}

/**
 * Calculate both initial and final bearings
 * 
 * @param lat1 - Starting latitude in degrees
 * @param lon1 - Starting longitude in degrees
 * @param lat2 - Ending latitude in degrees
 * @param lon2 - Ending longitude in degrees
 * @param magneticVariation - Optional magnetic variation in degrees (+ for East, - for West)
 * @returns Bearing result with initial and final bearings
 * 
 * @example
 * ```typescript
 * // Get both bearings for a route
 * const bearings = calculateBearing(37.7749, -122.4194, 34.0522, -118.2437);
 * console.log(`Initial: ${bearings.initial_bearing}°`);
 * console.log(`Final: ${bearings.final_bearing}°`);
 * 
 * // With magnetic variation (13° East at SFO)
 * const magBearings = calculateBearing(37.7749, -122.4194, 34.0522, -118.2437, 13);
 * console.log(`Magnetic variation: ${magBearings.magnetic_variation}°`);
 * ```
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  magneticVariation?: number
): BearingResult {
  return {
    initial_bearing: calculateInitialBearing(lat1, lon1, lat2, lon2),
    final_bearing: calculateFinalBearing(lat1, lon1, lat2, lon2),
    magnetic_variation: magneticVariation
  };
}

/**
 * Calculate bearing between two coordinates
 * 
 * @param from - Starting coordinate
 * @param to - Ending coordinate
 * @param magneticVariation - Optional magnetic variation in degrees
 * @returns Bearing result
 * 
 * @example
 * ```typescript
 * const sfo = { latitude: 37.7749, longitude: -122.4194 };
 * const lax = { latitude: 34.0522, longitude: -118.2437 };
 * const bearing = calculateBearingFromCoordinates(sfo, lax);
 * ```
 */
export function calculateBearingFromCoordinates(
  from: Coordinate,
  to: Coordinate,
  magneticVariation?: number
): BearingResult {
  return calculateBearing(
    from.latitude,
    from.longitude,
    to.latitude,
    to.longitude,
    magneticVariation
  );
}

/**
 * Convert true bearing to magnetic bearing
 * 
 * @param trueBearing - True bearing in degrees (0-360)
 * @param magneticVariation - Magnetic variation in degrees (+ for East, - for West)
 * @returns Magnetic bearing in degrees (0-360)
 * 
 * @example
 * ```typescript
 * // At SFO, magnetic variation is ~13° East
 * const trueBearing = 133;
 * const magBearing = trueToMagnetic(trueBearing, 13);
 * console.log(magBearing); // ~120° magnetic
 * ```
 */
export function trueToMagnetic(trueBearing: number, magneticVariation: number): number {
  return normalizeBearing(trueBearing - magneticVariation);
}

/**
 * Convert magnetic bearing to true bearing
 * 
 * @param magneticBearing - Magnetic bearing in degrees (0-360)
 * @param magneticVariation - Magnetic variation in degrees (+ for East, - for West)
 * @returns True bearing in degrees (0-360)
 * 
 * @example
 * ```typescript
 * // At SFO, magnetic variation is ~13° East
 * const magBearing = 120;
 * const trueBearing = magneticToTrue(magBearing, 13);
 * console.log(trueBearing); // ~133° true
 * ```
 */
export function magneticToTrue(magneticBearing: number, magneticVariation: number): number {
  return normalizeBearing(magneticBearing + magneticVariation);
}

/**
 * Calculate the reciprocal (opposite) bearing
 * 
 * @param bearing - Original bearing in degrees (0-360)
 * @returns Reciprocal bearing in degrees (0-360)
 * 
 * @example
 * ```typescript
 * const outbound = 90; // East
 * const inbound = calculateReciprocalBearing(outbound);
 * console.log(inbound); // 270° (West)
 * ```
 */
export function calculateReciprocalBearing(bearing: number): number {
  return normalizeBearing(bearing + 180);
}

/**
 * Calculate cross-track error (perpendicular distance from course)
 * 
 * Returns the perpendicular distance from a point to a great circle path
 * between two other points. Useful for determining how far off course
 * an aircraft is.
 * 
 * @param pathStart - Start of the intended path
 * @param pathEnd - End of the intended path
 * @param currentPosition - Current position
 * @returns Cross-track distance in nautical miles (positive = right, negative = left)
 * 
 * @example
 * ```typescript
 * const sfo = { latitude: 37.619, longitude: -122.375 };
 * const lax = { latitude: 33.942, longitude: -118.408 };
 * const current = { latitude: 36.5, longitude: -121.0 };
 * 
 * const xte = calculateCrossTrackError(sfo, lax, current);
 * console.log(`Off course by ${Math.abs(xte).toFixed(1)} nm`);
 * ```
 */
export function calculateCrossTrackError(
  pathStart: Coordinate,
  pathEnd: Coordinate,
  currentPosition: Coordinate
): number {
  const EARTH_RADIUS_NM = 3440.065;
  
  const lat1 = toRadians(pathStart.latitude);
  const lon1 = toRadians(pathStart.longitude);
  const lat2 = toRadians(pathEnd.latitude);
  const lon2 = toRadians(pathEnd.longitude);
  const lat3 = toRadians(currentPosition.latitude);
  const lon3 = toRadians(currentPosition.longitude);
  
  // Angular distance from start to current position
  const delta13 = 2 * Math.asin(Math.sqrt(
    Math.sin((lat3 - lat1) / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat3) * Math.sin((lon3 - lon1) / 2) ** 2
  ));
  
  // Initial bearing from start to end
  const bearing12 = toRadians(calculateInitialBearing(
    pathStart.latitude,
    pathStart.longitude,
    pathEnd.latitude,
    pathEnd.longitude
  ));
  
  // Initial bearing from start to current
  const bearing13 = toRadians(calculateInitialBearing(
    pathStart.latitude,
    pathStart.longitude,
    currentPosition.latitude,
    currentPosition.longitude
  ));
  
  // Cross-track distance
  const xte = Math.asin(Math.sin(delta13) * Math.sin(bearing13 - bearing12)) * EARTH_RADIUS_NM;
  
  return xte;
}

/**
 * Calculate along-track distance (distance along the course)
 * 
 * Returns the distance along the great circle path from the start point
 * to the point that is perpendicular to the current position.
 * 
 * @param pathStart - Start of the intended path
 * @param pathEnd - End of the intended path
 * @param currentPosition - Current position
 * @returns Along-track distance in nautical miles
 * 
 * @example
 * ```typescript
 * const sfo = { latitude: 37.619, longitude: -122.375 };
 * const lax = { latitude: 33.942, longitude: -118.408 };
 * const current = { latitude: 36.5, longitude: -121.0 };
 * 
 * const atd = calculateAlongTrackDistance(sfo, lax, current);
 * console.log(`${atd.toFixed(1)} nm along the route`);
 * ```
 */
export function calculateAlongTrackDistance(
  pathStart: Coordinate,
  pathEnd: Coordinate,
  currentPosition: Coordinate
): number {
  const EARTH_RADIUS_NM = 3440.065;
  
  const lat1 = toRadians(pathStart.latitude);
  const lon1 = toRadians(pathStart.longitude);
  const lat3 = toRadians(currentPosition.latitude);
  const lon3 = toRadians(currentPosition.longitude);
  
  // Angular distance from start to current position
  const delta13 = 2 * Math.asin(Math.sqrt(
    Math.sin((lat3 - lat1) / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat3) * Math.sin((lon3 - lon1) / 2) ** 2
  ));
  
  // Cross-track distance in radians
  const xte = calculateCrossTrackError(pathStart, pathEnd, currentPosition) / EARTH_RADIUS_NM;
  
  // Along-track distance
  const atd = Math.acos(Math.cos(delta13) / Math.cos(xte)) * EARTH_RADIUS_NM;
  
  return atd;
}
