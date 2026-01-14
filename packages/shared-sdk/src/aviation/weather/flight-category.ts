/**
 * Flight category determination and weather recommendations
 * 
 * Calculates flight categories (VFR, MVFR, IFR, LIFR) based on ceiling and visibility.
 * Provides recommendations and warnings for flight planning.
 */

import {
  FlightCategory,
  FlightCategoryThresholds,
  DEFAULT_THRESHOLDS,
  DepartureWindow,
  OpenMeteoHourlyForecast,
} from './types';

/**
 * Determine flight category from ceiling and visibility
 * 
 * @param visibility_sm - Visibility in statute miles (null = unknown)
 * @param ceiling_ft - Ceiling in feet AGL (null = unknown)
 * @param thresholds - Threshold values (uses FAA defaults if not provided)
 * @returns Flight category
 */
export function flightCategory(
  visibility_sm: number | null | undefined,
  ceiling_ft: number | null | undefined,
  thresholds: FlightCategoryThresholds = DEFAULT_THRESHOLDS
): FlightCategory {
  if (visibility_sm == null || ceiling_ft == null) {
    return 'UNKNOWN';
  }

  const vis = visibility_sm;
  const ceil = ceiling_ft;

  // LIFR: ceiling < 500ft OR visibility < 1sm
  if (vis < thresholds.ifr_visibility_sm || ceil < thresholds.ifr_ceiling_ft) {
    return 'LIFR';
  }

  // IFR: ceiling 500-1000ft OR visibility 1-3sm
  if (vis < thresholds.mvfr_visibility_sm || ceil < thresholds.mvfr_ceiling_ft) {
    return 'IFR';
  }

  // MVFR: ceiling 1000-3000ft OR visibility 3-5sm
  if (vis < thresholds.vfr_visibility_sm || ceil < thresholds.vfr_ceiling_ft) {
    return 'MVFR';
  }

  // VFR: ceiling >= 3000ft AND visibility >= 5sm
  return 'VFR';
}

/**
 * Get flight recommendation based on category
 * 
 * @param category - Flight category
 * @returns Human-readable recommendation
 */
export function recommendationForCategory(category: FlightCategory): string {
  switch (category) {
    case 'VFR':
      return 'VFR conditions. Routine VFR flight should be feasible.';
    case 'MVFR':
      return 'Marginal VFR conditions. Consider delaying, changing route, or filing IFR if qualified.';
    case 'IFR':
      return 'IFR conditions. VFR flight is not recommended.';
    case 'LIFR':
      return 'Low IFR conditions. VFR flight is not recommended.';
    case 'UNKNOWN':
      return 'Insufficient data to assess VFR/IFR suitability.';
  }
}

/**
 * Get warnings for weather conditions
 * 
 * @param visibility_sm - Visibility in statute miles
 * @param ceiling_ft - Ceiling in feet AGL
 * @param wind_speed_kt - Wind speed in knots
 * @returns Array of warning messages
 */
export function warningsForConditions(
  visibility_sm: number | null | undefined,
  ceiling_ft: number | null | undefined,
  wind_speed_kt: number | null | undefined
): string[] {
  const warnings: string[] = [];

  if (visibility_sm != null && visibility_sm < 5) {
    warnings.push(`Reduced visibility (${visibility_sm.toFixed(1)} SM).`);
  }

  if (ceiling_ft != null && ceiling_ft < 3000) {
    warnings.push(`Low ceiling (${Math.round(ceiling_ft)} ft).`);
  }

  if (wind_speed_kt != null && wind_speed_kt >= 20) {
    warnings.push(`High winds (${Math.round(wind_speed_kt)} kt).`);
  }

  return warnings;
}

/**
 * Convert meters to statute miles
 */
function metersToSm(meters: number | null | undefined): number | null {
  if (meters == null) return null;
  try {
    return meters / 1609.34;
  } catch {
    return null;
  }
}

