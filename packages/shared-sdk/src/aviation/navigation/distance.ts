/**
 * Distance calculations for aviation navigation
 * 
 * Provides great circle distance calculations using the Haversine formula
 * and related distance utilities.
 * 
 * @module aviation/navigation/distance
 */

import type { Coordinate, DistanceResult, DistanceUnit } from './types.js';
import { EARTH_RADIUS, CONVERSIONS } from './types.js';

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
 * Calculate great circle distance between two points using Haversine formula
 * 
 * @param lat1 - Starting latitude in degrees
 * @param lon1 - Starting longitude in degrees
 * @param lat2 - Ending latitude in degrees
 * @param lon2 - Ending longitude in degrees
 * @param unit - Distance unit (default: 'nm')
 * @returns Distance in specified unit
 * 
 * @example
 * ```typescript
 * // Distance from San Francisco to Los Angeles
 * const distance = haversineDistance(37.7749, -122.4194, 34.0522, -118.2437);
 * console.log(distance); // ~293 nautical miles
 * 
 * // Get distance in statute miles
 * const distanceSM = haversineDistance(37.7749, -122.4194, 34.0522, -118.2437, 'sm');
 * console.log(distanceSM); // ~337 statute miles
 * ```
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  unit: DistanceUnit = 'nm'
): number {
  const radius = unit === 'nm' ? EARTH_RADIUS.NM :
                 unit === 'sm' ? EARTH_RADIUS.SM :
                 unit === 'km' ? EARTH_RADIUS.KM :
                 EARTH_RADIUS.METERS;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return radius * c;
}

/**
 * Calculate distance between two coordinates
 * 
 * @param from - Starting coordinate
 * @param to - Ending coordinate
 * @param unit - Distance unit (default: 'nm')
 * @returns Distance in specified unit
 * 
 * @example
 * ```typescript
 * const sfo = { latitude: 37.7749, longitude: -122.4194 };
 * const lax = { latitude: 34.0522, longitude: -118.2437 };
 * const distance = calculateDistance(sfo, lax);
 * console.log(distance); // ~293 nautical miles
 * ```
 */
export function calculateDistance(
  from: Coordinate,
  to: Coordinate,
  unit: DistanceUnit = 'nm'
): number {
  return haversineDistance(from.latitude, from.longitude, to.latitude, to.longitude, unit);
}

/**
 * Calculate distance in all common units
 * 
 * @param lat1 - Starting latitude in degrees
 * @param lon1 - Starting longitude in degrees
 * @param lat2 - Ending latitude in degrees
 * @param lon2 - Ending longitude in degrees
 * @returns Distance in nautical miles, statute miles, and kilometers
 * 
 * @example
 * ```typescript
 * const distances = calculateDistanceAllUnits(37.7749, -122.4194, 34.0522, -118.2437);
 * console.log(`${distances.nautical_miles} nm`);
 * console.log(`${distances.statute_miles} sm`);
 * console.log(`${distances.kilometers} km`);
 * ```
 */
export function calculateDistanceAllUnits(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): DistanceResult {
  const nautical_miles = haversineDistance(lat1, lon1, lat2, lon2, 'nm');
  
  return {
    nautical_miles,
    statute_miles: nautical_miles * CONVERSIONS.NM_TO_SM,
    kilometers: nautical_miles * CONVERSIONS.NM_TO_KM
  };
}

/**
 * Calculate if a coordinate is within a certain distance of another
 * 
 * @param from - Center coordinate
 * @param to - Test coordinate
 * @param radius - Radius in nautical miles
 * @returns True if within radius, false otherwise
 * 
 * @example
 * ```typescript
 * const sfo = { latitude: 37.619, longitude: -122.375 };
 * const oak = { latitude: 37.721, longitude: -122.221 };
 * const isNearby = isWithinRadius(sfo, oak, 10);
 * console.log(isNearby); // true (OAK is ~9.3nm from SFO)
 * ```
 */
export function isWithinRadius(
  from: Coordinate,
  to: Coordinate,
  radius: number
): boolean {
  const distance = calculateDistance(from, to, 'nm');
  return distance <= radius;
}

/**
 * Find the midpoint between two coordinates
 * 
 * @param lat1 - Starting latitude in degrees
 * @param lon1 - Starting longitude in degrees
 * @param lat2 - Ending latitude in degrees
 * @param lon2 - Ending longitude in degrees
 * @returns Midpoint coordinate
 * 
 * @example
 * ```typescript
 * const midpoint = calculateMidpoint(37.7749, -122.4194, 34.0522, -118.2437);
 * console.log(`Midpoint: ${midpoint.latitude}, ${midpoint.longitude}`);
 * ```
 */
