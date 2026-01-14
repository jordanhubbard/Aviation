/**
 * Date and time utilities for aviation applications
 * 
 * Provides comprehensive date/time handling including:
 * - UTC/Zulu time conversions
 * - Timezone management
 * - Aviation-specific formatting
 * - Sunrise/sunset calculations
 * - Flight time formatting
 * 
 * Standard Rule:
 * - Backend/database: Always UTC
 * - Frontend display: Local time
 * - Frontend input: Local time → converted to UTC for backend
 * 
 * @module datetime/utils
 */

/**
 * Get current UTC date and time
 * 
 * @returns Current time as UTC Date object
 * 
 * @example
 * ```typescript
 * const now = utcNow();
 * console.log(now.toISOString());
 * ```
 */
export function utcNow(): Date {
  return new Date();
}

/**
 * Convert any date to UTC Date object
 * 
 * @param date - Date to convert (Date object, ISO string, or timestamp)
 * @returns UTC Date object
 * 
 * @example
 * ```typescript
 * const utc = toUtc('2026-01-15T10:30:00-08:00');
 * console.log(utc.toISOString());
 * ```
 */
export function toUtc(date: Date | string | number): Date {
  if (date instanceof Date) {
    return date;
  }
  return new Date(date);
}

/**
 * Convert date to Zulu time string (ISO 8601 with Z suffix)
 * 
 * @param date - Date to convert
 * @returns ISO 8601 string with Z suffix (e.g., '2026-01-15T18:30:00Z')
 * 
 * @example
 * ```typescript
 * const zulu = toZulu(new Date());
 * console.log(zulu); // '2026-01-15T18:30:00Z'
 * ```
 */
export function toZulu(date: Date | string | number): string {
  const utcDate = toUtc(date);
  return utcDate.toISOString();
}

/**
 * Parse a Zulu time string to Date object
 * 
 * @param zuluString - ISO 8601 string with Z suffix
 * @returns Date object in UTC
 * 
 * @example
 * ```typescript
 * const date = fromZulu('2026-01-15T18:30:00Z');
 * console.log(date.toISOString());
 * ```
 */
export function fromZulu(zuluString: string): Date {
  return new Date(zuluString);
}

/**
 * Format a date to a specific timezone
 * 
 * @param date - Date to format
 * @param timezone - IANA timezone name (e.g., 'America/Los_Angeles')
 * @param options - Intl.DateTimeFormat options
 * @returns Formatted date string
 * 
 * @example
 * ```typescript
 * const formatted = formatDateTime(
 *   new Date(),
 *   'America/Los_Angeles',
 *   { dateStyle: 'long', timeStyle: 'short' }
 * );
 * console.log(formatted); // 'January 15, 2026 at 10:30 AM'
 * ```
 */
export function formatDateTime(
  date: Date | string | number,
  timezone: string = Intl.DateTimeFormat().resolvedOptions().timeZone,
  options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }
): string {
  const utcDate = toUtc(date);
  return new Intl.DateTimeFormat('en-US', {
    ...options,
    timeZone: timezone
  }).format(utcDate);
}

/**
 * Format flight time in minutes to human-readable format
 * 
 * @param minutes - Flight time in minutes
 * @returns Formatted string like "2h 30m" or "45m"
 * 
 * @example
 * ```typescript
 * console.log(formatFlightTime(150)); // '2h 30m'
 * console.log(formatFlightTime(45));  // '45m'
 * ```
 */
export function formatFlightTime(minutes: number): string {
  if (minutes < 0) {
    return '0m';
  }
  
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  
  if (hours === 0) {
    return `${mins}m`;
  } else if (mins === 0) {
    return `${hours}h`;
  } else {
    return `${hours}h ${mins}m`;
  }
}

/**
 * Parse a flight time string to minutes
 * 
 * @param timeString - Time string like "2h 30m", "2.5", or "150"
 * @returns Time in minutes
 * 
 * @example
 * ```typescript
 * console.log(parseFlightTime('2h 30m')); // 150
 * console.log(parseFlightTime('2.5'));    // 150
 * ```
 */