/**
 * Estimate ceiling from cloud cover percentage (rough heuristic)
 * 
 * @param cloud_pct - Cloud cover percentage (0-100)
 * @returns Estimated ceiling in feet
 */
export function estimateCeilingFtFromCloudcover(
  cloud_pct: number | null | undefined
): number | null {
  if (cloud_pct == null) return null;

  try {
    const pct = cloud_pct;

    // Very rough heuristic
    if (pct >= 75) return 1500;
    if (pct >= 50) return 3000;
    if (pct >= 25) return 5000;
    return 10000;
  } catch {
    return null;
  }
}

/**
 * Score an hour of weather for flight planning
 * Higher scores are better flying conditions.
 * 
 * @param category - Flight category
 * @param precipitation_mm - Precipitation in millimeters
 * @param wind_speed_kt - Wind speed in knots
 * @returns Weather score (higher is better)
 */
export function scoreHour(
  category: FlightCategory,
  precipitation_mm: number | null | undefined,
  wind_speed_kt: number | null | undefined
): number {
  const catWeight: Record<FlightCategory, number> = {
    VFR: 4.0,
    MVFR: 3.0,
    IFR: 2.0,
    LIFR: 1.0,
    UNKNOWN: 0.5,
  };

  const precip = Math.max(0, precipitation_mm || 0);
  const wind = Math.max(0, wind_speed_kt || 0);

  // Higher is better
  return catWeight[category] * 100.0 - precip * 15.0 - Math.max(0, wind - 10.0) * 2.0;
}

/**
 * Find best departure time windows from hourly forecast
 * 
 * @param hourly - Array of hourly forecasts
 * @param windowHours - Size of departure window in hours
 * @param maxWindows - Maximum number of windows to return
 * @returns Array of best departure windows, sorted by score
 */
export function bestDepartureWindows(
  hourly: OpenMeteoHourlyForecast[],
  windowHours: number = 3,
  maxWindows: number = 3
): DepartureWindow[] {
  if (windowHours < 1 || hourly.length < windowHours) {
    return [];
  }

  interface ScoredWindow {
    score: number;
    window: DepartureWindow;
  }

  const scored: ScoredWindow[] = [];

  // Slide window across hourly data
  for (let i = 0; i <= hourly.length - windowHours; i++) {
    const window = hourly.slice(i, i + windowHours);

    // Calculate means for the window
    const mean = (key: keyof OpenMeteoHourlyForecast): number | null => {
      const values = window
        .map(w => w[key])
        .filter(v => typeof v === 'number') as number[];
      if (values.length === 0) return null;
      return values.reduce((a, b) => a + b, 0) / values.length;
    };

    const vis_sm = metersToSm(mean('visibility_m'));
    const ceiling_ft = estimateCeilingFtFromCloudcover(mean('cloudcover_pct'));
    const precip_mm = mean('precipitation_mm');
    const wind_kt = mean('wind_speed_kt');

    const cat = flightCategory(vis_sm, ceiling_ft);
    const score = scoreHour(cat, precip_mm, wind_kt);

    scored.push({
      score,
      window: {
        start_time: window[0].time,
        end_time: window[window.length - 1].time,
        score: Math.round(score * 10) / 10,
        flight_category: cat,
      },
    });
  }

  // Sort by score (descending) and return top windows
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxWindows).map(s => s.window);
}

/**
 * Get color code for flight category (for UI display)
 * 
 * @param category - Flight category
 * @returns Hex color code
 */
export function colorForCategory(category: FlightCategory): string {
  switch (category) {
    case 'VFR':
      return '#00ff00'; // Green
    case 'MVFR':
      return '#0000ff'; // Blue
    case 'IFR':
      return '#ff0000'; // Red
    case 'LIFR':
      return '#ff00ff'; // Magenta
    case 'UNKNOWN':
      return '#808080'; // Gray
  }
}
