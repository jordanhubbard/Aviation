import { EventRecord, ListEventsParams } from '../types.js';

const store: EventRecord[] = [];

function matches(record: EventRecord, params: ListEventsParams): boolean {
  if (params.category && params.category !== 'all' && record.category !== params.category) return false;
  if (params.airport && record.airportIcao !== params.airport && record.airportIata !== params.airport) return false;
  if (params.country && record.country !== params.country) return false;
  if (params.region && record.region !== params.region) return false;
  if (params.from && record.dateZ < params.from) return false;
  if (params.to && record.dateZ > params.to) return false;
  if (params.search) {
    const q = params.search.toLowerCase();
    const hay = [
      record.registration,
      record.operator,
      record.aircraftType,
      record.summary,
      record.narrative,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

export const memoryRepo = {
  upsert(event: EventRecord) {
    const idx = store.findIndex((r) => r.registration === event.registration && r.dateZ === event.dateZ);
    if (idx >= 0) {
      store[idx] = { ...store[idx], ...event, sources: event.sources };
    } else {
      store.push(event);
    }
  },

  list(params: ListEventsParams): { total: number; data: EventRecord[] } {
    const filtered = store.filter((r) => matches(r, params));
    const total = filtered.length;
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;
    const data = filtered
      .sort((a, b) => (a.dateZ < b.dateZ ? 1 : -1))
      .slice(offset, offset + limit);
    return { total, data };
  },

  get(id: string): EventRecord | undefined {
    return store.find((r) => r.id === id);
  },
};
