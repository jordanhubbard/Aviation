import {
  fetchMetarRaw,
  parseMetar,
  flightCategory,
  recommendationForCategory,
  warningsForConditions,
  type FlightCategory,
  NotamClient,
  sortNotamsBySeverity,
  formatNotamText,
  type NOTAM,
  type NotamClientOptions,
} from '@aviation/shared-sdk';

interface AirportConditions {
  icao: string;
  metar: string | null;
  category: FlightCategory;
  recommendation: string;
  warnings: string[];
  lastUpdated: Date;
}

export interface WeatherBriefingServiceConfig {
  name?: string;
  enabled?: boolean;
  autoStart?: boolean;
  /** Optional override for the NOTAM client (useful in tests) */
  notamClientOptions?: NotamClientOptions;
}

export class WeatherBriefingService {
  private airportCache: Map<string, AirportConditions> = new Map();
  private _config: WeatherBriefingServiceConfig;
  private notamClient: NotamClient;

  constructor(config: WeatherBriefingServiceConfig = {}) {
    this._config = config;
    this.notamClient = new NotamClient(config.notamClientOptions ?? {});
  }

  public async start(): Promise<void> {
    // No-op for compatibility; service is ready when constructed
  }

  public async stop(): Promise<void> {
    this.airportCache.clear();
  }

  public async generateBriefing(station: string, forecastDays: number = 0): Promise<string> {
    await this.updateAirportWeather([station]);
    const conditions = this.getAirportConditions(station);
    if (!conditions) {
      return `No weather data available for ${station}.`;
    }

    // Fetch NOTAMs — failures are non-fatal (network/key absent in dev)
    let notamLines: string[] = [];
    try {
      const notams = await this.notamClient.fetchByIcao(station);
      notamLines = this.formatNotamSection(notams);
    } catch {
      // NOTAM fetch failed; briefing still usable without NOTAMs
      notamLines = ['NOTAMs: unavailable (check FAA_NOTAM_API_KEY configuration)'];
    }

    const lines = [
      `WEATHER BRIEFING: ${station}`,
      `Category: ${conditions.category}`,
      conditions.metar ? `METAR: ${conditions.metar}` : 'No METAR',
      `Recommendation: ${conditions.recommendation}`,
      ...(conditions.warnings.length ? [`Warnings: ${conditions.warnings.join('; ')}`] : []),
      '',
      ...notamLines,
    ];
    return lines.join('\n');
  }

  /** Format an array of NOTAMs as human-readable briefing lines. */
  private formatNotamSection(notams: NOTAM[]): string[] {
    if (notams.length === 0) {
      return ['NOTAMs: None active'];
    }
    const sorted = sortNotamsBySeverity(notams);
    const header = `NOTAMs (${sorted.length} active):`;
    const items = sorted.map(
      (n) => `  [${n.severity.toUpperCase()}] ${formatNotamText(n.text)} (${n.category ?? 'General'})`
    );
    return [header, ...items];
  }

  public async getStationSummaries(stationCodes: string[]): Promise<Array<{ code: string; category: string; metar: string | null }>> {
    await this.updateAirportWeather(stationCodes);
    return stationCodes.map((code) => {
      const c = this.getAirportConditions(code);
      return {
        code,
        category: c?.category ?? 'UNKNOWN',
        metar: c?.metar ?? null,
      };
    });
  }

  public async getStationSnapshot(code: string): Promise<{ code: string; category: string; metar: string | null; recommendation: string; warnings: string[] }> {
    await this.updateAirportWeather([code]);
    const c = this.getAirportConditions(code);
    if (!c) {
      return { code, category: 'UNKNOWN', metar: null, recommendation: 'No data', warnings: [] };
    }
    return {
      code: c.icao,
      category: c.category,
      metar: c.metar,
      recommendation: c.recommendation,
      warnings: c.warnings,
    };
  }

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
      default:
        return '⚪';
    }
  }

  public getAirportConditions(icao: string): AirportConditions | undefined {
    return this.airportCache.get(icao);
  }
}
