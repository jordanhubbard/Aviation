import { BackgroundService, ServiceConfig } from '@aviation/shared-sdk';
import { createSecretLoader } from '@aviation/keystore';
import {
  fetchMetarRaw,
  parseMetar,
  flightCategory,
  recommendationForCategory,
  warningsForConditions,
  type MetarData,
  type FlightCategory,
} from '@aviation/shared-sdk';
import {  searchAirports } from '@aviation/shared-sdk';

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
    const stations = ['KSFO', 'KJFK', 'KORD', 'KLAX', 'KDFW'];

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
  async generateBriefing(location: string): Promise<string> {
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
