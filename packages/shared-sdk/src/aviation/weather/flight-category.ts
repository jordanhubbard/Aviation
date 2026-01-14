/**
 * Flight category calculations based on FAA criteria
 * 
 * Calculates VFR/MVFR/IFR/LIFR based on visibility and ceiling.
 * 
 * FAA Criteria:
 * - VFR: Visibility >= 5 SM, Ceiling >= 3000 ft
 * - MVFR: Visibility 3-5 SM, or Ceiling 1000-3000 ft
 * - IFR: Visibility 1-3 SM, or Ceiling 500-1000 ft
 * - LIFR: Visibility < 1 SM, or Ceiling < 500 ft
 * 
 * @module aviation/weather/flight-category
 */

import type { FlightCategory, FlightCategoryThresholds } from './types.js';
import { STANDARD_THRESHOLDS } from './types.js';

/**
 * Calculate flight category based on visibility and ceiling
 * 
 * @param visibility - Visibility in statute miles
 * @param ceiling - Ceiling in feet AGL (null if unlimited)
 * @param thresholds - Custom thresholds (optional, uses FAA standard if not provided)
 * @returns Flight category (VFR, MVFR, IFR, or LIFR)
 * 
 * @example
 * ```typescript
 * // Good VFR conditions
 * const category1 = calculateFlightCategory(10, 5000);
 * console.log(category1); // "VFR"
 * 
 * // Marginal VFR
 * const category2 = calculateFlightCategory(4, 2000);
 * console.log(category2); // "MVFR"
 * 
 * // IFR conditions
 * const category3 = calculateFlightCategory(2, 800);
 * console.log(category3); // "IFR"
 * 
 * // LIFR conditions
 * const category4 = calculateFlightCategory(0.5, 300);
 * console.log(category4); // "LIFR"
 * 
 * // Unlimited ceiling
 * const category5 = calculateFlightCategory(10, null);
 * console.log(category5); // "VFR"
 * ```
 */
export function calculateFlightCategory(
  visibility: number,
  ceiling: number | null,
  thresholds: FlightCategoryThresholds = STANDARD_THRESHOLDS
): FlightCategory {
  // Treat null ceiling as unlimited (very high)
  const effectiveCeiling = ceiling ?? 999999;

  // LIFR: Visibility < 1 SM OR Ceiling < 500 ft
  if (visibility < thresholds.ifr_visibility || effectiveCeiling < thresholds.ifr_ceiling) {
    return 'LIFR';
  }

  // IFR: Visibility 1-3 SM OR Ceiling 500-1000 ft
  if (visibility < thresholds.mvfr_visibility || effectiveCeiling < thresholds.mvfr_ceiling) {
    return 'IFR';
  }

  // MVFR: Visibility 3-5 SM OR Ceiling 1000-3000 ft
  if (visibility < thresholds.vfr_visibility || effectiveCeiling < thresholds.vfr_ceiling) {
    return 'MVFR';
  }

  // VFR: Visibility >= 5 SM AND Ceiling >= 3000 ft
  return 'VFR';
}

/**
 * Get flight category recommendation text
 * 
 * @param category - Flight category
 * @returns Recommendation text
 * 
 * @example
 * ```typescript
 * const rec = getFlightCategoryRecommendation('VFR');
 * console.log(rec); // "Visual flight rules - Good flying conditions"
 * ```
 */
export function getFlightCategoryRecommendation(category: FlightCategory): string {
  switch (category) {
    case 'VFR':
      return 'Visual flight rules - Good flying conditions';
    case 'MVFR':
      return 'Marginal VFR - Caution advised, monitor conditions closely';
    case 'IFR':
      return 'Instrument flight rules required - Poor visibility or low ceiling';
    case 'LIFR':
      return 'Low IFR - Very poor conditions, flight not recommended for VFR';
  }
}

/**
 * Get flight category color code (for UI display)
 * 
 * @param category - Flight category
 * @returns Color code (hex)
 * 
 * @example
 * ```typescript
 * const color = getFlightCategoryColor('VFR');
 * console.log(color); // "#00A000" (green)
 * ```
 */
export function getFlightCategoryColor(category: FlightCategory): string {
  switch (category) {
    case 'VFR':
      return '#00A000'; // Green
    case 'MVFR':
      return '#0080FF'; // Blue
    case 'IFR':
      return '#FF0000'; // Red
    case 'LIFR':
      return '#C000C0'; // Magenta
  }
}

/**
 * Determine if VFR flight is recommended
 * 
 * @param category - Flight category
 * @returns True if VFR or MVFR, false otherwise
 * 
 * @example
 * ```typescript
 * isVFRRecommended('VFR');   // true
 * isVFRRecommended('MVFR');  // true
 * isVFRRecommended('IFR');   // false
 * isVFRRecommended('LIFR');  // false
 * ```
 */
export function isVFRRecommended(category: FlightCategory): boolean {
  return category === 'VFR' || category === 'MVFR';
}

/**
 * Get weather warnings based on conditions
 * 
 * @param visibility - Visibility in statute miles
 * @param ceiling - Ceiling in feet AGL (null if unlimited)
 * @param windSpeed - Wind speed in knots
 * @param windGust - Wind gust speed in knots (optional)
 * @returns Array of warning messages
 * 
 * @example
 * ```typescript
 * const warnings = getWeatherWarnings(2, 800, 25, 35);
 * console.log(warnings);
 * // ["IFR conditions", "Strong winds (25 kts)", "Gusts present (35 kts)"]
 * ```
 */
export function getWeatherWarnings(
  visibility: number,
  ceiling: number | null,
  windSpeed: number,
  windGust?: number
): string[] {
  const warnings: string[] = [];

  // Flight category warnings
  const category = calculateFlightCategory(visibility, ceiling);
  if (category === 'IFR' || category === 'LIFR') {
    warnings.push(`${category} conditions`);
  }

  // Visibility warnings
  if (visibility < 1) {
    warnings.push('Very low visibility (< 1 SM)');
  } else if (visibility < 3) {
    warnings.push('Low visibility (< 3 SM)');
  }

  // Ceiling warnings
  if (ceiling !== null) {
    if (ceiling < 500) {
      warnings.push('Very low ceiling (< 500 ft)');
    } else if (ceiling < 1000) {
      warnings.push('Low ceiling (< 1000 ft)');
    }
  }

  // Wind warnings
  if (windSpeed >= 25) {
    warnings.push(`Strong winds (${windSpeed} kts)`);
  } else if (windSpeed >= 15) {
    warnings.push(`Moderate winds (${windSpeed} kts)`);
  }

  if (windGust !== undefined && windGust >= 25) {
    warnings.push(`Gusts present (${windGust} kts)`);
  }

  return warnings;
}
