/**
 * METAR (Meteorological Aerodrome Report) client
 * 
 * Fetches and parses METAR data from AviationWeather.gov
 * 
 * @module aviation/weather/metar
 */

import type { METARData, WeatherClientOptions } from './types.js';
import { calculateFlightCategory } from './flight-category.js';
import { weatherCache, generateAirportCacheKey, DEFAULT_CACHE_TTL } from './weather-cache.js';

/**
 * METAR client for fetching and parsing METAR data
 */
export class METARClient {
  private baseUrl: string;
  private timeout: number;
  private enableCache: boolean;
  private cacheTtl: number;

  constructor(options: WeatherClientOptions = {}) {
    this.baseUrl = options.baseUrl || 'https://aviationweather.gov/api/data';
    this.timeout = options.timeout || 5000;
    this.enableCache = options.enableCache ?? true;
    this.cacheTtl = options.cacheTtl || DEFAULT_CACHE_TTL.metar;
  }

  /**
   * Fetch raw METAR text for an airport
   * 
   * @param icao - Airport ICAO code
   * @returns Raw METAR text or null if not available
   * 
   * @example
   * ```typescript
   * const client = new METARClient();
   * const metar = await client.fetchMetar('KSFO');
   * console.log(metar); // "KSFO 131856Z 28016KT 10SM FEW015 BKN200 16/13 A2990 RMK..."
   * ```
   */
  async fetchMetar(icao: string): Promise<string | null> {
    const cacheKey = generateAirportCacheKey('metar-raw', icao);
    
    // Check cache
    if (this.enableCache) {
      const cached = weatherCache.get<string>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      const url = `${this.baseUrl}/metar?ids=${icao.toUpperCase()}&format=raw`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Aviation-SDK/1.0'
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return null;
      }

      const text = await response.text();
      
      // Response may contain multiple lines, extract the METAR line
      const lines = text.trim().split('\n');
      const metarLine = lines.find(line => line.startsWith(icao.toUpperCase()));
      
      if (!metarLine) {
        return null;
      }

      // Cache the result
      if (this.enableCache) {
        weatherCache.set(cacheKey, metarLine, this.cacheTtl);
      }

      return metarLine;
    } catch (error) {
      // Network error or timeout
      return null;
    }
  }

  /**
   * Parse METAR text into structured data
   * 
   * Note: This is a basic parser that extracts common fields.
   * For comprehensive parsing, consider using a dedicated METAR library.
   * 
   * @param raw - Raw METAR text
   * @returns Parsed METAR data or null if parsing fails
   * 
   * @example
   * ```typescript
   * const client = new METARClient();
   * const metar = await client.parseMetar('KSFO 131856Z 28016KT 10SM FEW015 BKN200 16/13 A2990');
   * console.log(metar.temperature); // 60.8 (converted to Fahrenheit)
   * console.log(metar.flight_category); // "VFR"
   * ```
   */
  parseMetar(raw: string): METARData | null {
    try {
      const parts = raw.split(/\s+/);
      
      if (parts.length < 5) {
        return null; // Incomplete METAR
      }

      const station = parts[0];
      const timeStr = parts[1];
      
      // Parse time (format: DDHHmmZ)
      const day = parseInt(timeStr.substring(0, 2), 10);
      const hour = parseInt(timeStr.substring(2, 4), 10);
      const minute = parseInt(timeStr.substring(4, 6), 10);
      
      const now = new Date();
      const time = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        day,
        hour,
        minute
      ));

      // Find wind (format: DDDSSKTs or DDDSS Gust GGG KT)
      let windIdx = 2;
      const windMatch = parts[windIdx].match(/^(\d{3}|VRB)(\d{2,3})(G(\d{2,3}))?KT$/);
      
      if (!windMatch) {
        return null;
      }

      const wind = {
        direction: windMatch[1] === 'VRB' ? 0 : parseInt(windMatch[1], 10),
        speed: parseInt(windMatch[2], 10),
        gust: windMatch[4] ? parseInt(windMatch[4], 10) : undefined,
        variable: windMatch[1] === 'VRB'
      };

      // Find visibility (format: 10SM, 1/2SM, etc.)
      let visIdx = windIdx + 1;
      let visibilityStr = parts[visIdx];
      let visibility = 10; // Default

      if (visibilityStr.endsWith('SM')) {
        const visStr = visibilityStr.replace('SM', '');
        if (visStr.includes('/')) {
          const [num, denom] = visStr.split('/').map(s => parseFloat(s));
          visibility = num / denom;
        } else {
          visibility = parseFloat(visStr);
        }
        visIdx++;
      }

      // Parse clouds and conditions
      const clouds: Array<{ coverage: string; altitude: number }> = [];
      const conditions: string[] = [];
      let ceiling: number | null = null;

      for (let i = visIdx; i < parts.length; i++) {
        const part = parts[i];

        // Cloud layer (SKC, CLR, FEW015, SCT030, BKN050, OVC100)
        const cloudMatch = part.match(/^(SKC|CLR|FEW|SCT|BKN|OVC)(\d{3})?$/);
        if (cloudMatch) {
          const coverage = cloudMatch[1];
          const altitude = cloudMatch[2] ? parseInt(cloudMatch[2], 10) * 100 : 0;
          
          clouds.push({ coverage, altitude });

          // Ceiling is lowest BKN or OVC layer
          if ((coverage === 'BKN' || coverage === 'OVC') && altitude > 0) {
            if (ceiling === null || altitude < ceiling) {
              ceiling = altitude;
            }
          }
        }

        // Temperature/Dewpoint (16/13, M02/M05)
        const tempMatch = part.match(/^(M?\d{2})\/(M?\d{2})$/);
        if (tempMatch) {
          const tempC = parseInt(tempMatch[1].replace('M', '-'), 10);
          const dewC = parseInt(tempMatch[2].replace('M', '-'), 10);
          
          const temperature = tempC * 9/5 + 32; // Convert to Fahrenheit
          const dewpoint = dewC * 9/5 + 32;
          
          // Parse altimeter (next part, format: A2990)
          const altMatch = parts[i + 1]?.match(/^A(\d{4})$/);
          const altimeter = altMatch ? parseInt(altMatch[1], 10) / 100 : 29.92;

          // Calculate flight category
          const flight_category = calculateFlightCategory(visibility, ceiling);

          // Extract remarks (everything after RMK)
          const rmkIdx = parts.indexOf('RMK');
          const remarks = rmkIdx > 0 ? parts.slice(rmkIdx + 1).join(' ') : undefined;

          return {
            raw,
            station,
            time: time.toISOString(),
            wind,
            visibility,
            temperature,
            dewpoint,
            altimeter,
            clouds,
            conditions,
            flight_category,
            ceiling,
            remarks
          };
        }

        // Weather conditions (RA, SN, BR, FG, etc.)
        if (part.match(/^(\+|-|VC)?(MI|PR|BC|DR|BL|SH|TS|FZ)?(DZ|RA|SN|SG|IC|PL|GR|GS|UP|BR|FG|FU|VA|DU|SA|HZ|PY|PO|SQ|FC|SS|DS)$/)) {
          conditions.push(part);
        }
      }

      return null; // Couldn't parse complete METAR
    } catch (error) {
      return null;
    }
  }

  /**
   * Fetch and parse METAR for an airport
   * 
   * @param icao - Airport ICAO code
   * @returns Parsed METAR data or null if not available
   * 
   * @example
   * ```typescript
   * const client = new METARClient();
   * const metar = await client.getMetar('KSFO');
   * if (metar) {
   *   console.log(`${metar.station}: ${metar.temperature}°F, ${metar.wind.speed} kts`);
   *   console.log(`Flight category: ${metar.flight_category}`);
   * }
   * ```
   */
  async getMetar(icao: string): Promise<METARData | null> {
    const cacheKey = generateAirportCacheKey('metar-parsed', icao);
    
    // Check cache
    if (this.enableCache) {
      const cached = weatherCache.get<METARData>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const raw = await this.fetchMetar(icao);
    if (!raw) {
      return null;
    }

    const parsed = this.parseMetar(raw);
    if (!parsed) {
      return null;
    }

    // Cache the result
    if (this.enableCache) {
      weatherCache.set(cacheKey, parsed, this.cacheTtl);
    }

    return parsed;
  }
}

/**
 * Singleton METAR client instance
 */
export const metarClient = new METARClient();

/**
 * Convenience function to fetch METAR for an airport
 * 
 * @param icao - Airport ICAO code
 * @returns Parsed METAR data or null if not available
 * 
 * @example
 * ```typescript
 * const metar = await fetchMetar('KSFO');
 * if (metar) {
 *   console.log(`Temperature: ${metar.temperature}°F`);
 * }
 * ```
 */
export async function fetchMetar(icao: string): Promise<METARData | null> {
  return metarClient.getMetar(icao);
}
