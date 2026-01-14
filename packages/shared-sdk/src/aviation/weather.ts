export interface MetarResponse {
  raw: string;
  station: string;
  issuedAt: string;
}

export interface TafResponse {
  raw: string;
  station: string;
  issuedAt: string;
}

export interface WeatherClientOptions {
  baseUrl?: string;
  apiKey?: string;
  fetchFn?: typeof fetch;
}

/**
 * Minimal, dependency-light client for aviationweather.gov-style endpoints.
 * Caller provides fetch (global or polyfilled) to avoid extra deps in shared-sdk.
 */
export class AviationWeatherClient {
  private baseUrl: string;
  private apiKey?: string;
  private fetchFn: typeof fetch;

  constructor(opts: WeatherClientOptions = {}) {
    this.baseUrl = opts.baseUrl ?? 'https://aviationweather.gov/api/data';
    this.apiKey = opts.apiKey;
    this.fetchFn = opts.fetchFn ?? fetch;
  }

  async getMetar(station: string): Promise<MetarResponse> {
    const url = `${this.baseUrl}/metar?ids=${encodeURIComponent(station)}&format=raw`;
    const res = await this.fetchFn(url, this.headers());
    if (!res.ok) throw new Error(`METAR fetch failed: ${res.status}`);
    const raw = await res.text();
    return { raw, station, issuedAt: new Date().toISOString() };
  }

  async getTaf(station: string): Promise<TafResponse> {
    const url = `${this.baseUrl}/taf?ids=${encodeURIComponent(station)}&format=raw`;
    const res = await this.fetchFn(url, this.headers());
    if (!res.ok) throw new Error(`TAF fetch failed: ${res.status}`);
    const raw = await res.text();
    return { raw, station, issuedAt: new Date().toISOString() };
  }

  private headers(): RequestInit {
    return this.apiKey ? { headers: { 'X-API-Key': this.apiKey } } : {};
  }
}