export function calculateMidpoint(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): Coordinate {
  const dLon = toRadians(lon2 - lon1);
  
  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);
  const lon1Rad = toRadians(lon1);
  
  const bx = Math.cos(lat2Rad) * Math.cos(dLon);
  const by = Math.cos(lat2Rad) * Math.sin(dLon);
  
  const lat3Rad = Math.atan2(
    Math.sin(lat1Rad) + Math.sin(lat2Rad),
    Math.sqrt((Math.cos(lat1Rad) + bx) * (Math.cos(lat1Rad) + bx) + by * by)
  );
  
  const lon3Rad = lon1Rad + Math.atan2(by, Math.cos(lat1Rad) + bx);
  
  return {
    latitude: toDegrees(lat3Rad),
    longitude: toDegrees(lon3Rad)
  };
}

/**
 * Calculate a destination point given distance and bearing
 * 
 * @param lat - Starting latitude in degrees
 * @param lon - Starting longitude in degrees
 * @param distance - Distance in nautical miles
 * @param bearing - True bearing in degrees (0-360)
 * @returns Destination coordinate
 * 
 * @example
 * ```typescript
 * // Fly 100nm on heading 090 (east) from SFO
 * const dest = calculateDestination(37.619, -122.375, 100, 90);
 * console.log(`Destination: ${dest.latitude}, ${dest.longitude}`);
 * ```
 */
export function calculateDestination(
  lat: number,
  lon: number,
  distance: number,
  bearing: number
): Coordinate {
  const latRad = toRadians(lat);
  const lonRad = toRadians(lon);
  const bearingRad = toRadians(bearing);
  const distanceRad = distance / EARTH_RADIUS.NM;
  
  const lat2Rad = Math.asin(
    Math.sin(latRad) * Math.cos(distanceRad) +
    Math.cos(latRad) * Math.sin(distanceRad) * Math.cos(bearingRad)
  );
  
  const lon2Rad = lonRad + Math.atan2(
    Math.sin(bearingRad) * Math.sin(distanceRad) * Math.cos(latRad),
    Math.cos(distanceRad) - Math.sin(latRad) * Math.sin(lat2Rad)
  );
  
  return {
    latitude: toDegrees(lat2Rad),
    longitude: toDegrees(lon2Rad)
  };
}

/**
 * Interpolate a point along the great circle path
 * 
 * @param lat1 - Starting latitude in degrees
 * @param lon1 - Starting longitude in degrees
 * @param lat2 - Ending latitude in degrees
 * @param lon2 - Ending longitude in degrees
 * @param fraction - Fraction along path (0.0 = start, 1.0 = end)
 * @returns Interpolated coordinate
 * 
 * @example
 * ```typescript
 * // Find the point 25% of the way from SFO to LAX
 * const point = interpolate(37.7749, -122.4194, 34.0522, -118.2437, 0.25);
 * console.log(`25% point: ${point.latitude}, ${point.longitude}`);
 * ```
 */
export function interpolate(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  fraction: number
): Coordinate {
  const lat1Rad = toRadians(lat1);
  const lon1Rad = toRadians(lon1);
  const lat2Rad = toRadians(lat2);
  const lon2Rad = toRadians(lon2);
  
  const d = Math.acos(
    Math.sin(lat1Rad) * Math.sin(lat2Rad) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.cos(lon2Rad - lon1Rad)
  );
  
  const a = Math.sin((1 - fraction) * d) / Math.sin(d);
  const b = Math.sin(fraction * d) / Math.sin(d);
  
  const x = a * Math.cos(lat1Rad) * Math.cos(lon1Rad) +
            b * Math.cos(lat2Rad) * Math.cos(lon2Rad);
  const y = a * Math.cos(lat1Rad) * Math.sin(lon1Rad) +
            b * Math.cos(lat2Rad) * Math.sin(lon2Rad);
  const z = a * Math.sin(lat1Rad) + b * Math.sin(lat2Rad);
  
  const lat3Rad = Math.atan2(z, Math.sqrt(x * x + y * y));
  const lon3Rad = Math.atan2(y, x);
  
  return {
    latitude: toDegrees(lat3Rad),
    longitude: toDegrees(lon3Rad)
  };
}
