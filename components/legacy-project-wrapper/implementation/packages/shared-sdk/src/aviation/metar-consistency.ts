/** Service-owned consistency findings; clients preserve original observations. */
export type MetarConsistencyStatus = 'suspicious' | 'no_conflict_detected' | 'insufficient_evidence' | 'unavailable';
export interface MetarConsistencyObservation {
  station_id: string; observed_at_epoch: number | null; category: string | null;
  original: Record<string, unknown> | null; ceiling_ft?: number | null; visibility_sm?: number | null;
  distance_nm?: number; bearing_degrees?: number; exclusion?: string | null;
}
export interface MetarConsistencyReport {
  status: MetarConsistencyStatus; station_id: string; checked_at_utc: string;
  target: MetarConsistencyObservation | null; neighbors: MetarConsistencyObservation[];
  flags: Array<{code: string; explanation: string; station_ids?: string[]; indicators?: string[]}>;
  forecast_context: Array<{original_forecast?: string; period: Record<string, unknown>; observed_votes: number; interpretation: string}>;
  qualifying_neighbors: number; ifr_neighbors: number; policy: Record<string, number>;
  source: Record<string, unknown>; errors: string[]; truncated: boolean; limitations: string[];
}
export class MetarConsistencyClient {
  constructor(private options: {baseUrl?: string; fetchFn?: typeof fetch} = {}) {}
  async assess(station: string, options: {radiusNm?: number; maxNeighbors?: number; signal?: AbortSignal} = {}): Promise<MetarConsistencyReport> {
    const code = station.trim().toUpperCase();
    if (!/^[A-Z0-9]{3,4}$/.test(code)) throw new Error('Invalid METAR station');
    const radius = options.radiusNm ?? 100, count = options.maxNeighbors ?? 12;
    if (!Number.isFinite(radius) || radius < 25 || radius > 150 || !Number.isInteger(count) || count < 3 || count > 20) throw new Error('Invalid consistency bounds');
    const url = new URL(this.options.baseUrl ?? 'https://meta-app.jordanhubbard.net/api/v1/planning/api/aviation-weather/metar-consistency');
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Invalid consistency API base');
    url.search = new URLSearchParams({airport:code, radius_nm:String(radius), max_neighbors:String(count)}).toString();
    const response = await (this.options.fetchFn ?? fetch)(url, {signal: options.signal ?? AbortSignal.timeout(30000), redirect:'error'});
    if (!response.ok) throw new Error(`METAR consistency unavailable (HTTP ${response.status})`);
    if (!/^application\/(?:[a-z0-9.+-]+\+)?json(?:;|$)/i.test(response.headers.get('content-type') ?? '')) throw new Error('Invalid consistency content type');
    if (Number(response.headers.get('content-length')) > 262144) throw new Error('Consistency response too large');
    const reader = response.body?.getReader(); if (!reader) throw new Error('Missing consistency response');
    const chunks: Uint8Array[] = []; let size=0;
    try { for (;;) { const {done,value}=await reader.read(); if(done)break; size+=value.byteLength; if(size>262144)throw new Error('Consistency response too large'); chunks.push(value); } } finally { await reader.cancel().catch(()=>{}); }
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)) as MetarConsistencyReport;
    if (!['suspicious','no_conflict_detected','insufficient_evidence','unavailable'].includes(data.status) || data.station_id!==code || !Array.isArray(data.neighbors) || data.neighbors.length>20 || !Array.isArray(data.flags) || !Array.isArray(data.limitations) || !Array.isArray(data.errors)) throw new Error('Invalid consistency response');
    const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
    const texts = (v: unknown) => Array.isArray(v) && v.every(x => typeof x === 'string');
    const obs = (v: unknown) => object(v) && typeof v.station_id === 'string' &&
      (v.observed_at_epoch === null || typeof v.observed_at_epoch === 'number' && Number.isFinite(v.observed_at_epoch)) &&
      (v.category === null || ['VFR','MVFR','IFR','LIFR'].includes(v.category as string)) && (v.original === null || object(v.original));
    if (!Number.isFinite(Date.parse(data.checked_at_utc)) || !(data.target === null || obs(data.target) && data.target.station_id === code) ||
      (data.status === 'suspicious' && (!data.target || data.flags.length === 0)) || !data.neighbors.every(obs) ||
      !data.flags.every(f => object(f) && typeof f.code === 'string' && typeof f.explanation === 'string') ||
      !Array.isArray(data.forecast_context) || !data.forecast_context.every(f => object(f) && object(f.period) && f.observed_votes === 0) ||
      !Number.isInteger(data.qualifying_neighbors) || data.qualifying_neighbors < 0 || data.qualifying_neighbors > data.neighbors.length ||
      !Number.isInteger(data.ifr_neighbors) || data.ifr_neighbors < 0 || data.ifr_neighbors > data.qualifying_neighbors ||
      !object(data.policy) || !object(data.source) || typeof data.truncated !== 'boolean' || !texts(data.errors) || !texts(data.limitations)) throw new Error('Invalid consistency evidence');
    return data;
  }
}
