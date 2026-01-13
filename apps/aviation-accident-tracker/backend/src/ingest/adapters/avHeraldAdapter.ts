import { RawEvent } from '../types.js';

// Minimal placeholder adapter that returns a couple of recent-style records.
// Real implementation would fetch/par​se AVHerald HTML/feeds.
export async function fetchRecentAvHerald(): Promise<RawEvent[]> {
  const now = new Date().toISOString();
  return [
    {
      source: 'avherald',
      id: 'avherald-sample-1',
      url: 'https://avherald.com/sample/1',
      fetchedAt: now,
      dateZ: now,
      registration: 'JA-TEST',
      aircraftType: 'B789',
      operator: 'Asia Air',
      country: 'JP',
      summary: 'Placeholder AVHerald record',
      narrative: 'Placeholder ingestion; replace with real parsed data.',
      status: 'preliminary',
    },
  ];
}
