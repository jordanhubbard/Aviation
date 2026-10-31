/**
 * Wind correction and ground speed calculations
 *
 * Provides wind triangle calculations for determining ground speed,
 * true heading, and wind correction angles.
 *
 * @module aviation/navigation/wind
 */

import type { WindCorrectionResult } from "./types.js";

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
 * Normalize angle to 0-360 range
 */
function normalizeAngle(angle: number): number {
  let normalized = angle % 360;
  if (normalized < 0) {
    normalized += 360;
  }
  return normalized;
}

function validateWindInputs(
  trueAirspeed: number,
  trueCourse: number,
  windDirection: number,
  windSpeed: number,
): void {
  if (
    ![trueAirspeed, trueCourse, windDirection, windSpeed].every(Number.isFinite)
  ) {
    throw new RangeError("Wind-triangle inputs must be finite");
  }
  if (trueAirspeed <= 0 || windSpeed < 0) {
    throw new RangeError(
      "True airspeed must be positive and wind speed non-negative",
    );
  }
}

function validateComponentInputs(
  windDirection: number,
  windSpeed: number,
  course: number,
): void {
  if (
    ![windDirection, windSpeed, course].every(Number.isFinite) ||
    windSpeed < 0
  ) {
    throw new RangeError(
      "Wind direction/course must be finite and wind speed non-negative",
    );
  }
}

function validateVectorInputs(
  windEast: number,
  windNorth: number,
  course: number,
): void {
  if (![windEast, windNorth, course].every(Number.isFinite)) {
    throw new RangeError("Wind-vector components and course must be finite");
  }
}

/**
 * Calculate wind correction angle, ground speed, and true heading
 *
 * Solves the wind triangle to determine:
 * - Ground speed (actual speed over the ground)
 * - True heading (direction to fly to achieve desired course)
 * - Wind correction angle (angle to correct for wind drift)
 *
 * @param trueAirspeed - Aircraft's true airspeed in knots
 * @param trueCourse - Desired course over ground in degrees (0-360)
 * @param windDirection - Direction wind is FROM in degrees (0-360)
 * @param windSpeed - Wind speed in knots
 * @returns Wind correction result
 *
 * @example
 * ```typescript
 * // Flying 120 knots on course 090° with 20 knot wind from 360°
 * const result = calculateWindCorrection(120, 90, 360, 20);
 * console.log(`Ground speed: ${result.ground_speed.toFixed(1)} kts`);
 * console.log(`True heading: ${result.true_heading.toFixed(0)}°`);
 * console.log(`Wind correction: ${result.wind_correction_angle.toFixed(1)}°`);
 * ```
 */
export function calculateWindCorrection(
  trueAirspeed: number,
  trueCourse: number,
  windDirection: number,
  windSpeed: number,
): WindCorrectionResult {
  validateWindInputs(trueAirspeed, trueCourse, windDirection, windSpeed);
  const { headwind: headwindComponent, crosswind: crosswindComponent } =
    calculateWindComponents(windDirection, windSpeed, trueCourse);
  const crosswindRatio = crosswindComponent / trueAirspeed;
  if (Math.abs(crosswindRatio) > 1) {
    throw new RangeError(
      "Crosswind exceeds true airspeed; course cannot be maintained",
    );
  }

  const correctionRadians = Math.asin(crosswindRatio);
  const windCorrectionAngle = toDegrees(correctionRadians);
  const trueHeading = normalizeAngle(trueCourse + windCorrectionAngle);
  const groundSpeed =
    trueAirspeed * Math.cos(correctionRadians) - headwindComponent;
  if (groundSpeed <= 0) {
    throw new RangeError(
      "Wind prevents positive progress along the selected course",
    );
  }

  return {
    ground_speed: groundSpeed,
    true_heading: trueHeading,
    wind_correction_angle: windCorrectionAngle,
    headwind_component: headwindComponent,
    crosswind_component: crosswindComponent,
  };
}

/**
 * Calculate headwind and crosswind components
 *
 * Breaks down wind into components parallel and perpendicular to the course.
 *
 * @param windDirection - Direction wind is FROM in degrees (0-360)
 * @param windSpeed - Wind speed in knots
 * @param course - Course heading in degrees (0-360)
 * @returns Object with headwind and crosswind components
 *
 * @example
 * ```typescript
 * // 20 knot wind from 360° on runway 09 (090°)
 * const components = calculateWindComponents(360, 20, 90);
 * console.log(`Headwind: ${components.headwind.toFixed(1)} kts`);
 * console.log(`Crosswind: ${components.crosswind.toFixed(1)} kts`);
 * ```
 */
export function calculateWindComponents(
  windDirection: number,
  windSpeed: number,
  course: number,
): { headwind: number; crosswind: number } {
  validateComponentInputs(windDirection, windSpeed, course);
  const wdRad = toRadians(windDirection);
  const courseRad = toRadians(course);

  const headwind = windSpeed * Math.cos(wdRad - courseRad);
  const crosswind = windSpeed * Math.sin(wdRad - courseRad);

  return {
    headwind,
    crosswind,
  };
}

