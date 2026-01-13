import { RawEvent } from '../types.js';

// Minimal placeholder adapter that returns a couple of recent-style records.
// Real implementation would fetch/par​se ASN HTML/JSON.
export async function fetchRecentAsn(): Promise<RawEvent[]> {
  const now = new Date().toISOString();
  return [
    {
      source: 'asn',
      id: 'asn-sample-1',
      url: 'https://aviation-safety.net/sample/1',
      fetchedAt: now,
      dateZ: now,
      registration: 'N123AB',
      aircraftType: 'B738',
      operator: 'Sample Air',
      country: 'US',
      summary: 'Placeholder ASN record',
      narrative: 'Placeholder ingestion; replace with real parsed data.',
      status: 'preliminary',
    },
    {
      source: 'asn',
      id: 'asn-sample-2',
      url: 'https://aviation-safety.net/sample/2',
      fetchedAt: now,
      dateZ: now,
      registration: 'G-TEST',
      aircraftType: 'A320',
      operator: 'Example Airways',
      country: 'GB',
      summary: 'Second placeholder ASN record',
      narrative: 'Placeholder ingestion; replace with real parsed data.',
      status: 'preliminary',
    },
  ];
}
