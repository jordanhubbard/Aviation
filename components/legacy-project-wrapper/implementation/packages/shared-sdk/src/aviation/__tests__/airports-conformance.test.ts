import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { normalizeAirportRecords } from '../airports/bundled.js';
import {
  findAirport,
  loadAirportData,
  searchAirportsAdvanced,
} from '../airports/index.js';

interface AirportVector {
  id: string;
  operation: 'normalized_count' | 'lookup' | 'search_codes' | 'nearby';
  args?: unknown[];
  expected: unknown;
}

interface AirportContract {
  schema: string;
  dataset: Array<Record<string, unknown>>;
  vectors: AirportVector[];
}

const vectorsPath = fileURLToPath(new URL(
  '../../../../../../../../components/aviation-airports/acceptance/vectors.json',
  import.meta.url,
));
const contract = JSON.parse(readFileSync(vectorsPath, 'utf8')) as AirportContract;
const normalized = normalizeAirportRecords(contract.dataset);

describe('aviation.airports Component conformance', () => {
  beforeAll(() => loadAirportData(normalized, false));

  it('uses the versioned Component-owned vector schema', () => {
    expect(contract.schema).toBe('aviation/airports-acceptance-vectors@1');
    expect(contract.vectors.length).toBeGreaterThan(0);
  });

  for (const vector of contract.vectors) {
    it(vector.id, () => {
      const args = vector.args ?? [];
      if (vector.operation === 'normalized_count') {
        expect(normalized.length).toBe(vector.expected);
        return;
      }
      if (vector.operation === 'lookup') {
        const airport = findAirport(String(args[0]));
        const actual = airport
          ? { icao: airport.icao, elevation: airport.elevation ?? null }
          : null;
        expect(actual).toEqual(vector.expected);
        return;
      }
      if (vector.operation === 'search_codes') {
        const actual = searchAirportsAdvanced({
          query: String(args[0]),
          limit: Number(args[1]),
        }).map((airport) => airport.icao);
        expect(actual).toEqual(vector.expected);
        return;
      }

      const actual = searchAirportsAdvanced({
        lat: Number(args[0]),
        lon: Number(args[1]),
        radiusNm: Number(args[2]),
        limit: Number(args[3]),
      });
      const expected = vector.expected as Array<{
        icao: string;
        distance_nm: number;
        absolute_tolerance: number;
      }>;
      expect(actual.map((airport) => airport.icao)).toEqual(
        expected.map((airport) => airport.icao),
      );
      actual.forEach((airport, index) => {
        expect(Math.abs(airport.distance_nm! - expected[index].distance_nm))
          .toBeLessThanOrEqual(expected[index].absolute_tolerance);
      });
    });
  }
});