/**
 * Project an east/north wind velocity vector onto an aircraft course.
 *
 * Vector components describe where the air mass is moving. Returned headwind is
 * positive when the wind opposes the course; crosswind is positive when it comes
 * from the aircraft's right. Input and output speeds use the same unit.
 */
export function calculateWindComponentsFromVector(
  windEast: number,
  windNorth: number,
  course: number,
): { headwind: number; crosswind: number } {
  validateVectorInputs(windEast, windNorth, course);
  const courseRad = toRadians(course);
  const courseEast = Math.sin(courseRad);
  const courseNorth = Math.cos(courseRad);
  const rightEast = Math.cos(courseRad);
  const rightNorth = -Math.sin(courseRad);

  return {
    headwind: -(windEast * courseEast + windNorth * courseNorth),
    crosswind: -(windEast * rightEast + windNorth * rightNorth),
  };
}

/**
 * Calculate ground speed from true airspeed and wind
 *
 * @param trueAirspeed - Aircraft's true airspeed in knots
 * @param trueCourse - Desired course over ground in degrees
 * @param windDirection - Direction wind is FROM in degrees
 * @param windSpeed - Wind speed in knots
 * @returns Ground speed in knots
 *
 * @example
 * ```typescript
 * const gs = calculateGroundSpeed(120, 90, 360, 20);
 * console.log(`Ground speed: ${gs.toFixed(1)} kts`);
 * ```
 */
export function calculateGroundSpeed(
  trueAirspeed: number,
  trueCourse: number,
  windDirection: number,
  windSpeed: number,
): number {
  const result = calculateWindCorrection(
    trueAirspeed,
    trueCourse,
    windDirection,
    windSpeed,
  );
  return result.ground_speed;
}

/**
 * Calculate effective wind (wind felt by the aircraft)
 *
 * @param windDirection - Direction wind is FROM in degrees (0-360)
 * @param windSpeed - Wind speed in knots
 * @param heading - Aircraft heading in degrees (0-360)
 * @returns Effective wind speed and angle relative to aircraft
 *
 * @example
 * ```typescript
 * const effective = calculateEffectiveWind(360, 20, 90);
 * console.log(`Effective wind: ${effective.speed.toFixed(1)} kts from ${effective.relativeAngle.toFixed(0)}°`);
 * ```
 */
export function calculateEffectiveWind(
  windDirection: number,
  windSpeed: number,
  heading: number,
): { speed: number; relativeAngle: number } {
  // Relative angle of wind (from aircraft perspective)
  const relativeAngle = normalizeAngle(windDirection - heading);

  return {
    speed: windSpeed,
    relativeAngle,
  };
}

/**
 * Check if crosswind exceeds aircraft limits
 *
 * @param windDirection - Direction wind is FROM in degrees
 * @param windSpeed - Wind speed in knots
 * @param runwayHeading - Runway heading in degrees
 * @param maxCrosswind - Maximum demonstrated crosswind component in knots
 * @returns True if within limits, false if exceeds
 *
 * @example
 * ```typescript
 * // Check if 20 knot wind from 360° is acceptable for runway 09 (15 knot max)
 * const safe = isCrosswindWithinLimits(360, 20, 90, 15);
 * console.log(safe ? 'Safe' : 'Exceeds limits');
 * ```
 */
export function isCrosswindWithinLimits(
  windDirection: number,
  windSpeed: number,
  runwayHeading: number,
  maxCrosswind: number,
): boolean {
  const components = calculateWindComponents(
    windDirection,
    windSpeed,
    runwayHeading,
  );
  return Math.abs(components.crosswind) <= maxCrosswind;
}

/**
 * Calculate best runway based on wind
 *
 * @param windDirection - Direction wind is FROM in degrees
 * @param windSpeed - Wind speed in knots
 * @param runwayHeadings - Array of available runway headings
 * @returns Best runway heading and its wind components
 *
 * @example
 * ```typescript
 * // Find best runway for 360° wind
 * const runways = [90, 180, 270, 360]; // 09, 18, 27, 36
 * const best = calculateBestRunway(360, 20, runways);
 * console.log(`Use runway ${best.runway / 10}: ${best.headwind.toFixed(1)} kt headwind`);
 * ```
 */
export function calculateBestRunway(
  windDirection: number,
  windSpeed: number,
  runwayHeadings: number[],
): {
  runway: number;
  headwind: number;
  crosswind: number;
} {
  let bestRunway = runwayHeadings[0];
  let bestHeadwind = -Infinity;
  let bestCrosswind = 0;

  for (const runway of runwayHeadings) {
    const components = calculateWindComponents(
      windDirection,
      windSpeed,
      runway,
    );

    // Prefer runway with most headwind (least tailwind)
    if (components.headwind > bestHeadwind) {
      bestHeadwind = components.headwind;
      bestRunway = runway;
      bestCrosswind = components.crosswind;
    }
  }

  return {
    runway: bestRunway,
    headwind: bestHeadwind,
    crosswind: bestCrosswind,
  };
}
