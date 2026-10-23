/**
 * Fuel Calculations for Aviation
 * 
 * Provides fuel consumption, range, and endurance calculations.
 */

/**
 * Standard fuel densities (pounds per gallon)
 */
export const FUEL_DENSITY = {
  AVGAS_100LL: 6.0,  // 100LL Avgas
  JET_A: 6.7,        // Jet-A fuel
  JET_A1: 6.7,       // Jet-A1 fuel
  MOGAS: 6.0,        // Automotive gasoline
} as const;

/**
 * Calculate fuel consumption
 * 
 * @param fuelBurnGPH Fuel burn rate in gallons per hour
 * @param timeHours Flight time in hours
 * @returns Fuel consumed in gallons
 */
export function fuelConsumption(
  fuelBurnGPH: number,
  timeHours: number
): number {
  return fuelBurnGPH * timeHours;
}

/**
 * Calculate flight time from distance and speed
 * 
 * @param distanceNM Distance in nautical miles
 * @param groundSpeedKts Ground speed in knots
 * @returns Flight time in hours
 */
export function flightTime(distanceNM: number, groundSpeedKts: number): number {
  return distanceNM / groundSpeedKts;
}

/**
 * Calculate fuel required for a flight
 * 
 * @param distanceNM Distance in nautical miles
 * @param groundSpeedKts Ground speed in knots
 * @param fuelBurnGPH Fuel burn rate in gallons per hour
 * @returns Object with fuel (gallons), time (hours), and weight (lbs)
 */
export function fuelRequired(
  distanceNM: number,
  groundSpeedKts: number,
  fuelBurnGPH: number,
  fuelType: keyof typeof FUEL_DENSITY = 'AVGAS_100LL'
): {
  gallons: number;
  hours: number;
  pounds: number;
} {
  const hours = flightTime(distanceNM, groundSpeedKts);
  const gallons = fuelConsumption(fuelBurnGPH, hours);
  const pounds = gallons * FUEL_DENSITY[fuelType];
  
  return { gallons, hours, pounds };
}

/**
 * Calculate range with given fuel
 * 
 * @param fuelGallons Available fuel in gallons
 * @param fuelBurnGPH Fuel burn rate in gallons per hour
 * @param groundSpeedKts Ground speed in knots
 * @param reserveGallons Reserve fuel in gallons (default: 0)
 * @returns Range in nautical miles
 */
export function fuelRange(
  fuelGallons: number,
  fuelBurnGPH: number,
  groundSpeedKts: number,
  reserveGallons: number = 0
): number {
  const usableFuel = fuelGallons - reserveGallons;
  const endurance = usableFuel / fuelBurnGPH;
  return endurance * groundSpeedKts;
}

/**
 * Calculate endurance with given fuel
 * 
 * @param fuelGallons Available fuel in gallons
 * @param fuelBurnGPH Fuel burn rate in gallons per hour
 * @param reserveGallons Reserve fuel in gallons (default: 0)
 * @returns Endurance in hours
 */
export function fuelEndurance(
  fuelGallons: number,
  fuelBurnGPH: number,
  reserveGallons: number = 0
): number {
  const usableFuel = fuelGallons - reserveGallons;
  return usableFuel / fuelBurnGPH;
}

/**
 * Calculate fuel weight
 * 
 * @param gallons Fuel in gallons
 * @param fuelType Type of fuel
 * @returns Weight in pounds
 */
export function fuelWeight(
  gallons: number,
  fuelType: keyof typeof FUEL_DENSITY = 'AVGAS_100LL'
): number {
  return gallons * FUEL_DENSITY[fuelType];
}

/**
 * Calculate fuel volume from weight
 * 
 * @param pounds Weight in pounds
 * @param fuelType Type of fuel
 * @returns Volume in gallons
 */
export function fuelVolume(
  pounds: number,
  fuelType: keyof typeof FUEL_DENSITY = 'AVGAS_100LL'
): number {
  return pounds / FUEL_DENSITY[fuelType];
}

/**
 * Calculate VFR day fuel reserve (FAA regulation)
 * 
 * @param fuelBurnGPH Fuel burn rate in gallons per hour
 * @param isDayVFR True for day VFR, false for night VFR
 * @returns Required reserve in gallons
 * 
 * Note: FAR 91.151 requires 30 minutes day VFR, 45 minutes night VFR
 */
export function vfrFuelReserve(
  fuelBurnGPH: number,
  isDayVFR: boolean = true
): number {
  const reserveMinutes = isDayVFR ? 30 : 45;
  return fuelBurnGPH * (reserveMinutes / 60);
}

/**
 * Calculate IFR fuel reserve (FAA regulation)
 * 
 * @param fuelBurnGPH Fuel burn rate in gallons per hour
 * @returns Required reserve in gallons
 * 
 * Note: FAR 91.167 requires 45 minutes IFR reserve
 */
export function ifrFuelReserve(fuelBurnGPH: number): number {
  return fuelBurnGPH * 0.75; // 45 minutes
}

/**
 * Calculate alternate fuel requirement
 * 
 * @param distanceToAlternateNM Distance to alternate airport in NM
 * @param groundSpeedKts Ground speed in knots
 * @param fuelBurnGPH Fuel burn rate in gallons per hour
 * @returns Fuel required for alternate in gallons
 */
export function alternateFuelRequired(
  distanceToAlternateNM: number,
  groundSpeedKts: number,
  fuelBurnGPH: number
): number {
  const timeToAlternate = distanceToAlternateNM / groundSpeedKts;
  return fuelBurnGPH * timeToAlternate;
}

/**
 * Calculate specific range (NM per gallon)
 * 
 * @param groundSpeedKts Ground speed in knots
 * @param fuelBurnGPH Fuel burn rate in gallons per hour
 * @returns Specific range in NM/gallon
 */
export function specificRange(
  groundSpeedKts: number,
  fuelBurnGPH: number
): number {
  return groundSpeedKts / fuelBurnGPH;
}

/**
 * Calculate specific endurance (hours per gallon)
 * 
 * @param fuelBurnGPH Fuel burn rate in gallons per hour
 * @returns Specific endurance in hours/gallon
 */
export function specificEndurance(fuelBurnGPH: number): number {
  return 1 / fuelBurnGPH;
}
