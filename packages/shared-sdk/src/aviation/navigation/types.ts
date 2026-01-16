/**
 * Navigation types for aviation applications
 * 
 * Provides type definitions for navigation calculations including
 * distance, bearing, coordinates, and time/speed/distance computations.
 * 
 * @module aviation/navigation/types
 */

/**
 * Geographic coordinate
 */
export interface Coordinate {
  /** Latitude in decimal degrees (-90 to 90) */
  latitude: number;
  
  /** Longitude in decimal degrees (-180 to 180) */
  longitude: number;
  
  /** Altitude in feet MSL (optional) */
  altitude?: number;
}

/**
 * Distance result in multiple units
 */
export interface DistanceResult {
  /** Distance in nautical miles */
  nautical_miles: number;
  
  /** Distance in statute miles */
  statute_miles: number;
  
  /** Distance in kilometers */
  kilometers: number;
}

/**
 * Bearing result
 */
export interface BearingResult {
  /** Initial bearing in degrees (0-360) */
  initial_bearing: number;
  
  /** Final bearing in degrees (0-360) */
  final_bearing: number;
  
  /** Magnetic variation in degrees (optional) */
  magnetic_variation?: number;
}

/**
 * Time/Speed/Distance problem
 * Provide any 2 values to solve for the 3rd
 */
export interface TimeSpeedDistance {
  /** Time in hours (optional) */
  time_hours?: number;
  
  /** Speed in knots (optional) */
  speed_knots?: number;
  
  /** Distance in nautical miles (optional) */
  distance_nm?: number;
}

/**
 * Wind correction result
 */
export interface WindCorrectionResult {
  /** Ground speed in knots */
  ground_speed: number;
  
  /** True heading in degrees (0-360) */
  true_heading: number;
  
  /** Wind correction angle in degrees (positive = right) */
  wind_correction_angle: number;
  
  /** Headwind component in knots (positive = headwind) */
  headwind_component: number;
  
  /** Crosswind component in knots (positive = right) */
  crosswind_component: number;
}

/**
 * Fuel calculation result
 */
export interface FuelCalculation {
  /** Total fuel required in gallons */
  gallons: number;
  
  /** Total fuel required in pounds */
  pounds: number;
  
  /** Total fuel required in liters */
  liters: number;
  
  /** Flight time in hours */
  time_hours: number;
  
  /** Reserve fuel in gallons */
  reserve_gallons: number;
}

/**
 * Distance unit types
 */
export type DistanceUnit = 'nm' | 'sm' | 'km' | 'meters';

/**
 * Speed unit types
 */
export type SpeedUnit = 'knots' | 'mph' | 'kmh';

/**
 * Earth radius constants
 */
export const EARTH_RADIUS = {
  /** Nautical miles */
  NM: 3440.065,
  
  /** Statute miles */
  SM: 3958.8,
  
  /** Kilometers */
  KM: 6371.0,
  
  /** Meters */
  METERS: 6371000
} as const;

/**
 * Conversion constants
 */
export const CONVERSIONS = {
  /** Nautical miles to statute miles */
  NM_TO_SM: 1.15078,
  
  /** Nautical miles to kilometers */
  NM_TO_KM: 1.852,
  
  /** Statute miles to nautical miles */
  SM_TO_NM: 0.868976,
  
  /** Kilometers to nautical miles */
  KM_TO_NM: 0.539957,
  
  /** Knots to MPH */
  KNOTS_TO_MPH: 1.15078,
  
  /** Knots to KM/H */
  KNOTS_TO_KMH: 1.852,
  
  /** MPH to knots */
  MPH_TO_KNOTS: 0.868976,
  
  /** KM/H to knots */
  KMH_TO_KNOTS: 0.539957,
  
  /** Gallons to pounds (100LL fuel) */
  GALLONS_TO_POUNDS_100LL: 6.0,
  
  /** Gallons to liters */
  GALLONS_TO_LITERS: 3.78541,
  
  /** Liters to gallons */
  LITERS_TO_GALLONS: 0.264172
} as const;
