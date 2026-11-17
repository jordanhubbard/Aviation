import {
  parseMetar,
  flightCategory,
  recommendationForCategory,
  warningsForConditions,
  type FlightCategory,
  NotamClient,
  sortNotamsBySeverity,
  formatNotamText,
  type NOTAM,
  type NotamBriefing,
  type NotamClientOptions,
  BackgroundService,
  findAirport,
} from '@aviation/shared-sdk';
import { loadBundledAirports } from '@aviation/shared-sdk/aviation/airports/bundled';

export interface WeatherReports {
  status: 'available' | 'no_reports' | 'unavailable';
  reports: Array<Record<string, unknown>>;
  source: { provider: string; url: string; retrieved_at_utc: string | null };
}
export interface WeatherStation {
  code: string; name: string; latitude: number | null; longitude: number | null;
  category: FlightCategory; metar: string | null;
  metar_reports: WeatherReports; taf: WeatherReports; partial: boolean;
  recommendation: string; warnings: string[]; updatedAt: string;
  wind_direction?: number; wind_speed_kt?: number; wind_gust_kt?: number;
  visibility_sm?: number; temperature_f?: number; ceiling_ft?: number;
}
interface AirportConditions extends WeatherStation { icao: string; lastUpdated: Date }
export interface WeatherBriefingServiceConfig {
  name?: string; enabled?: boolean; autoStart?: boolean;
  notamClientOptions?: NotamClientOptions;
  notamClient?: Pick<NotamClient, 'fetchByIcao'> & Partial<Pick<NotamClient, 'fetchReportsByIcao'>>;
  reports?: (product: 'metar' | 'taf', station: string) => Promise<WeatherReports>;
}
const api = () => {
  const url = new URL(process.env.AVIATION_WEATHER_API_BASE_URL ||
    'https://meta-app.jordanhubbard.net/api/v1/planning/api/aviation-weather');
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash)
    throw new Error('Weather API base must be an HTTP(S) URL without credentials or query');
  return url.toString().replace(/\/$/, '');
};
export async function fetchWeatherReports(product: 'metar' | 'taf', station: string): Promise<WeatherReports> {
  const url = api() + '/' + product + '?airport=' + encodeURIComponent(station);
  const unavailable: WeatherReports = { status: 'unavailable', reports: [],
    source: { provider: 'NOAA Aviation Weather Center via Aviation API', url, retrieved_at_utc: null } };
  if (process.env.AVIATION_E2E_OFFLINE === 'true' && !process.env.AVIATION_WEATHER_API_BASE_URL) return unavailable;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000), redirect: 'error' });
    if (!response.ok) return unavailable;
    const data = await response.json() as WeatherReports;
    if (!['available', 'no_reports'].includes(data.status) || !Array.isArray(data.reports)
      || !data.source || typeof data.source.provider !== 'string' || typeof data.source.url !== 'string'
      || typeof data.source.retrieved_at_utc !== 'string'
      || data.reports.some(r => !r || typeof r !== 'object' || Array.isArray(r)
        || (typeof r.icaoId === 'string' && r.icaoId.toUpperCase() !== station))) return unavailable;
    if ((data.status === 'available') !== (data.reports.length > 0)) return unavailable;
    return data;
  } catch { return unavailable; }
}
export function normalizeStation(code: string): string {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{3,4}$/.test(normalized)) throw new Error('Station must be a 3–4 character airport code');
  return normalized;
}
const utc = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return 'Unknown';
  const date = new Date(typeof value === 'number' ? value * 1000 : String(value));
  return Number.isFinite(date.getTime()) ? date.toISOString() : 'Unknown';
};
const reportLines = (product: 'METAR' | 'TAF', data: WeatherReports): string[] => [
  product === 'TAF' ? 'TAF forecast:' : 'METAR observation:',
  ...(data.status !== 'available' ? [data.status === 'unavailable' ? 'Provider unavailable' : 'No reports available'] :
    data.reports.flatMap(r => [
      (product === 'TAF' ? 'Issued ' : (r.obsTime == null ? 'Report slot ' : 'Observed ')) + utc(product === 'TAF' ? r.issueTime : (r.obsTime ?? r.reportTime))
        + (product === 'TAF' ? ' · Valid ' + utc(r.validTimeFrom) + ' → ' + utc(r.validTimeTo) : ''),
      String((product === 'TAF' ? r.rawTAF : r.rawOb) ?? 'Report text unavailable'),
    ])),
  'Source: ' + data.source.provider + ' · Retrieved ' + utc(data.source.retrieved_at_utc),
];

