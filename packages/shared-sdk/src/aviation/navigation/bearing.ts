/**
 * Bearing and Heading Calculations for Aviation
 * 
 * Provides bearing calculations for navigation between waypoints.
 */

import { toRadians, toDegrees } from './distance';

/**
 * Calculate initial bearing (forward azimuth) from point 1 to point 2
 * 
 * @param lat1 Starting latitude in degrees
 * @param lon1 Starting longitude in degrees
 * @param lat2 Ending latitude in degrees
 * @param lon2 Ending longitude in degrees
 * @returns Initial bearing in degrees (0-360)
 * 
 * @example
 * ```typescript
 * // Bearing from KSFO to KJFK
 * const bearing = initialBearing(37.6213, -122.3790, 40.6413, -73.7781);
 * console.log(`Heading: ${Math.round(bearing)}°`); // ~79°
 * ```
 */
export function initialBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaLambda = toRadians(lon2 - lon1);
  
  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  
  const theta = Math.atan2(y, x);
  
  return (toDegrees(theta) + 360) % 360;
}

/**
 * Calculate final bearing (back azimuth) at destination
 * 
 * @param lat1 Starting latitude in degrees
 * @param lon1 Starting longitude in degrees
 * @param lat2 Ending latitude in degrees
 * @param lon2 Ending longitude in degrees
 * @returns Final bearing in degrees (0-360)
 */
export function finalBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  // Final bearing at destination is the initial bearing from destination to start + 180°
  return (initialBearing(lat2, lon2, lat1, lon1) + 180) % 360;
}

/**
 * Normalize bearing to 0-360 range
 */
export function normalizeBearing(bearing: number): number {
  const normalized = bearing % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

/**
 * Convert true heading to magnetic heading
 * 
 * @param trueHeading True heading in degrees
 * @param magneticVariation Magnetic variation in degrees (+ East, - West)
 * @returns Magnetic heading in degrees
 */
export function trueToMagnetic(
  trueHeading: number,
  magneticVariation: number
): number {
  return normalizeBearing(trueHeading - magneticVariation);
}

/**
 * Convert magnetic heading to true heading
 * 
 * @param magneticHeading Magnetic heading in degrees
 * @param magneticVariation Magnetic variation in degrees (+ East, - West)
 * @returns True heading in degrees
 */
export function magneticToTrue(
  magneticHeading: number,
  magneticVariation: number
): number {
  return normalizeBearing(magneticHeading + magneticVariation);
}

/**
 * Calculate wind correction angle (WCA)
 * 
 * @param trueAirspeed True airspeed in knots
 * @param trueCourse True course in degrees
 * @param windDirection Wind direction (where wind is from) in degrees
 * @param windSpeed Wind speed in knots
 * @returns Wind correction angle in degrees (+ right, - left)
 */
export function windCorrectionAngle(
  trueAirspeed: number,
  trueCourse: number,
  windDirection: number,
  windSpeed: number
): number {
  const courseRad = toRadians(trueCourse);
  const windDirRad = toRadians(windDirection);
  
  // Calculate crosswind component
  const crosswind = windSpeed * Math.sin(windDirRad - courseRad);
  
  // Calculate WCA using trigonometry
  const wca = Math.asin(crosswind / trueAirspeed);
  
  return toDegrees(wca);
}

/**
 * Calculate true heading with wind correction
 * 
 * @param trueCourse Desired true course in degrees
 * @param trueAirspeed True airspeed in knots
 * @param windDirection Wind direction (where wind is from) in degrees
 * @param windSpeed Wind speed in knots
 * @returns True heading to fly in degrees
 */
export function trueHeading(
  trueCourse: number,
  trueAirspeed: number,
  windDirection: number,
  windSpeed: number
): number {
  const wca = windCorrectionAngle(trueAirspeed, trueCourse, windDirection, windSpeed);
  return normalizeBearing(trueCourse + wca);
}

/**
 * Calculate ground speed considering wind
 * 
 * @param trueAirspeed True airspeed in knots
 * @param trueCourse True course in degrees
 * @param windDirection Wind direction (where wind is from) in degrees
 * @param windSpeed Wind speed in knots
 * @returns Ground speed in knots
 */
export function groundSpeed(
  trueAirspeed: number,
  trueCourse: number,
  windDirection: number,
  windSpeed: number
): number {
  const courseRad = toRadians(trueCourse);
  const windDirRad = toRadians(windDirection);
  
  // Calculate headwind and crosswind components
  const headwind = windSpeed * Math.cos(windDirRad - courseRad);
  const crosswind = windSpeed * Math.sin(windDirRad - courseRad);
  
  // Ground speed using Pythagorean theorem
  const gs = Math.sqrt(
    Math.pow(trueAirspeed + headwind, 2) + Math.pow(crosswind, 2)
  );
  
  return gs;
}

/**
 * Calculate reciprocal heading (opposite direction)
 * 
 * @param heading Heading in degrees
 * @returns Reciprocal heading in degrees
 */
export function reciprocalHeading(heading: number): number {
  return normalizeBearing(heading + 180);
}

/**
 * Calculate difference between two headings (shortest angle)
 * 
 * @param heading1 First heading in degrees
 * @param heading2 Second heading in degrees
 * @returns Difference in degrees (-180 to 180)
 */
export function headingDifference(heading1: number, heading2: number): number {
  let diff = heading2 - heading1;
  
  // Normalize to -180 to 180
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  
  return diff;
}

/**
 * Determine if heading is within a range
 * 
 * @param heading Heading to check
 * @param rangeStart Start of range in degrees
 * @param rangeEnd End of range in degrees
 * @returns True if heading is within range
 */
export function isHeadingInRange(
  heading: number,
  rangeStart: number,
  rangeEnd: number
): boolean {
  const h = normalizeBearing(heading);
  const start = normalizeBearing(rangeStart);
  const end = normalizeBearing(rangeEnd);
  
  if (start <= end) {
    return h >= start && h <= end;
  } else {
    // Range crosses 360/0
    return h >= start || h <= end;
  }
}
