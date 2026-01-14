/**
 * Aviation navigation utilities
 * 
 * Provides functions for distance calculations, course calculations,
 * and other navigation-related computations.
 */

/**
 * Earth radius constants
 */
export const EARTH_RADIUS_KM = 6371;
export const EARTH_RADIUS_NM = 3440.065; // Nautical miles
export const EARTH_RADIUS_SM = 3958.8; // Statute miles

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
 * Calculate great circle distance between two points using Haversine formula
 * 
 * @param lat1 - Starting latitude in decimal degrees
 * @param lon1 - Starting longitude in decimal degrees
 * @param lat2 - Ending latitude in decimal degrees
 * @param lon2 - Ending longitude in decimal degrees
 * @param unit - Unit of measurement ('km', 'nm', 'sm') - default 'nm'
 * @returns Distance in specified unit
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  unit: 'km' | 'nm' | 'sm' = 'nm'
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  // Select radius based on unit
  let radius: number;
  switch (unit) {
    case 'km':
      radius = EARTH_RADIUS_KM;
      break;
    case 'sm':
      radius = EARTH_RADIUS_SM;
      break;
    case 'nm':
    default:
      radius = EARTH_RADIUS_NM;
      break;
  }

  return radius * c;
}

/**
 * Calculate true course (bearing) between two points
 * 
 * @param lat1 - Starting latitude in decimal degrees
 * @param lon1 - Starting longitude in decimal degrees
 * @param lat2 - Ending latitude in decimal degrees
 * @param lon2 - Ending longitude in decimal degrees
 * @returns True course in degrees (0-360)
 */
export function calculateCourse(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLon = toRadians(lon2 - lon1);
  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);

  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

  const bearing = Math.atan2(y, x);
  const course = (toDegrees(bearing) + 360) % 360;

  return course;
}

/**
 * Calculate destination point given start point, distance, and bearing
 * 
 * @param lat - Starting latitude in decimal degrees
 * @param lon - Starting longitude in decimal degrees
 * @param distance - Distance in nautical miles
 * @param bearing - True bearing in degrees (0-360)
 * @returns Destination coordinates {latitude, longitude}
 */
export function calculateDestination(
  lat: number,
  lon: number,
  distance: number,
  bearing: number
): { latitude: number; longitude: number } {
  const latRad = toRadians(lat);
  const lonRad = toRadians(lon);
  const bearingRad = toRadians(bearing);
  const angularDistance = distance / EARTH_RADIUS_NM;

  const destLatRad = Math.asin(
    Math.sin(latRad) * Math.cos(angularDistance) +
      Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearingRad)
  );

  const destLonRad =
    lonRad +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(latRad),
      Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(destLatRad)
    );

  return {
    latitude: toDegrees(destLatRad),
    longitude: toDegrees(destLonRad),
  };
}

/**
 * Calculate midpoint between two coordinates
 * 
 * @param lat1 - First latitude in decimal degrees
 * @param lon1 - First longitude in decimal degrees
 * @param lat2 - Second latitude in decimal degrees
 * @param lon2 - Second longitude in decimal degrees
 * @returns Midpoint coordinates {latitude, longitude}
 */
export function calculateMidpoint(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): { latitude: number; longitude: number } {
  const lat1Rad = toRadians(lat1);
  const lon1Rad = toRadians(lon1);
  const lat2Rad = toRadians(lat2);
  const dLon = toRadians(lon2 - lon1);

  const bx = Math.cos(lat2Rad) * Math.cos(dLon);
  const by = Math.cos(lat2Rad) * Math.sin(dLon);

  const midLatRad = Math.atan2(
    Math.sin(lat1Rad) + Math.sin(lat2Rad),
    Math.sqrt((Math.cos(lat1Rad) + bx) * (Math.cos(lat1Rad) + bx) + by * by)
  );

  const midLonRad = lon1Rad + Math.atan2(by, Math.cos(lat1Rad) + bx);

  return {
    latitude: toDegrees(midLatRad),
    longitude: toDegrees(midLonRad),
  };
}

/**
 * Unit conversion functions
 */

/** Convert nautical miles to kilometers */
export function nmToKm(nm: number): number {
  return nm * 1.852;
}

/** Convert nautical miles to statute miles */
export function nmToSm(nm: number): number {
  return nm * 1.15078;
}

/** Convert kilometers to nautical miles */
export function kmToNm(km: number): number {
  return km / 1.852;
}

/** Convert statute miles to nautical miles */
export function smToNm(sm: number): number {
  return sm / 1.15078;
}

/** Convert feet to meters */
export function ftToM(ft: number): number {
  return ft * 0.3048;
}

/** Convert meters to feet */
export function mToFt(m: number): number {
  return m / 0.3048;
}

/** Convert knots to miles per hour */
export function ktsToMph(kts: number): number {
  return kts * 1.15078;
}

/** Convert miles per hour to knots */
export function mphToKts(mph: number): number {
  return mph / 1.15078;
}
