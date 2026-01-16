/**
 * Time, speed, distance, and fuel calculations
 * 
 * Provides utilities for solving time/speed/distance problems
 * and calculating fuel requirements for flights.
 * 
 * @module aviation/navigation/calculations
 */

import type { TimeSpeedDistance, FuelCalculation } from './types.js';
import { CONVERSIONS } from './types.js';

/**
 * Solve time/speed/distance problem
 * 
 * Given any two of time, speed, or distance, calculates the third.
 * Uses the formula: Distance = Speed × Time
 * 
 * @param tsd - Object with any 2 of: time_hours, speed_knots, distance_nm
 * @returns Complete TSD object with all three values
 * @throws Error if fewer than 2 values provided or if invalid values
 * 
 * @example
 * ```typescript
 * // Given distance and speed, find time
 * const result = solveTimeSpeedDistance({ distance_nm: 300, speed_knots: 120 });
 * console.log(`Flight time: ${result.time_hours} hours`); // 2.5 hours
 * 
 * // Given time and speed, find distance
 * const result2 = solveTimeSpeedDistance({ time_hours: 2, speed_knots: 150 });
 * console.log(`Distance: ${result2.distance_nm} nm`); // 300 nm
 * 
 * // Given time and distance, find speed
 * const result3 = solveTimeSpeedDistance({ time_hours: 1.5, distance_nm: 180 });
 * console.log(`Speed: ${result3.speed_knots} kts`); // 120 knots
 * ```
 */
export function solveTimeSpeedDistance(tsd: TimeSpeedDistance): Required<TimeSpeedDistance> {
  const { time_hours, speed_knots, distance_nm } = tsd;
  
  // Count how many values we have
  const providedCount = [time_hours, speed_knots, distance_nm].filter(v => v !== undefined).length;
  
  if (providedCount < 2) {
    throw new Error('Must provide at least 2 of: time_hours, speed_knots, distance_nm');
  }
  
  // If all three provided, validate they're consistent
  if (providedCount === 3) {
    const calculated_distance = speed_knots! * time_hours!;
    if (Math.abs(calculated_distance - distance_nm!) > 0.01) {
      throw new Error('Provided values are inconsistent: Distance ≠ Speed × Time');
    }
    return { time_hours: time_hours!, speed_knots: speed_knots!, distance_nm: distance_nm! };
  }
  
  // Solve for the missing value
  if (time_hours !== undefined && speed_knots !== undefined) {
    // Calculate distance
    return {
      time_hours,
      speed_knots,
      distance_nm: speed_knots * time_hours
    };
  } else if (time_hours !== undefined && distance_nm !== undefined) {
    // Calculate speed
    if (time_hours === 0) {
      throw new Error('Cannot divide by zero time');
    }
    return {
      time_hours,
      speed_knots: distance_nm / time_hours,
      distance_nm
    };
  } else if (speed_knots !== undefined && distance_nm !== undefined) {
    // Calculate time
    if (speed_knots === 0) {
      throw new Error('Cannot divide by zero speed');
    }
    return {
      time_hours: distance_nm / speed_knots,
      speed_knots,
      distance_nm
    };
  }
  
  throw new Error('Invalid combination of values provided');
}

/**
 * Calculate flight time
 * 
 * @param distance_nm - Distance in nautical miles
 * @param speed_knots - Speed in knots
 * @returns Flight time in hours
 * 
 * @example
 * ```typescript
 * const time = calculateFlightTime(300, 120);
 * console.log(`${time} hours`); // 2.5 hours
 * console.log(`${formatTime(time)}`); // "2h 30m"
 * ```
 */
export function calculateFlightTime(distance_nm: number, speed_knots: number): number {
  if (speed_knots === 0) {
    throw new Error('Speed cannot be zero');
  }
  return distance_nm / speed_knots;
}

/**
 * Calculate distance traveled given speed and time
 * 
 * @param speed_knots - Speed in knots
 * @param time_hours - Time in hours
 * @returns Distance in nautical miles
 * 
 * @example
 * ```typescript
 * const distance = calculateDistanceFromSpeed(120, 2.5);
 * console.log(`${distance} nm`); // 300 nm
 * ```
 */
export function calculateDistanceFromSpeed(speed_knots: number, time_hours: number): number {
  return speed_knots * time_hours;
}

