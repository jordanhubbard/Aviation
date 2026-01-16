/**
 * Distance Calculations for Aviation
 * 
 * Provides haversine distance calculations in various units (NM, km, miles).
 * Extracted from flight-planner for shared use.
 */

/**
 * Earth radius in different units
 */
export const EARTH_RADIUS = {
  NM: 3440.065,      // Nautical miles
  KM: 6371.0,        // Kilometers
  MI: 3958.8,        // Statute miles
  METERS: 6371000.0, // Meters
} as const;

/**
 * Convert degrees to radians
 */
export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Convert radians to degrees
 */
export function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/**
 * Calculate haversine distance between two points
 * 
 * @param lat1 Starting latitude in degrees
 * @param lon1 Starting longitude in degrees
 * @param lat2 Ending latitude in degrees
 * @param lon2 Ending longitude in degrees
 * @param unit Unit for result (default: 'NM')
 * @returns Distance in specified unit
 * 
 * @example
 * ```typescript
 * // Distance from KSFO to KJFK
 * const distance = haversineDistance(37.6213, -122.3790, 40.6413, -73.7781);
 * console.log(`${distance} NM`); // ~2586 NM
 * ```
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  unit: keyof typeof EARTH_RADIUS = 'NM'
): number {
  const R = EARTH_RADIUS[unit];
  
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaPhi = toRadians(lat2 - lat1);
  const deltaLambda = toRadians(lon2 - lon1);
  
  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
    Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

/**
 * Calculate distance in nautical miles (convenience function)
 */
export function distanceNM(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  return haversineDistance(lat1, lon1, lat2, lon2, 'NM');
}

/**
 * Calculate distance in kilometers (convenience function)
 */
export function distanceKM(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  return haversineDistance(lat1, lon1, lat2, lon2, 'KM');
}

/**
 * Calculate distance in statute miles (convenience function)
 */
export function distanceMI(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  return haversineDistance(lat1, lon1, lat2, lon2, 'MI');
}

/**
 * Calculate midpoint between two coordinates
 * 
 * @param lat1 Starting latitude in degrees
 * @param lon1 Starting longitude in degrees
 * @param lat2 Ending latitude in degrees
 * @param lon2 Ending longitude in degrees
 * @returns Midpoint coordinates [latitude, longitude]
 */
export function midpoint(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): [number, number] {
  const phi1 = toRadians(lat1);
  const lambda1 = toRadians(lon1);
  const phi2 = toRadians(lat2);
  const deltaLambda = toRadians(lon2 - lon1);
  
  const Bx = Math.cos(phi2) * Math.cos(deltaLambda);
  const By = Math.cos(phi2) * Math.sin(deltaLambda);
  
  const phi3 = Math.atan2(
    Math.sin(phi1) + Math.sin(phi2),
    Math.sqrt((Math.cos(phi1) + Bx) * (Math.cos(phi1) + Bx) + By * By)
  );
  
  const lambda3 = lambda1 + Math.atan2(By, Math.cos(phi1) + Bx);
  
  return [toDegrees(phi3), toDegrees(lambda3)];
}

/**
 * Calculate destination point given starting point, distance, and bearing
 * 
 * @param lat Starting latitude in degrees
 * @param lon Starting longitude in degrees
 * @param distance Distance to travel
 * @param bearing Bearing in degrees (0-360)
 * @param unit Unit of distance (default: 'NM')
 * @returns Destination coordinates [latitude, longitude]
 * 
 * @example
 * ```typescript
 * // Fly 100 NM at heading 090 from KSFO
 * const [lat, lon] = destination(37.6213, -122.3790, 100, 90);
 * ```
 */
export function destination(
  lat: number,
  lon: number,
  distance: number,
  bearing: number,
  unit: keyof typeof EARTH_RADIUS = 'NM'
): [number, number] {
  const R = EARTH_RADIUS[unit];
  const delta = distance / R; // Angular distance
  const theta = toRadians(bearing);
  
  const phi1 = toRadians(lat);
  const lambda1 = toRadians(lon);
  
  const phi2 = Math.asin(
    Math.sin(phi1) * Math.cos(delta) +
    Math.cos(phi1) * Math.sin(delta) * Math.cos(theta)
  );
  
  const lambda2 = lambda1 + Math.atan2(
    Math.sin(theta) * Math.sin(delta) * Math.cos(phi1),
    Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2)
  );
  
  return [toDegrees(phi2), toDegrees(lambda2)];
}

/**
 * Generate waypoints along a great circle route
 * 
 * @param lat1 Starting latitude in degrees
 * @param lon1 Starting longitude in degrees
 * @param lat2 Ending latitude in degrees
 * @param lon2 Ending longitude in degrees
 * @param numPoints Number of waypoints to generate
 * @returns Array of waypoint coordinates
 */
export function greatCircleRoute(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  numPoints: number = 10
): Array<[number, number]> {
  const totalDistance = distanceNM(lat1, lon1, lat2, lon2);
  const segmentDistance = totalDistance / (numPoints - 1);
  
  const waypoints: Array<[number, number]> = [[lat1, lon1]];
  
  for (let i = 1; i < numPoints - 1; i++) {
    const fraction = i / (numPoints - 1);
    
    // Calculate intermediate point
    const phi1 = toRadians(lat1);
    const lambda1 = toRadians(lon1);
    const phi2 = toRadians(lat2);
    const lambda2 = toRadians(lon2);
    
    const delta = toRadians(totalDistance / EARTH_RADIUS.NM);
    
    const a = Math.sin((1 - fraction) * delta) / Math.sin(delta);
    const b = Math.sin(fraction * delta) / Math.sin(delta);
    
    const x = a * Math.cos(phi1) * Math.cos(lambda1) + b * Math.cos(phi2) * Math.cos(lambda2);
    const y = a * Math.cos(phi1) * Math.sin(lambda1) + b * Math.cos(phi2) * Math.sin(lambda2);
    const z = a * Math.sin(phi1) + b * Math.sin(phi2);
    
    const phi3 = Math.atan2(z, Math.sqrt(x * x + y * y));
    const lambda3 = Math.atan2(y, x);
    
    waypoints.push([toDegrees(phi3), toDegrees(lambda3)]);
  }
  
  waypoints.push([lat2, lon2]);
  
  return waypoints;
}

/**
 * Unit conversion utilities
 */
export const convert = {
  nmToKm: (nm: number) => nm * 1.852,
  nmToMi: (nm: number) => nm * 1.15078,
  nmToMeters: (nm: number) => nm * 1852,
  
  kmToNm: (km: number) => km / 1.852,
  kmToMi: (km: number) => km * 0.621371,
  
  miToNm: (mi: number) => mi / 1.15078,
  miToKm: (mi: number) => mi * 1.60934,
  
  metersToNm: (m: number) => m / 1852,
  metersToFeet: (m: number) => m * 3.28084,
  
  feetToMeters: (ft: number) => ft / 3.28084,
  feetToNm: (ft: number) => ft / 6076.12,
} as const;
