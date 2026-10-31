/**
 * Bearing and Heading Calculations for Aviation
 *
 * Provides bearing calculations for navigation between waypoints.
 */

import { assertValidCoordinate, toRadians, toDegrees } from "./distance.js";
import { calculateWindCorrection } from "./wind.js";

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
  lon2: number,
): number {
  assertValidCoordinate(lat1, lon1);
  assertValidCoordinate(lat2, lon2);
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
  lon2: number,
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
  magneticVariation: number,
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
  magneticVariation: number,
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
  windSpeed: number,
): number {
  return calculateWindCorrection(
    trueAirspeed,
    trueCourse,
    windDirection,
    windSpeed,
  ).wind_correction_angle;
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
  windSpeed: number,
): number {
  return calculateWindCorrection(
    trueAirspeed,
    trueCourse,
    windDirection,
    windSpeed,
  ).true_heading;
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
  windSpeed: number,
): number {
  return calculateWindCorrection(
    trueAirspeed,
    trueCourse,
    windDirection,
    windSpeed,
  ).ground_speed;
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
  if (!Number.isFinite(heading1) || !Number.isFinite(heading2)) {
    throw new RangeError("Headings must be finite");
  }
  return ((heading2 - heading1 + 540) % 360) - 180;
}

/**
 * Calculate the circular mean of headings.
 *
 * Optional weights must be finite, non-negative, and contain positive total
 * weight. An empty or directionally ambiguous sample has no circular mean.
 */
export function circularMeanHeading(
  headings: readonly number[],
  weights?: readonly number[],
): number {
  if (
    headings.length === 0 ||
    (weights && weights.length !== headings.length)
  ) {
    throw new RangeError("Headings must be non-empty and weights must match");
  }

  let sinSum = 0;
  let cosSum = 0;
  let weightSum = 0;
  headings.forEach((heading, index) => {
    const weight = weights?.[index] ?? 1;
    if (!Number.isFinite(heading) || !Number.isFinite(weight) || weight < 0) {
      throw new RangeError(
        "Headings and weights must be finite; weights must be non-negative",
      );
    }
    const radians = toRadians(heading);
    sinSum += weight * Math.sin(radians);
    cosSum += weight * Math.cos(radians);
    weightSum += weight;
  });

  if (
    weightSum <= 0 ||
    Math.hypot(sinSum, cosSum) <= Number.EPSILON * weightSum * 8
  ) {
    throw new RangeError("Circular mean is undefined for this sample");
  }
  const result = normalizeBearing(toDegrees(Math.atan2(sinSum, cosSum)));
  return Math.abs(result - 360) < 1e-12 || Math.abs(result) < 1e-12
    ? 0
    : result;
}

/** Return the two-digit runway designator nearest to a true heading. */
export function runwayDesignator(heading: number): string {
  if (!Number.isFinite(heading)) {
    throw new RangeError("Runway heading must be finite");
  }
  const number = Math.floor((normalizeBearing(heading) + 5) / 10) % 36;
  return String(number === 0 ? 36 : number).padStart(2, "0");
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
  rangeEnd: number,
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
