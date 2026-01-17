import { BackgroundService, ServiceConfig } from '@aviation/shared-sdk';
import { createSecretLoader } from '@aviation/keystore';
import {
  fetchMetarRaw,
  getHourlyForecast,
  parseMetar,
  flightCategory,
  recommendationForCategory,
  warningsForConditions,
  metersToSM,
  estimateCeilingFromCloudCover,
  searchAirports,
  type MetarData,
  type FlightCategory,
  type HourlyForecast,
  type Airport,
} from '@aviation/shared-sdk';
import { monitoredStations } from './regions';

export type StationSnapshot = {
  code: string;
  name: string;
  latitude: number;
  longitude: number;
  category: FlightCategory;
  visibility_sm: number | null;
  ceiling_ft: number | null;
  wind_speed_kt: number | null;
  wind_direction: number | null;
  temperature_f: number | null;
  updatedAt: string;
};

/**
 * Weather Briefing Service
 * 
 * This service provides aviation weather briefings using the shared SDK.
 * It fetches METAR data, analyzes flight conditions, and generates briefings.
 */
export class WeatherBriefingService extends BackgroundService {
  private secrets = createSecretLoader('weather-briefing');
  private intervalId?: NodeJS.Timeout;
  private lastUpdate?: Date;
  private cachedBriefings: Map<string, { data: MetarData; raw: string; category: FlightCategory; timestamp: Date }>;
  private cacheTtlMs = 5 * 60 * 1000;

  constructor(config: ServiceConfig) {
    super(config);
    this.cachedBriefings = new Map();
  }

  protected async onStart(): Promise<void> {
    // Check for API keys (optional for METAR, which is free from aviationweather.gov)
    const openweatherKey = this.secrets.get('OPENWEATHERMAP_API_KEY');
    const aiApiKey = this.secrets.get('OPENAI_API_KEY');
    
    if (!openweatherKey) {
      console.warn('No OpenWeatherMap API key found. Using free METAR service only.');
      console.warn('For enhanced weather: npm run keystore set weather-briefing OPENWEATHERMAP_API_KEY "your-key"');
    }

    if (!aiApiKey) {
      console.warn('No AI API key found. Basic briefings only (no AI analysis).');
      console.warn('Add key with: npm run keystore set weather-briefing OPENAI_API_KEY "your-key"');
    }

    // Start periodic weather updates every 5 minutes
    this.intervalId = setInterval(() => {
      this.updateWeatherData();
    }, 300000);

    // Initial update
    await this.updateWeatherData();

    console.log('✈️  Weather Briefing Service is now monitoring aviation weather...');
  }

  protected async onStop(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.cachedBriefings.clear();
    console.log('Weather Briefing Service stopped.');
  }

  /**
   * Update weather data for monitored stations
   */
  private async updateWeatherData(): Promise<void> {
    const timestamp = new Date();
    console.log(`[${timestamp.toISOString()}] Updating weather briefings...`);

    // Example stations (in production, these would come from configuration or user preferences)
    const stations = monitoredStations;

    let updated = 0;
    let errors = 0;

    for (const station of stations) {
      try {
        const raw = await fetchMetarRaw(station);
        if (raw) {
          const data = parseMetar(raw);
          const category = flightCategory(
            data.visibility_sm ?? null,
            data.ceiling_ft ?? null
          );

          this.cachedBriefings.set(station, {
            data,
            raw,
            category,
            timestamp,
          });
          updated++;
        }
      } catch (error) {
        errors++;
        console.error(`Failed to update ${station}:`, error);
      }
    }

    this.lastUpdate = timestamp;
    console.log(`✓ Updated ${updated} stations (${errors} errors)`);
  }

