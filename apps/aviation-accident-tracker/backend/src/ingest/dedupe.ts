import { NormalizedEvent } from './types.js';

export function dedupe(events: NormalizedEvent[]): NormalizedEvent[] {
  const seen = new Map<string, NormalizedEvent>();
  for (const ev of events) {
    const key = `${ev.dateZ}::${ev.registration}`;
    if (seen.has(key)) {
      // Merge sources; prefer newest updatedAt
      const existing = seen.get(key)!;
      const mergedSources = [...existing.sources, ...ev.sources];
      const newer = existing.updatedAt > ev.updatedAt ? existing.updatedAt : ev.updatedAt;
      seen.set(key, { ...existing, ...ev, sources: mergedSources, updatedAt: newer });
    } else {
      seen.set(key, ev);
    }
  }
  return Array.from(seen.values());
}
