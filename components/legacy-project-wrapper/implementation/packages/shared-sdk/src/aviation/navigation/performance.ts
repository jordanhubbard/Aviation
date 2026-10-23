/**
 * Aircraft Performance Altitude Calculations
 *
 * Pressure and density altitude drive takeoff/landing distance, climb rate and
 * true airspeed. Both are standard-day (ISA) approximations suitable for flight
 * planning, not for certified performance computation.
 *
 * @module @aviation/shared-sdk/aviation/navigation
 */

/** ISA sea-level standard pressure, inches of mercury. */
export const ISA_SEA_LEVEL_PRESSURE_INHG = 29.92;

/** ISA sea-level standard temperature, degrees Celsius. */
export const ISA_SEA_LEVEL_TEMP_C = 15;

/** ISA temperature lapse rate, degrees Celsius per foot. */
export const ISA_LAPSE_RATE_C_PER_FT = 0.0019812;

/**
 * Pressure altitude: indicated altitude corrected to the ISA standard datum.
 *
 * @param indicatedAltitudeFt - Indicated (or field elevation) altitude in feet
 * @param altimeterSettingInHg - Altimeter setting in inches of mercury
 * @returns Pressure altitude in feet
 *
 * @example
 * ```typescript
 * pressureAltitude(5000, 29.42); // 5500 ft
 * ```
 */
export function pressureAltitude(
  indicatedAltitudeFt: number,
  altimeterSettingInHg: number
): number {
  return indicatedAltitudeFt + (ISA_SEA_LEVEL_PRESSURE_INHG - altimeterSettingInHg) * 1000;
}

/**
 * ISA standard temperature at a given pressure altitude.
 *
 * @param pressureAltitudeFt - Pressure altitude in feet
 * @returns Standard temperature in degrees Celsius
 */
export function isaTemperature(pressureAltitudeFt: number): number {
  return ISA_SEA_LEVEL_TEMP_C - ISA_LAPSE_RATE_C_PER_FT * pressureAltitudeFt;
}

/**
 * Density altitude: pressure altitude corrected for non-standard temperature,
 * using the standard ~120 ft per degree Celsius deviation approximation.
 *
 * @param pressureAltitudeFt - Pressure altitude in feet
 * @param temperatureC - Outside air temperature in degrees Celsius
 * @returns Density altitude in feet
 *
 * @example
 * ```typescript
 * densityAltitude(5000, 30); // ~7,800 ft
 * ```
 */
export function densityAltitude(pressureAltitudeFt: number, temperatureC: number): number {
  return pressureAltitudeFt + 120 * (temperatureC - isaTemperature(pressureAltitudeFt));
}

/**
 * Density altitude computed directly from indicated altitude and altimeter setting.
 *
 * @param indicatedAltitudeFt - Indicated (or field elevation) altitude in feet
 * @param altimeterSettingInHg - Altimeter setting in inches of mercury
 * @param temperatureC - Outside air temperature in degrees Celsius
 * @returns Density altitude in feet
 */
export function densityAltitudeFromIndicated(
  indicatedAltitudeFt: number,
  altimeterSettingInHg: number,
  temperatureC: number
): number {
  return densityAltitude(
    pressureAltitude(indicatedAltitudeFt, altimeterSettingInHg),
    temperatureC
  );
}
