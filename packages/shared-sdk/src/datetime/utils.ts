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
  
  // Helper functions
  const toRad = (deg: number) => deg * (Math.PI / 180);
  const toDeg = (rad: number) => rad * (180 / Math.PI);
  
  // Julian day calculation
  const year = utcDate.getUTCFullYear();
  const month = utcDate.getUTCMonth() + 1;
  const day = utcDate.getUTCDate();
  
  let a = Math.floor((14 - month) / 12);
  let y = year + 4800 - a;
  let m = month + (12 * a) - 3;
  
  const julianDay = day + Math.floor((153 * m + 2) / 5) + (365 * y) + 
                    Math.floor(y / 4) - Math.floor(y / 100) + 
                    Math.floor(y / 400) - 32045;
  
  const n = julianDay - 2451545 + 0.0008;
  
  // Mean solar noon
  const jStar = n - (longitude / 360);
  
  // Solar mean anomaly
  const m_deg = (357.5291 + 0.98560028 * jStar) % 360;
  const m_rad = toRad(m_deg);
  
  // Equation of center
  const c = 1.9148 * Math.sin(m_rad) + 0.0200 * Math.sin(2 * m_rad) + 
            0.0003 * Math.sin(3 * m_rad);
  
  // Ecliptic longitude
  const lambda = (m_deg + c + 180 + 102.9372) % 360;
  
  // Solar transit
  const jTransit = 2451545 + jStar + 0.0053 * Math.sin(m_rad) - 
                   0.0069 * Math.sin(2 * toRad(lambda));
  
  // Declination of the sun
  const delta = toDeg(Math.asin(Math.sin(toRad(lambda)) * Math.sin(toRad(23.44))));
  
  // Hour angle
  const cosOmega = (Math.sin(toRad(-0.833)) - Math.sin(toRad(latitude)) * Math.sin(toRad(delta))) /
                   (Math.cos(toRad(latitude)) * Math.cos(toRad(delta)));
  
  // Check if sun never rises or sets
  if (cosOmega > 1) {
    // Sun never rises (polar night)
    const sunrise = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const sunset = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    return { sunrise, sunset };
  } else if (cosOmega < -1) {
    // Sun never sets (midnight sun)
    const sunrise = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    const sunset = new Date(Date.UTC(year, month - 1, day, 23, 59, 59));
    return { sunrise, sunset };
  }
  
  const omega = toDeg(Math.acos(cosOmega));
  
  // Sunrise and sunset Julian days
  const jRise = jTransit - (omega / 360);
  const jSet = jTransit + (omega / 360);
  
  // Convert Julian days back to dates
  const julianToDate = (j: number) => {
    const jd = Math.floor(j);
    const time = (j - jd) * 24; // Hours
    
    const a = jd + 32044;
    const b = Math.floor((4 * a + 3) / 146097);
    const c = a - Math.floor((146097 * b) / 4);
    const d = Math.floor((4 * c + 3) / 1461);
    const e = c - Math.floor((1461 * d) / 4);
    const m = Math.floor((5 * e + 2) / 153);
    
    const day = e - Math.floor((153 * m + 2) / 5) + 1;
    const month = m + 3 - 12 * Math.floor(m / 10);
    const year = 100 * b + d - 4800 + Math.floor(m / 10);
    
    const hours = Math.floor(time);
    const minutes = Math.floor((time % 1) * 60);
    
    return new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
  };
  
  const sunrise = julianToDate(jRise);
  const sunset = julianToDate(jSet);
  
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