/**
 * Calculate required speed
 * 
 * @param distance_nm - Distance in nautical miles
 * @param time_hours - Available time in hours
 * @returns Required speed in knots
 * 
 * @example
 * ```typescript
 * const speed = calculateRequiredSpeed(300, 2.5);
 * console.log(`${speed} kts`); // 120 knots
 * ```
 */
export function calculateRequiredSpeed(distance_nm: number, time_hours: number): number {
  if (time_hours === 0) {
    throw new Error('Time cannot be zero');
  }
  return distance_nm / time_hours;
}

/**
 * Format time in hours to human-readable string
 * 
 * @param hours - Time in hours (can be decimal)
 * @returns Formatted string like "2h 30m"
 * 
 * @example
 * ```typescript
 * console.log(formatTime(2.5));   // "2h 30m"
 * console.log(formatTime(0.75));  // "45m"
 * console.log(formatTime(1.25));  // "1h 15m"
 * ```
 */
export function formatTime(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  
  if (h === 0) {
    return `${m}m`;
  } else if (m === 0) {
    return `${h}h`;
  } else {
    return `${h}h ${m}m`;
  }
}

/**
 * Calculate fuel required for a flight
 * 
 * @param distance_nm - Distance in nautical miles
 * @param groundSpeed_knots - Ground speed in knots
 * @param fuelBurnRate_gph - Fuel burn rate in gallons per hour
 * @param reserveHours - Reserve fuel in hours (default: 0.5 = 30 minutes)
 * @param fuelWeight_lbs_per_gallon - Fuel weight in pounds per gallon (default: 6.0 for 100LL)
 * @returns Fuel calculation result
 * 
 * @example
 * ```typescript
 * // 300nm flight at 120 knots, burning 10 gph
 * const fuel = calculateFuelRequired(300, 120, 10);
 * console.log(`Total fuel: ${fuel.gallons.toFixed(1)} gallons`);
 * console.log(`Flight time: ${fuel.time_hours.toFixed(1)} hours`);
 * console.log(`Reserve: ${fuel.reserve_gallons.toFixed(1)} gallons`);
 * 
 * // With custom reserve (45 minutes)
 * const fuel2 = calculateFuelRequired(300, 120, 10, 0.75);
 * ```
 */
export function calculateFuelRequired(
  distance_nm: number,
  groundSpeed_knots: number,
  fuelBurnRate_gph: number,
  reserveHours: number = 0.5,
  fuelWeight_lbs_per_gallon: number = CONVERSIONS.GALLONS_TO_POUNDS_100LL
): FuelCalculation {
  // Calculate flight time
  const time_hours = calculateFlightTime(distance_nm, groundSpeed_knots);
  
  // Calculate fuel for flight
  const flight_gallons = time_hours * fuelBurnRate_gph;
  
  // Calculate reserve fuel
  const reserve_gallons = reserveHours * fuelBurnRate_gph;
  
  // Total fuel required
  const total_gallons = flight_gallons + reserve_gallons;
  
  return {
    gallons: total_gallons,
    pounds: total_gallons * fuelWeight_lbs_per_gallon,
    liters: total_gallons * CONVERSIONS.GALLONS_TO_LITERS,
    time_hours,
    reserve_gallons
  };
}

/**
 * Calculate fuel burn for a given time
 * 
 * @param time_hours - Flight time in hours
 * @param fuelBurnRate_gph - Fuel burn rate in gallons per hour
 * @returns Fuel burned in gallons
 * 
 * @example
 * ```typescript
 * const fuel = calculateFuelBurn(2.5, 10);
 * console.log(`${fuel} gallons`); // 25 gallons
 * ```
 */
export function calculateFuelBurn(time_hours: number, fuelBurnRate_gph: number): number {
  return time_hours * fuelBurnRate_gph;
}

/**
 * Calculate range (maximum distance) given fuel and burn rate
 * 
 * @param usable_fuel_gallons - Usable fuel in gallons
 * @param groundSpeed_knots - Ground speed in knots
 * @param fuelBurnRate_gph - Fuel burn rate in gallons per hour
 * @param reserveHours - Reserve fuel in hours (default: 0.5)
 * @returns Maximum range in nautical miles
 * 
 * @example
 * ```typescript
 * // With 50 gallons usable, 120 knot cruise, 10 gph
 * const range = calculateRange(50, 120, 10);
 * console.log(`Range: ${range.toFixed(0)} nm`); // ~540 nm (with 30 min reserve)
 * ```
 */
