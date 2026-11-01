import { NormalizedEvent } from './types.js';

/** Provider placeholders are absence of identity, never a shared aircraft identity. */
export function normalizeMatchRegistration(value: unknown): string {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase().replace(/[\s-]+/g, '') : '';
  return ['', 'unknown', 'n/a', 'na', 'unregistered'].includes(normalized) ? '' : normalized;
}

export function dedupe(events: NormalizedEvent[]): NormalizedEvent[] {
  const seen = new Map<string | symbol, NormalizedEvent>();
  for (const ev of events) {
    const primary = ev.sources[0];
    const reportIdentity = primary && ['asn', 'avherald', 'ntsb'].includes(primary.sourceName) && primary.recordId
      ? JSON.stringify(['source', primary.sourceName, primary.recordId]) : Symbol('unidentified report');
    const key = normalizeMatchRegistration(ev.registration)
      ? `${ev.dateZ}::${ev.registration}` : reportIdentity;
    if (seen.has(key)) {
      // Merge sources; prefer newest updatedAt
      const existing = seen.get(key)!;
      const mergedSources = [...existing.sources, ...ev.sources];
      const newer = existing.updatedAt > ev.updatedAt ? existing.updatedAt : ev.updatedAt;
      seen.set(key, { ...existing, ...ev,
        category: ev.category === 'unknown' ? existing.category : ev.category,
        sources: mergedSources,
        causes: [...(existing.causes ?? []), ...(ev.causes ?? [])], updatedAt: newer });
    } else {
      seen.set(key, ev);
    }
  }
  return Array.from(seen.values());
}

export function fuzzyDedup(events: NormalizedEvent[], threshold = 0.8): NormalizedEvent[] {
  const result: NormalizedEvent[] = [];
  const consumed = new Set<number>();
  for (let i = 0; i < events.length; i++) {
    if (consumed.has(i)) continue;
    const base = events[i];
    let merged = { ...base };
    for (let j = i + 1; j < events.length; j++) {
      if (consumed.has(j)) continue;
      const cand = events[j];
      const score = similarity(base, cand);
      if (score >= threshold) {
        merged = mergeEvents(merged, cand);
        consumed.add(j);
      }
    }
    result.push(merged);
  }
  return result;
}

function similarity(a: NormalizedEvent, b: NormalizedEvent): number {
  let score = 0;
  let weight = 0;
  // date within +/-1 day
  const dayMs = 24 * 60 * 60 * 1000;
  const da = new Date(a.dateZ).getTime();
  const db = new Date(b.dateZ).getTime();
  if (Math.abs(da - db) <= dayMs) score += 0.4;
  weight += 0.4;
  // registration exact or similar
  const registration = normalizeMatchRegistration(a.registration);
  if (registration && registration === normalizeMatchRegistration(b.registration)) score += 0.4;
  weight += 0.4;
  // country match
  if (a.country && b.country && a.country === b.country) score += 0.1;
  weight += 0.1;
  // aircraft type match
  if (a.aircraftType && b.aircraftType && a.aircraftType === b.aircraftType) score += 0.1;
  weight += 0.1;
  return weight === 0 ? 0 : score / weight;
}

function mergeEvents(a: NormalizedEvent, b: NormalizedEvent): NormalizedEvent {
  return {
    ...a,
    // prefer non-empty fields from b
    category: b.category === 'unknown' ? a.category : b.category,
    aircraftType: b.aircraftType || a.aircraftType,
    operator: b.operator || a.operator,
    airportIcao: b.airportIcao || a.airportIcao,
    airportIata: b.airportIata || a.airportIata,
    country: b.country || a.country,
    region: b.region || a.region,
    lat: b.lat ?? a.lat,
    lon: b.lon ?? a.lon,
    summary: b.summary || a.summary,
    narrative: b.narrative || a.narrative,
    status: b.status || a.status,
    sources: [...a.sources, ...b.sources],
    causes: [...(a.causes ?? []), ...(b.causes ?? [])],
    updatedAt: new Date(Math.max(new Date(a.updatedAt).getTime(), new Date(b.updatedAt).getTime())).toISOString(),
  };
}
