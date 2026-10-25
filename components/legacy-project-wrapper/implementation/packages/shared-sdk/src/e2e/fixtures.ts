import { type E2ERunId, tagTestData } from './index.js';

/** Deterministic aviation fixtures; every record carries database isolation columns. */
export function standardE2EFixtures(runId: E2ERunId) {
  const tag = <T extends object>(value: T) => tagTestData(runId, value);
  return {
    aircraft: tag({ registration: 'N123ET', type_code: 'C172', empty_weight_lb: 1500, empty_arm_in: 39 }),
    airport: tag({ icao: 'KOAK', name: 'Oakland International', elevation_ft: 9 }),
    weather: tag({ station: 'KOAK', raw_metar: 'KOAK 241953Z 28008KT 10SM FEW020 18/10 A3002' }),
    mission: tag({ title: `E2E mission ${runId}`, category: 'Training', objective: 'Practice a local pattern' }),
    accident: tag({ dateZ: '2026-10-20T00:00:00Z', registration: 'N123ET', category: 'general',
      country: 'USA', region: 'CA', lat: 37.721, lon: -122.221,
      summary: 'Synthetic E2E event',
      sources: [{ sourceName: 'e2e-fixture', url: `https://example.invalid/e2e/${runId}`,
        fetchedAt: '2026-10-20T00:00:00Z' }] }),
    flight: tag({ registration: 'N123ET', from: 'KOAK', to: 'KSFO', total_hours: 0.5 }),
    track: tag({ registration: 'N123ET', points: [[37.721, -122.221, 1200], [37.73, -122.23, 1500]] }),
  };
}

/** External responses are inert and carry the same run tag as database fixtures. */
export function standardE2EMocks(runId: E2ERunId) {
  const tag = <T extends object>(value: T) => tagTestData(runId, value);
  return {
    weather: tag({ station: 'KOAK', metar: 'KOAK 241953Z 28008KT 10SM FEW020 18/10 A3002',
      taf: 'TAF KOAK 241720Z 2418/2518 28008KT P6SM FEW020' }),
    notams: tag({ station: 'KOAK', items: [] as object[] }),
    airportSearch: tag({ query: 'Oakland', results: [{ icao: 'KOAK', name: 'Oakland International' }] }),
    ai: tag({ answer: 'Synthetic E2E response; no external model was called.' }),
    githubIssue: tag({ number: 100000, url: `https://example.invalid/e2e/${runId}/issue/100000` }),
  };
}