export function calculateRange(
  usable_fuel_gallons: number,
  groundSpeed_knots: number,
  fuelBurnRate_gph: number,
  reserveHours: number = 0.5
): number {
  // Subtract reserve fuel
  const flight_fuel = usable_fuel_gallons - (reserveHours * fuelBurnRate_gph);
  
  if (flight_fuel <= 0) {
    return 0;
  }
  
  // Calculate flight time with available fuel
  const flight_time = flight_fuel / fuelBurnRate_gph;
  
  // Calculate range
  return groundSpeed_knots * flight_time;
}

/**
 * Calculate endurance (maximum time) given fuel and burn rate
 * 
 * @param usable_fuel_gallons - Usable fuel in gallons
 * @param fuelBurnRate_gph - Fuel burn rate in gallons per hour
 * @param reserveHours - Reserve fuel in hours (default: 0.5)
 * @returns Maximum endurance in hours
 * 
 * @example
 * ```typescript
 * // With 50 gallons usable, 10 gph
 * const endurance = calculateEndurance(50, 10);
 * console.log(`Endurance: ${formatTime(endurance)}`); // "4h 30m" (with 30 min reserve)
 * ```
 */
export function calculateEndurance(
  usable_fuel_gallons: number,
  fuelBurnRate_gph: number,
  reserveHours: number = 0.5
): number {
  // Subtract reserve fuel
  const flight_fuel = usable_fuel_gallons - (reserveHours * fuelBurnRate_gph);
  
  if (flight_fuel <= 0) {
    return 0;
  }
  
  // Calculate endurance
  return flight_fuel / fuelBurnRate_gph;
}

/**
 * Calculate true airspeed from indicated airspeed
 * 
 * Uses a simplified formula: TAS ≈ IAS × √(ρ₀/ρ)
 * where density ratio is approximated for altitude and temperature
 * 
 * @param indicated_airspeed_kts - Indicated airspeed in knots
 * @param altitude_ft - Pressure altitude in feet
 * @param temperature_c - Outside air temperature in Celsius
 * @returns True airspeed in knots
 * 
 * @example
 * ```typescript
 * // IAS 120 knots at 8,000 feet, 15°C
 * const tas = calculateTrueAirspeed(120, 8000, 15);
 * console.log(`TAS: ${tas.toFixed(0)} kts`); // ~136 knots
 * ```
 */
export function calculateTrueAirspeed(
  indicated_airspeed_kts: number,
  altitude_ft: number,
  temperature_c: number
): number {
  // Standard temperature at altitude (ISA)
  const standard_temp_c = 15 - (0.0019812 * altitude_ft);
  
  // Temperature difference from standard
  const temp_diff = temperature_c - standard_temp_c;
  
  // Correction factor (approximately 2% per 1000 ft altitude)
  const altitude_correction = 1 + (0.02 * altitude_ft / 1000);
  
  // Temperature correction (approximately 1% per 5°C above standard)
  const temp_correction = 1 + (temp_diff / 500);
  
  return indicated_airspeed_kts * altitude_correction * temp_correction;
}

/**
 * Calculate density altitude
 * 
 * Density altitude is pressure altitude corrected for non-standard temperature.
 * High density altitude reduces aircraft performance.
 * 
 * @param pressure_altitude_ft - Pressure altitude in feet
 * @param temperature_c - Outside air temperature in Celsius
 * @returns Density altitude in feet
 * 
 * @example
 * ```typescript
 * // At 5,000 feet pressure altitude, 30°C
 * const da = calculateDensityAltitude(5000, 30);
 * console.log(`Density altitude: ${da.toFixed(0)} ft`); // ~7,800 feet
 * ```
 */
export function calculateDensityAltitude(
  pressure_altitude_ft: number,
  temperature_c: number
): number {
  // Standard temperature at altitude (ISA)
  const standard_temp_c = 15 - (0.0019812 * pressure_altitude_ft);
  
  // Temperature difference
  const temp_diff = temperature_c - standard_temp_c;
  
  // Density altitude (approximately 120 feet per degree C above standard)
  return pressure_altitude_ft + (120 * temp_diff);
}