export class WeatherBriefingService extends BackgroundService {
  private airportCache: Map<string, AirportConditions> = new Map();
  private notamClient: Pick<NotamClient, 'fetchByIcao'> & Partial<Pick<NotamClient, 'fetchReportsByIcao'>>;
  private reports: NonNullable<WeatherBriefingServiceConfig['reports']>;
  private pending = new Map<string, Promise<void>>();

  constructor(config: WeatherBriefingServiceConfig = {}) {
    super({
      name: config.name ?? 'weather-briefing',
      enabled: config.enabled ?? true,
      autoStart: config.autoStart,
    });
    this.notamClient = config.notamClient ?? new NotamClient(config.notamClientOptions ?? {});
    this.reports = config.reports ?? fetchWeatherReports;
    api();
    loadBundledAirports();
  }

  protected async onStart(): Promise<void> {
    // No-op for compatibility; service is ready when constructed
  }

  protected async onStop(): Promise<void> {
    await Promise.allSettled(this.pending.values());
    this.airportCache.clear();
  }

  public async generateBriefing(station: string, forecastDays: number = 0): Promise<string> {
    station = normalizeStation(station);
    await this.updateAirportWeather([station]);
    const conditions = this.getAirportConditions(station);
    if (!conditions) throw new Error('Missing station result');

    // Fetch NOTAMs — failures are non-fatal (network/key absent in dev)
    let notamLines: string[] = [];
    try {
      if (process.env.AVIATION_E2E_OFFLINE === 'true') throw new Error('Offline qualification');
      if (this.notamClient.fetchReportsByIcao) {
        notamLines = this.formatNotamReports(await this.notamClient.fetchReportsByIcao(station));
      } else {
        notamLines = this.formatNotamSection(await this.notamClient.fetchByIcao(station));
      }
    } catch {
      // NOTAM fetch failed; briefing still usable without NOTAMs
      notamLines = ['NOTAMs: unavailable. Review official FAA NOTAMs separately.'];
    }

    const lines = [
      `WEATHER BRIEFING: ${station}`,
      `Category: ${conditions.category}`,
      ...reportLines('METAR', conditions.metar_reports),
      '',
      ...reportLines('TAF', conditions.taf),
      ...(forecastDays ? [`Requested ${forecastDays}-day range does not extend published TAF validity.`] : []),
      `Recommendation: ${conditions.recommendation}`,
      ...(conditions.warnings.length ? [`Warnings: ${conditions.warnings.join('; ')}`] : []),
      '',
      ...notamLines,
    ];
    return lines.join('\n');
  }

  private formatNotamReports(report: NotamBriefing): string[] {
    return [
      `NOTAMs: ${report.status} · ${report.total} matching cached source records`,
      `Source: ${report.source.provider} · Environment: ${report.environment ?? 'not configured'}`,
      ...(!report.production_data ? [report.environment && report.environment !== 'production' ? 'NON-PRODUCTION DATA: may include test NOTAMs.' : 'Production NOTAM data is unavailable.'] : []),
      `Synchronized: ${report.synchronized_at ?? 'Unknown'} · Complete snapshot: ${report.complete_snapshot ? 'yes' : 'no'}`,
      ...(!report.fully_loaded ? ['The NOTAM source is unavailable or was not fully loaded.'] : []),
      ...(report.error ? [`Source error: ${report.error}`] : []),
      ...report.warnings.map(w => 'Coverage warning: ' + w),
      ...report.notams.flatMap(n => [
        `${n.number ? `NOTAM ${n.number}` : 'NOTAM source notice'} · ${n.icao_location ?? n.location} · ${n.activity.replace(/_/g, ' ')} · ${n.severity ? `text hint: ${n.severity}` : 'no text hint'}`,
        `Source ID: ${n.id}${n.series ? ` · Series ${n.series}` : ''}${n.year ? ` · Year ${n.year}` : ''}`,
        `Effective: ${n.effective_start_utc ?? 'Unknown'} → ${n.permanent ? 'PERM' : (n.effective_end_utc ?? 'Unknown')}${n.estimated ? ' (estimated)' : ''}`,
        ...(n.cancelled_at_utc ? ['Cancellation: ' + n.cancelled_at_utc] : []),
        ...(n.schedule ? ['Schedule: ' + n.schedule] : []),
        ...(n.missing_fields.length ? ['Source fields missing: ' + n.missing_fields.join(', ')] : []),
        n.text ?? 'Source text unavailable',
        ...(n.text_truncated ? ['Text is a preview; inspect the source detail before relying on it.'] : []),
        'Last modified: ' + n.last_updated_utc,
      ]),
    ];
  }