export function parseFlightTime(timeString: string): number {
  const str = timeString.trim().toLowerCase();
  
  // Try decimal hours first (e.g., "2.5")
  const decimal = parseFloat(str);
  if (!isNaN(decimal) && !str.includes('h') && !str.includes('m')) {
    return decimal * 60;
  }
  
  let totalMinutes = 0;
  
  // Parse "2h 30m" format
  if (str.includes('h')) {
    const parts = str.split('h');
    const hours = parseFloat(parts[0].trim());
    if (!isNaN(hours)) {
      totalMinutes += hours * 60;
    }
    
    if (parts.length > 1) {
      const remaining = parts[1].trim();
      if (remaining.includes('m')) {
        const mins = parseFloat(remaining.replace('m', '').trim());
        if (!isNaN(mins)) {
          totalMinutes += mins;
        }
      }
    }
  } else if (str.includes('m')) {
    const mins = parseFloat(str.replace('m', '').trim());
    if (!isNaN(mins)) {
      totalMinutes += mins;
    }
  }
  
  return totalMinutes;
}

/**
 * Calculate sunrise and sunset times for a given location and date
 * 
 * Uses a simplified astronomical formula. Accurate to within a few minutes.
 * 
 * @param latitude - Latitude in degrees (-90 to 90)
 * @param longitude - Longitude in degrees (-180 to 180)
 * @param date - Date to calculate for (default: today)
 * @returns Object with sunrise and sunset as UTC Date objects
 * 
 * @example
 * ```typescript
 * // San Francisco coordinates
 * const { sunrise, sunset } = calculateSunriseSunset(37.7749, -122.4194);
 * console.log(`Sunrise: ${sunrise.toISOString()}`);
 * console.log(`Sunset: ${sunset.toISOString()}`);
 * ```
 */