  /**
   * Generate weather briefing for a location
   */
  async generateBriefing(location: string, forecastDays: number = 0): Promise<string> {
    try {
      // Try to find airport by code or name
      const airports = searchAirports(location, 5);
      
      if (airports.length === 0) {
        return `No airport found for "${location}". Please provide a valid ICAO or IATA code (e.g., KSFO, SFO).`;
      }

      const airport = airports[0];
      const code = airport.icao || airport.iata;

      if (!code) {
        return `No valid airport code found for ${airport.name}.`;
      }

      // Fetch METAR
      const raw = await fetchMetarRaw(code);
      
      if (!raw) {
        return `No weather data available for ${code} (${airport.name}). The station may not be reporting.`;
      }

      // Parse METAR
      const data = parseMetar(raw);
      const category = flightCategory(
        data.visibility_sm ?? null,
        data.ceiling_ft ?? null
      );
      const recommendation = recommendationForCategory(category);
      const warnings = warningsForConditions(
        data.visibility_sm ?? null,
        data.ceiling_ft ?? null,
        data.wind_speed_kt ?? null
      );

      // Build briefing
      let briefing = `AVIATION WEATHER BRIEFING\n`;
      briefing += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      briefing += `Location: ${airport.name} (${code})\n`;
      briefing += `City: ${airport.city}, ${airport.country}\n`;
      briefing += `Time: ${new Date().toISOString()}\n\n`;

      briefing += `CURRENT CONDITIONS\n`;
      briefing += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      briefing += `Raw METAR: ${raw}\n\n`;

      briefing += `PARSED CONDITIONS\n`;
      briefing += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      
      if (data.wind_speed_kt !== undefined) {
        const dir = data.wind_direction !== undefined ? `${data.wind_direction}°` : 'VRB';
        const gust = data.wind_gust_kt ? ` gusting ${data.wind_gust_kt} kt` : '';
        briefing += `Wind: ${dir} at ${data.wind_speed_kt} kt${gust}\n`;
      }

      if (data.visibility_sm !== undefined) {
        briefing += `Visibility: ${data.visibility_sm} SM\n`;
      }

      if (data.ceiling_ft !== undefined) {
        briefing += `Ceiling: ${data.ceiling_ft} ft AGL\n`;
      }

      if (data.temperature_f !== undefined) {
        briefing += `Temperature: ${data.temperature_f}°F\n`;
      }

      briefing += `\nFLIGHT CATEGORY\n`;
      briefing += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      briefing += `${category}\n\n`;

      briefing += `RECOMMENDATION\n`;
      briefing += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      briefing += `${recommendation}\n`;

      if (warnings.length > 0) {
        briefing += `\nWARNINGS\n`;
        briefing += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        for (const warning of warnings) {
          briefing += `⚠️  ${warning}\n`;
        }
      }

      if (forecastDays > 0) {
        const outlook = await this.buildForecastOutlook(airport, code, forecastDays);
        if (outlook) {
          briefing += `\n${outlook}`;
        }
      }

      briefing += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      briefing += `Generated by Aviation Weather Briefing Service\n`;
      briefing += `Using @aviation/shared-sdk\n`;

      // Cache it
      this.cachedBriefings.set(code, {
        data,
        raw,
        category,
        timestamp: new Date(),
      });

      return briefing;

    } catch (error) {
      console.error('Error generating briefing:', error);
      return `Error generating weather briefing for "${location}": ${error}`;
    }
  }

  async getStationSummaries(codes: string[]): Promise<StationSnapshot[]> {
    const summaries: StationSnapshot[] = [];

    for (const code of codes) {
      const summary = await this.getStationSnapshot(code);
      if (summary) {
        summaries.push(summary);
      }
    }

    return summaries;
  }

  async getStationSnapshot(code: string): Promise<StationSnapshot | null> {
    const station = code.trim().toUpperCase();
    if (!station) {
      return null;
    }

    const airport = searchAirports(station, 1)[0];
    if (!airport) {
      return null;
    }

    const cached = this.cachedBriefings.get(station);
    const isFresh = cached ? Date.now() - cached.timestamp.getTime() < this.cacheTtlMs : false;

    let data: MetarData | undefined;
    let category: FlightCategory | undefined;
    let timestamp: Date;

    if (cached && isFresh) {
      data = cached.data;
      category = cached.category;
      timestamp = cached.timestamp;
    } else {
      const raw = await fetchMetarRaw(station);
      if (!raw) {
        return null;
      }

      data = parseMetar(raw);
      category = flightCategory(
        data.visibility_sm ?? null,
        data.ceiling_ft ?? null
      );
      timestamp = new Date();

      this.cachedBriefings.set(station, {
        data,
        raw,
        category,
        timestamp,
      });
    }

    if (!data || !category) {
      return null;
    }

    return {
      code: station,
      name: airport.name,
      latitude: airport.latitude,
      longitude: airport.longitude,
      category,
      visibility_sm: data.visibility_sm ?? null,
      ceiling_ft: data.ceiling_ft ?? null,
      wind_speed_kt: data.wind_speed_kt ?? null,
      wind_direction: data.wind_direction ?? null,
      temperature_f: data.temperature_f ?? null,
      updatedAt: timestamp.toISOString(),
    };
  }

