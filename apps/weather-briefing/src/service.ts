import {
  fetchMetarRaw,
  parseMetar,
  flightCategory,
  recommendationForCategory,
  warningsForConditions,
} from '@aviation/shared-sdk';

interface AirportConditions {
  icao: string;
  metar: string | null;
  category: FlightCategory;
  recommendation: string;
  warnings: string[];
  lastUpdated: Date;
}

export class WeatherBriefingService {
  private airportCache: Map<string, AirportConditions> = new Map();

  public async updateAirportWeather(icaoCodes: string[]): Promise<void> {
    console.log(`🌤️  Fetching weather for ${icaoCodes.length} airports...`);

    for (const icao of icaoCodes) {
      try {
        // Fetch METAR
        const metar = await fetchMetarRaw(icao);
        
        if (!metar) {
          console.log(`   ⚠️  No METAR available for ${icao}`);
          continue;
        }

        // Parse METAR
        const parsed = parseMetar(metar);

        // Determine flight category
        const category = flightCategory(
          parsed.visibility_sm || null,
          parsed.ceiling_ft || 10000 // Assume high ceiling if not reported
        );

        // Get recommendation and warnings
        const recommendation = recommendationForCategory(category);
        const warnings = warningsForConditions(
          parsed.visibility_sm || null,
          parsed.ceiling_ft || null,
          parsed.wind_speed_kt || null
        );

        // Cache the conditions
        this.airportCache.set(icao, {
          icao,
          metar,
          category,
          recommendation,
          warnings,
          lastUpdated: new Date(),
        });

        // Log weather update
        const categoryEmoji = this.getCategoryEmoji(category);
        console.log(`   ${categoryEmoji} ${icao}: ${category} - ${parsed.temperature_f}°F, ${parsed.wind_speed_kt}kt`);
        
        if (warnings.length > 0) {
          console.log(`      ⚠️  ${warnings.join(', ')}`);
        }
      } catch (error) {
        console.error(`   ❌ Failed to fetch weather for ${icao}:`, error);
      }
    }
  }

  private getCategoryEmoji(category: FlightCategory): string {
    switch (category) {
      case 'VFR':
        return '🟢';
      case 'MVFR':
        return '🔵';
      case 'IFR':
        return '🔴';
      case 'LIFR':
        return '🟣';
      case 'UNKNOWN':
        return '⚪';
    }
  }

  public getAirportConditions(icao: string): AirportConditions | undefined {
    return this.airportCache.get(icao);
  }
}