export function calculateSunriseSunset(
  latitude: number,
  longitude: number,
  date: Date = new Date()
): { sunrise: Date; sunset: Date } {
  const utcDate = toUtc(date);
  
  // Day of year
  const start = new Date(utcDate.getFullYear(), 0, 0);
  const diff = utcDate.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const n = Math.floor(diff / oneDay);
  
  // Longitude hour value
  const lngHour = longitude / 15;
  
  // Approximate time
  const tRise = n + ((6 - lngHour) / 24);
  const tSet = n + ((18 - lngHour) / 24);
  
  // Sun's mean anomaly
  const mRise = (0.9856 * tRise) - 3.289;
  const mSet = (0.9856 * tSet) - 3.289;
  
  // Convert to radians
  const toRad = (deg: number) => deg * (Math.PI / 180);
  const toDeg = (rad: number) => rad * (180 / Math.PI);
  
  // Sun's true longitude
  const sunLongitude = (m: number) => {
    let l = m + (1.916 * Math.sin(toRad(m))) + (0.020 * Math.sin(toRad(2 * m))) + 282.634;
    return l % 360;
  };
  
  const lRise = sunLongitude(mRise);
  const lSet = sunLongitude(mSet);
  
  // Sun's right ascension
  const rightAscension = (l: number) => {
    let ra = toDeg(Math.atan(0.91764 * Math.tan(toRad(l))));
    ra = ra % 360;
    
    // Adjust into same quadrant as l
    const lQuadrant = Math.floor(l / 90) * 90;
    const raQuadrant = Math.floor(ra / 90) * 90;
    ra = ra + (lQuadrant - raQuadrant);
    
    return ra / 15; // Convert to hours
  };
  
  const raRise = rightAscension(lRise);
  const raSet = rightAscension(lSet);
  
  // Sun's declination
  const declination = (l: number) => {
    const sinDec = 0.39782 * Math.sin(toRad(l));
    return toDeg(Math.asin(sinDec));
  };
  
  const sinDecRise = Math.sin(toRad(declination(lRise)));
  const cosDecRise = Math.cos(toRad(declination(lRise)));
  const sinDecSet = Math.sin(toRad(declination(lSet)));
  const cosDecSet = Math.cos(toRad(declination(lSet)));
  
  // Sun's local hour angle
  const cosH = (Math.cos(toRad(90.833)) - (sinDecRise * Math.sin(toRad(latitude)))) /
               (cosDecRise * Math.cos(toRad(latitude)));
  
  // Check if sun never rises or sets
  let hRise: number, hSet: number;
  
  if (cosH > 1) {
    // Sun never rises
    hRise = 0;
    hSet = 0;
  } else if (cosH < -1) {
    // Sun never sets
    hRise = 180;
    hSet = 180;
  } else {
    hRise = 360 - toDeg(Math.acos(cosH));
    hRise = hRise / 15;
    
    hSet = toDeg(Math.acos(cosH));
    hSet = hSet / 15;
  }
  
  // Local mean time
  const tRiseLocal = hRise + raRise - (0.06571 * tRise) - 6.622;
  const tSetLocal = hSet + raSet - (0.06571 * tSet) - 6.622;
  
  // Adjust to UTC
  const utRise = (tRiseLocal - lngHour) % 24;
  const utSet = (tSetLocal - lngHour) % 24;
  
  // Create Date objects
  const sunrise = new Date(Date.UTC(
    utcDate.getUTCFullYear(),
    utcDate.getUTCMonth(),
    utcDate.getUTCDate()
  ));
  sunrise.setUTCHours(Math.floor(utRise));
  sunrise.setUTCMinutes((utRise % 1) * 60);
  
  const sunset = new Date(Date.UTC(
    utcDate.getUTCFullYear(),
    utcDate.getUTCMonth(),
    utcDate.getUTCDate()
  ));
  sunset.setUTCHours(Math.floor(utSet));
  sunset.setUTCMinutes((utSet % 1) * 60);
  
  return { sunrise, sunset };
}

/**
 * Determine if a given time is during night hours
 * 
 * @param latitude - Latitude in degrees
 * @param longitude - Longitude in degrees
 * @param date - Date to check (default: now)
 * @returns True if night time, false if daytime
 * 
 * @example
 * ```typescript
 * const isNightTime = isNight(37.7749, -122.4194);
 * console.log(isNightTime ? 'Night' : 'Day');
 * ```
 */
export function isNight(
  latitude: number,
  longitude: number,
  date: Date = new Date()
): boolean {
  const utcDate = toUtc(date);
  const { sunrise, sunset } = calculateSunriseSunset(latitude, longitude, utcDate);
  
  return utcDate < sunrise || utcDate > sunset;
}

/**
 * Add flight time to a base datetime
 * 
 * @param baseTime - Starting datetime
 * @param flightMinutes - Flight time in minutes
 * @returns Resulting datetime
 * 
 * @example
 * ```typescript
 * const departure = new Date('2026-01-15T10:00:00Z');
 * const arrival = addFlightTime(departure, 150); // 2h 30m flight
 * console.log(arrival.toISOString());
 * ```
 */
export function addFlightTime(baseTime: Date, flightMinutes: number): Date {
  const result = new Date(baseTime);
  result.setMinutes(result.getMinutes() + flightMinutes);
  return result;
}

/**
 * Get time difference between two dates in minutes
 * 
 * @param start - Start datetime
 * @param end - End datetime
 * @returns Difference in minutes
 * 
 * @example
 * ```typescript
 * const start = new Date('2026-01-15T10:00:00Z');
 * const end = new Date('2026-01-15T12:30:00Z');
 * const flightTime = getTimeDifference(start, end);
 * console.log(flightTime); // 150
 * ```
 */
export function getTimeDifference(start: Date, end: Date): number {
  const diff = end.getTime() - start.getTime();
  return Math.round(diff / (1000 * 60));
}