  private async buildForecastOutlook(
    airport: Airport,
    station: string,
    forecastDays: number
  ): Promise<string | null> {
    const days = Math.min(7, Math.max(1, Math.floor(forecastDays)));
    if (!Number.isFinite(airport.latitude) || !Number.isFinite(airport.longitude)) {
      return null;
    }

    let hourly: HourlyForecast[] = [];
    try {
      hourly = await getHourlyForecast(airport.latitude, airport.longitude, days * 24);
    } catch (error) {
      console.warn('Forecast fetch failed:', error);
      return `FORECAST OUTLOOK (${days}-DAY)\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nForecast unavailable.`;
    }

    const today = new Date().toISOString().slice(0, 10);
    const byDate = new Map<string, HourlyForecast[]>();

    for (const entry of hourly) {
      const date = entry.time.split('T')[0];
      if (date < today) {
        continue;
      }
      const bucket = byDate.get(date);
      if (bucket) {
        bucket.push(entry);
      } else {
        byDate.set(date, [entry]);
      }
    }

    const dates = Array.from(byDate.keys()).sort().slice(0, days);
    if (dates.length === 0) {
      return `FORECAST OUTLOOK (${days}-DAY)\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nForecast unavailable.`;
    }

    let section = `FORECAST OUTLOOK (${days}-DAY)\n`;
    section += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    section += `Forecast based on Open-Meteo hourly data.\n\n`;

    dates.forEach((date, index) => {
      const entries = byDate.get(date) ?? [];
      const summary = this.summarizeForecast(entries);
      const metar = this.buildForecastMetar(station, date, summary.visibility_sm, summary.cloudcover_pct, summary.wind_speed_kt);
      const category = flightCategory(summary.visibility_sm, summary.ceiling_ft);
      const recommendation = recommendationForCategory(category);
      const warnings = warningsForConditions(summary.visibility_sm, summary.ceiling_ft, summary.wind_speed_kt);

      section += `Day ${index + 1} (${date})\n`;
      section += `Forecast METAR: ${metar}\n`;
      section += `Decoded Conditions:\n`;
      section += `  Wind: ${summary.wind_speed_kt !== null ? `VRB at ${Math.round(summary.wind_speed_kt)} kt` : 'N/A'}\n`;
      section += `  Visibility: ${summary.visibility_sm !== null ? summary.visibility_sm.toFixed(1) + ' SM' : 'N/A'}\n`;
      section += `  Estimated Ceiling: ${summary.ceiling_ft !== null ? Math.round(summary.ceiling_ft) + ' ft AGL' : 'N/A'}\n`;
      if (summary.precipitation_mm !== null) {
        section += `  Precipitation: ${summary.precipitation_mm.toFixed(1)} mm\n`;
      }
      section += `  Flight Category: ${category}\n`;
      section += `  Recommendation: ${recommendation}\n`;
      if (warnings.length > 0) {
        section += `  Warnings: ${warnings.join(' ')}\n`;
      }
      section += `\n`;
    });

    return section.trimEnd();
  }

  private summarizeForecast(entries: HourlyForecast[]) {
    const mean = (values: Array<number | null | undefined>): number | null => {
      const nums = values.filter((value): value is number => typeof value === 'number');
      if (nums.length === 0) {
        return null;
      }
      return nums.reduce((sum, value) => sum + value, 0) / nums.length;
    };

    const visibility_m = mean(entries.map((entry) => entry.visibility_m));
    const cloudcover_pct = mean(entries.map((entry) => entry.cloudcover_pct));
    const precipitation_mm = mean(entries.map((entry) => entry.precipitation_mm));
    const wind_speed_kt = mean(entries.map((entry) => entry.wind_speed_kt));
    const visibility_sm = metersToSM(visibility_m);
    const ceiling_ft = estimateCeilingFromCloudCover(cloudcover_pct);

    return {
      visibility_sm,
      cloudcover_pct,
      precipitation_mm,
      wind_speed_kt,
      ceiling_ft,
    };
  }

  private buildForecastMetar(
    station: string,
    date: string,
    visibility_sm: number | null,
    cloudcover_pct: number | null,
    wind_speed_kt: number | null
  ): string {
    const dayTag = date.slice(8, 10);
    const windToken = wind_speed_kt !== null
      ? `VRB${Math.round(wind_speed_kt).toString().padStart(2, '0')}KT`
      : 'VRB00KT';
    const visToken = visibility_sm === null
      ? 'P6SM'
      : (visibility_sm >= 6 ? 'P6SM' : `${visibility_sm.toFixed(1).replace(/\.0$/, '')}SM`);

    let skyToken = 'SKC';
    if (cloudcover_pct !== null) {
      const ceiling_ft = estimateCeilingFromCloudCover(cloudcover_pct);
      if (ceiling_ft !== null) {
        const height = Math.round(ceiling_ft / 100).toString().padStart(3, '0');
        if (cloudcover_pct >= 75) {
          skyToken = `BKN${height}`;
        } else if (cloudcover_pct >= 50) {
          skyToken = `SCT${height}`;
        } else if (cloudcover_pct >= 25) {
          skyToken = `FEW${height}`;
        }
      }
    }

    return `${station} ${dayTag}1200Z ${windToken} ${visToken} ${skyToken}`;
  }

  /**
   * Get cached weather for a station
   */
  getCachedWeather(station: string) {
    return this.cachedBriefings.get(station);
  }

  /**
   * Get all cached stations
   */
  getCachedStations(): string[] {
    return Array.from(this.cachedBriefings.keys());
  }

  /**
   * Get last update time
   */
  getLastUpdate(): Date | undefined {
    return this.lastUpdate;
  }
}
