/**
 * Time-Speed-Distance Calculations for Aviation
 * 
 * The fundamental aviation formula: D = S × T
 * Provides calculations for time, speed, and distance relationships.
 */

/**
 * Calculate distance from speed and time
 * 
 * @param speedKts Speed in knots
 * @param timeHours Time in hours
 * @returns Distance in nautical miles
 */
export function distance(speedKts: number, timeHours: number): number {
  return speedKts * timeHours;
}

/**
 * Calculate speed from distance and time
 * 
 * @param distanceNM Distance in nautical miles
 * @param timeHours Time in hours
 * @returns Speed in knots
 */
export function speed(distanceNM: number, timeHours: number): number {
  return distanceNM / timeHours;
}

/**
 * Calculate time from distance and speed
 * 
 * @param distanceNM Distance in nautical miles
 * @param speedKts Speed in knots
 * @returns Time in hours
 */
export function time(distanceNM: number, speedKts: number): number {
  return distanceNM / speedKts;
}

/**
 * Convert time in hours to hours and minutes
 * 
 * @param hours Time in decimal hours
 * @returns Object with hours and minutes
 */
export function hoursToHM(hours: number): { hours: number; minutes: number } {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return { hours: h, minutes: m };
}

/**
 * Convert hours and minutes to decimal hours
 * 
 * @param hours Hours
 * @param minutes Minutes
 * @returns Decimal hours
 */
export function hmToHours(hours: number, minutes: number): number {
  return hours + minutes / 60;
}

/**
 * Format time as HH:MM string
 * 
 * @param hours Time in decimal hours
 * @returns Formatted string (e.g., "2:30")
 */
export function formatTime(hours: number): string {
  const { hours: h, minutes: m } = hoursToHM(hours);
  return `${h}:${m.toString().padStart(2, '0')}`;
}

/**
 * Calculate ETA (Estimated Time of Arrival)
 * 
 * @param currentTime Current time (Date or timestamp)
 * @param distanceRemainingNM Remaining distance in nautical miles
 * @param groundSpeedKts Ground speed in knots
 * @returns ETA as Date object
 */
export function eta(
  currentTime: Date | number,
  distanceRemainingNM: number,
  groundSpeedKts: number
): Date {
  const current = currentTime instanceof Date ? currentTime : new Date(currentTime);
  const timeRemainingHours = time(distanceRemainingNM, groundSpeedKts);
  const timeRemainingMs = timeRemainingHours * 60 * 60 * 1000;
  
  return new Date(current.getTime() + timeRemainingMs);
}

/**
 * Calculate time en route (actual elapsed time)
 * 
 * @param departureTime Departure time (Date or timestamp)
 * @param arrivalTime Arrival time (Date or timestamp)
 * @returns Time en route in hours
 */
export function timeEnRoute(
  departureTime: Date | number,
  arrivalTime: Date | number
): number {
  const departure = departureTime instanceof Date ? departureTime : new Date(departureTime);
  const arrival = arrivalTime instanceof Date ? arrivalTime : new Date(arrivalTime);
  
  const differenceMs = arrival.getTime() - departure.getTime();
  return differenceMs / (60 * 60 * 1000); // Convert to hours
}

/**
 * Calculate average ground speed from actual flight
 * 
 * @param distanceNM Distance flown in nautical miles
 * @param departureTime Departure time
 * @param arrivalTime Arrival time
 * @returns Average ground speed in knots
 */
export function averageGroundSpeed(
  distanceNM: number,
  departureTime: Date | number,
  arrivalTime: Date | number
): number {
  const timeHours = timeEnRoute(departureTime, arrivalTime);
  return speed(distanceNM, timeHours);
}

/**
 * Convert knots to other speed units
 */
export const speedConvert = {
  knotsToMph: (knots: number) => knots * 1.15078,
  knotsToKph: (knots: number) => knots * 1.852,
  knotsToFps: (knots: number) => knots * 1.68781,
  knotsToMps: (knots: number) => knots * 0.514444,
  
  mphToKnots: (mph: number) => mph / 1.15078,
  kphToKnots: (kph: number) => kph / 1.852,
  fpsToKnots: (fps: number) => fps / 1.68781,
  mpsToKnots: (mps: number) => mps / 0.514444,
} as const;

/**
 * Calculate indicated airspeed (IAS) to true airspeed (TAS)
 * 
 * @param indicatedAirspeedKts Indicated airspeed in knots
 * @param altitudeFt Pressure altitude in feet
 * @param temperatureC Outside air temperature in Celsius
 * @returns True airspeed in knots
 * 
 * Note: This is a simplified calculation. For more accurate TAS,
 * use E6B calculator or flight computer.
 */
export function iasToTas(
  indicatedAirspeedKts: number,
  altitudeFt: number,
  temperatureC: number
): number {
  // Standard temperature at altitude
  const standardTempC = 15 - (0.00198 * altitudeFt);
  
  // Temperature correction
  const tempRatio = (temperatureC + 273.15) / (standardTempC + 273.15);
  
  // Altitude correction (rule of thumb: add 2% per 1000 ft)
  const altitudeCorrection = 1 + (altitudeFt / 1000) * 0.02;
  
  // Apply corrections
  return indicatedAirspeedKts * altitudeCorrection * Math.sqrt(tempRatio);
}

/**
 * Calculate Mach number from true airspeed and altitude
 * 
 * @param trueAirspeedKts True airspeed in knots
 * @param altitudeFt Pressure altitude in feet
 * @returns Mach number
 */
export function tasToMach(trueAirspeedKts: number, altitudeFt: number): number {
  // Speed of sound varies with temperature
  // Standard temperature lapse rate: -1.98°C per 1000 ft
  const tempC = 15 - (0.00198 * altitudeFt);
  const tempK = tempC + 273.15;
  
  // Speed of sound in knots
  const speedOfSoundKts = 38.967854 * Math.sqrt(tempK);
  
  return trueAirspeedKts / speedOfSoundKts;
}

/**
 * Calculate true airspeed from Mach number and altitude
 * 
 * @param machNumber Mach number
 * @param altitudeFt Pressure altitude in feet
 * @returns True airspeed in knots
 */
export function machToTas(machNumber: number, altitudeFt: number): number {
  const tempC = 15 - (0.00198 * altitudeFt);
  const tempK = tempC + 273.15;
  const speedOfSoundKts = 38.967854 * Math.sqrt(tempK);
  
  return machNumber * speedOfSoundKts;
}