  /** Format an array of NOTAMs as human-readable briefing lines. */
  private formatNotamSection(notams: NOTAM[]): string[] {
    if (notams.length === 0) {
      return ['NOTAMs: No matching supplied records; source coverage was not provided.'];
    }
    const sorted = sortNotamsBySeverity(notams);
    const header = `NOTAMs (${sorted.length} supplied records):`;
    const items = sorted.map(
      (n) => `  [${n.severity.toUpperCase()}] ${formatNotamText(n.text)} (${n.category ?? 'General'})`
    );
    return [header, ...items];
  }

  public async getStationSummaries(stationCodes: string[]): Promise<WeatherStation[]> {
    const codes = stationCodes.map(normalizeStation);
    await this.updateAirportWeather(codes);
    return codes.map(code => this.snapshot(code));
  }
  private snapshot(code: string): WeatherStation {
    const { icao, lastUpdated, ...station } = this.airportCache.get(code)!;
    return station;
  }
  public async getStationSnapshot(code: string): Promise<WeatherStation> {
    code = normalizeStation(code);
    await this.updateAirportWeather([code]);
    return this.snapshot(code);
  }
  public async updateAirportWeather(icaoCodes: string[]): Promise<void> {
    const codes = [...new Set(icaoCodes.map(normalizeStation))];
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(6, codes.length) }, async () => {
      while (next < codes.length) await this.updateOne(codes[next++]);
    }));
  }
  private updateOne(code: string): Promise<void> {
    const cached = this.airportCache.get(code);
    if (cached && Date.now() - cached.lastUpdated.getTime() < (cached.partial ? 15000 : 60000)) return Promise.resolve();
    const existing = this.pending.get(code);
    if (existing) return existing;
    const job = (async () => {
      const airport = findAirport(code);
      const station = airport?.icao || code;
      const get = async (product: 'metar' | 'taf'): Promise<WeatherReports> => {
        try { return await this.reports(product, station); }
        catch { return { status: 'unavailable', reports: [], source: {
          provider: 'NOAA Aviation Weather Center via Aviation API',
          url: api() + '/' + product + '?airport=' + station, retrieved_at_utc: null,
        } }; }
      };
      const [metarReports, taf] = await Promise.all([get('metar'), get('taf')]);
      const raw = metarReports.reports[0]?.rawOb;
      const metar = typeof raw === 'string' && raw.trim() ? raw : null;
      const parsed = metar ? parseMetar(metar) : {};
      const category = metar ? flightCategory(parsed.visibility_sm ?? null, parsed.ceiling_ft ?? 10000) : 'UNKNOWN';
      const now = new Date();
      if (!this.airportCache.has(code) && this.airportCache.size >= 256) {
        const oldest = this.airportCache.keys().next().value;
        if (oldest !== undefined) this.airportCache.delete(oldest);
      }
      this.airportCache.set(code, { ...parsed, code, icao: code, name: airport?.name || code,
        latitude: airport?.latitude ?? null, longitude: airport?.longitude ?? null,
        metar, metar_reports: metarReports, taf,
        partial: [metarReports, taf].some(p => p.status === 'unavailable'), category,
        recommendation: recommendationForCategory(category),
        warnings: metar ? warningsForConditions(parsed.visibility_sm ?? null, parsed.ceiling_ft ?? null, parsed.wind_speed_kt ?? null) : [],
        updatedAt: now.toISOString(), lastUpdated: now,
      });
    })();
    this.pending.set(code, job);
    void job.finally(() => this.pending.delete(code));
    return job;
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
