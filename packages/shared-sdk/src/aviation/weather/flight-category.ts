/**
 * Flight Category Calculations
 * 
 * Determines flight category (VFR, MVFR, IFR, LIFR) based on visibility and ceiling.
 * Provides recommendations and warnings for flight planning.
 * 
 * Extracted from flightplanner for shared use.
 */

export type FlightCategory = 'VFR' | 'MVFR' | 'IFR' | 'LIFR' | 'UNKNOWN';

export interface FlightCategoryThresholds {
  vfr_ceiling_ft: number;
  vfr_visibility_sm: number;
  mvfr_ceiling_ft: number;
  mvfr_visibility_sm: number;
  ifr_ceiling_ft: number;
  ifr_visibility_sm: number;
}

export const DEFAULT_THRESHOLDS: FlightCategoryThresholds = {
  vfr_ceiling_ft: 3000,
  vfr_visibility_sm: 5.0,
  mvfr_ceiling_ft: 1000,
  mvfr_visibility_sm: 3.0,
  ifr_ceiling_ft: 500,
  ifr_visibility_sm: 1.0,
};

/**
 * Determine flight category from visibility and ceiling
 * 
 * @param visibility_sm Visibility in statute miles
 * @param ceiling_ft Ceiling in feet AGL
 * @param thresholds Custom thresholds (optional)
 * @returns Flight category
 */
export function flightCategory(
  visibility_sm: number | null,
  ceiling_ft: number | null,
  thresholds: FlightCategoryThresholds = DEFAULT_THRESHOLDS
): FlightCategory {
  if (visibility_sm === null || ceiling_ft === null) {
    return 'UNKNOWN';
  }

  const vis = visibility_sm;
  const ceil = ceiling_ft;

  // LIFR: Low IFR
  if (vis < thresholds.ifr_visibility_sm || ceil < thresholds.ifr_ceiling_ft) {
    return 'LIFR';
  }

  // IFR: Instrument Flight Rules
  if (vis < thresholds.mvfr_visibility_sm || ceil < thresholds.mvfr_ceiling_ft) {
    return 'IFR';
  }

  // MVFR: Marginal VFR
  if (vis < thresholds.vfr_visibility_sm || ceil < thresholds.vfr_ceiling_ft) {
    return 'MVFR';
  }

  // VFR: Visual Flight Rules
  return 'VFR';
}

/**
 * Get recommendation text for a flight category
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
 * Generate warnings for weather conditions
 */
export function warningsForConditions(
  visibility_sm: number | null,
  ceiling_ft: number | null,
  wind_speed_kt: number | null
): string[] {
  const warnings: string[] = [];

  if (visibility_sm !== null && visibility_sm < 5) {
    warnings.push(`Reduced visibility (${visibility_sm.toFixed(1)} SM).`);
  }

  if (ceiling_ft !== null && ceiling_ft < 3000) {
    warnings.push(`Low ceiling (${Math.round(ceiling_ft)} ft).`);
  }

  if (wind_speed_kt !== null && wind_speed_kt >= 20) {
    warnings.push(`High winds (${Math.round(wind_speed_kt)} kt).`);
  }

  return warnings;
}

/**
 * Convert meters to statute miles
 */
export function metersToSM(meters: number | null): number | null {
  if (meters === null) return null;
  return meters / 1609.34;
}

/**
 * Estimate ceiling from cloud cover percentage
 * (Rough heuristic for when actual ceiling is unavailable)
 */
export function estimateCeilingFromCloudCover(cloudPercent: number | null): number | null {
  if (cloudPercent === null) return null;

  const pct = cloudPercent;

  if (pct >= 75) return 1500;
  if (pct >= 50) return 3000;
  if (pct >= 25) return 5000;
  return 10000;
}

/**
 * Estimate ceiling from cloud cover percentage
 * Alias for estimateCeilingFromCloudCover to match naming conventions
 * 
 * @param cloudCoverPercent Cloud cover percentage (0-100)
 * @returns Estimated ceiling in feet AGL, or null if no data
 */
export function estimateCeilingFtFromCloudcover(cloudCoverPercent: number | null): number | null {
  return estimateCeilingFromCloudCover(cloudCoverPercent);
}

/**
 * Get color code for flight category (for UI/visualization)
 * 
 * @param category Flight category
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

/**
 * Score an hour for flight planning (higher is better)
 */
export function scoreHour(
  category: FlightCategory,
  precipitation_mm: number | null,
  wind_speed_kt: number | null
): number {
  const categoryWeights: Record<FlightCategory, number> = {
    VFR: 4.0,
    MVFR: 3.0,
    IFR: 2.0,
    LIFR: 1.0,
    UNKNOWN: 0.5,
  };

  const catWeight = categoryWeights[category];
  const precip = precipitation_mm !== null ? Math.max(0, precipitation_mm) : 0;
  const wind = wind_speed_kt !== null ? Math.max(0, wind_speed_kt) : 0;

  // Higher score = better conditions
  return catWeight * 100 - precip * 15 - Math.max(0, wind - 10) * 2;
}

export interface DepartureWindow {
  start_time: string;
  end_time: string;
  score: number;
  flight_category: FlightCategory;
}

export interface HourlyData {
  time: string;
  visibility_m?: number | null;
  cloudcover_pct?: number | null;
  precipitation_mm?: number | null;
  wind_speed_kt?: number | null;
}

/**
 * Find best departure windows from hourly forecast
 */
export function bestDepartureWindows(
  hourly: HourlyData[],
  windowHours: number = 3,
  maxWindows: number = 3
): DepartureWindow[] {
  if (windowHours < 1 || hourly.length < windowHours) {
    return [];
  }

  const scored: Array<[number, DepartureWindow]> = [];

  for (let i = 0; i <= hourly.length - windowHours; i++) {
    const window = hourly.slice(i, i + windowHours);

    if (window.length === 0) continue;

    // Calculate means for the window
    const mean = (key: keyof HourlyData): number | null => {
      const vals = window
        .map(w => w[key])
        .filter((v): v is number => typeof v === 'number');
      
      if (vals.length === 0) return null;
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    };

    const vis_sm = metersToSM(mean('visibility_m'));
    const ceiling_ft = estimateCeilingFromCloudCover(mean('cloudcover_pct'));
    const precip_mm = mean('precipitation_mm');
    const wind_kt = mean('wind_speed_kt');

    const cat = flightCategory(vis_sm, ceiling_ft);
    const score = scoreHour(cat, precip_mm, wind_kt);

    scored.push([
      score,
      {
        start_time: window[0].time,
        end_time: window[window.length - 1].time,
        score: Math.round(score * 10) / 10,
        flight_category: cat,
      },
    ]);
  }

  // Sort by score descending and return top N
  scored.sort((a, b) => b[0] - a[0]);
  return scored.slice(0, maxWindows).map(([_, win]) => win);
}
