import { describe, expect, it } from 'vitest';
import { loadConformanceContract } from './conformance-contract.js';
import {
  WeatherCache,
  AWCJSONError,
  fetchAWCJSONReports,
  flightCategory,
  parseMetar,
  toWeatherData,
  warningsForConditions,
} from '../weather/index.js';

const contract = loadConformanceContract<any>('weather');

describe('aviation.weather AWC JSON acquisition', () => {
  for (const vector of contract.awcRequests) {
    it(`request: ${vector.id}`, async () => {
      const calls: unknown[] = [];
      const result = await fetchAWCJSONReports(vector.product, vector.params, async (url, params) => {
        calls.push({ url, params }); return [];
      });
      expect(calls).toEqual([vector.expected]);
      expect(result).toEqual({ url: vector.expected.url, reports: [] });
    });
  }
  for (const vector of contract.awcInvalidRequests) {
    it(`rejects request before transport: ${vector.id}`, async () => {
      let calls = 0;
      await expect(fetchAWCJSONReports(vector.product, vector.params, async () => { calls++; return []; })).rejects.toMatchObject({ kind: 'request' });
      expect(calls).toBe(0);
    });
  }
  for (const vector of contract.awcResponses) {
    it(`preserves raw reports: ${vector.id}`, async () => {
      let calls = 0;
      const before = structuredClone(vector.payload);
      const result = await fetchAWCJSONReports('taf', { ids: 'KAAA' }, async () => { calls++; return vector.payload; });
      expect(calls).toBe(1);
      expect(result.reports).toEqual(before);
      expect(vector.payload).toEqual(before);
    });
  }
  for (const vector of contract.awcInvalidResponses) {
    it(`rejects invalid reports without retry: ${vector.id}`, async () => {
      let calls = 0;
      await expect(fetchAWCJSONReports('taf', { ids: 'KAAA' }, async () => { calls++; return vector.payload; })).rejects.toMatchObject({ kind: 'response' });
      expect(calls).toBe(1);
    });
  }
  it('hides transport failures and never retries', async () => {
    let calls = 0;
    try {
      await fetchAWCJSONReports('taf', { ids: 'KAAA' }, async () => { calls++; throw new Error('private-provider-url?credential=private'); });
      throw new Error('expected rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(AWCJSONError);
      expect(error).toMatchObject({ kind: 'provider', message: 'AWC JSON reports unavailable' });
      expect((error as Error).cause).toBeUndefined();
    }
    expect(calls).toBe(1);
  });
  for (const field of ['distance', 'age']) {
    for (const value of [NaN, Infinity, -Infinity]) {
      it(`rejects nonfinite ${field} ${value}`, async () => {
        let calls = 0;
        await expect(fetchAWCJSONReports('pirep', { id: 'KAAA', distance: 20, age: 3, [field]: value }, async () => { calls++; return []; })).rejects.toMatchObject({ kind: 'request' });
        expect(calls).toBe(0);
      });
    }
  }
});

describe('aviation.weather Component conformance', () => {
  it('uses the versioned Component-owned vector schema', () => {
    expect(contract.schema).toBe('aviation/weather-acceptance-vectors@1');
  });

  for (const vector of contract.metars) {
    it(`METAR: ${vector.id}`, () => {
      const parsed = parseMetar(vector.raw);
      const actual = Object.fromEntries(
        Object.keys(vector.expected).map((key) => [key, (parsed as any)[key] ?? null]),
      );
      expect(actual).toEqual(vector.expected);
    });
  }

  for (const vector of contract.categories) {
    it(`category: ${vector.id}`, () => {
      expect(flightCategory(vector.visibility_sm, vector.ceiling_ft)).toBe(vector.expected);
    });
  }

  for (const vector of contract.warnings) {
    it(`warnings: ${vector.id}`, () => {
      expect(warningsForConditions(
        vector.visibility_sm,
        vector.ceiling_ft,
        vector.wind_speed_kt,
      )).toEqual(vector.expected);
    });
  }

  for (const vector of contract.openweathermap) {
    it(`OpenWeatherMap: ${vector.id}`, () => {
      expect(toWeatherData(vector.airport, vector.payload)).toEqual(vector.expected);
    });
  }

  it('caches successful provider results within their TTL', async () => {
    const cache = new WeatherCache();
    let calls = 0;
    const fetchValue = async () => {
      calls += 1;
      return { observation: calls };
    };

    expect(await cache.getOrSet('station:KAAA', 300, fetchValue)).toEqual({ observation: 1 });
    expect(await cache.getOrSet('station:KAAA', 300, fetchValue)).toEqual({ observation: 1 });
    expect(calls).toBe(1);
  });

  it('returns a stale observation when an allowed refresh fails', async () => {
    const cache = new WeatherCache();
    cache.set('station:KAAA', { observation: 'last-good' }, -1);

    const result = await cache.getOrSet(
      'station:KAAA',
      300,
      async () => { throw new Error('provider unavailable'); },
      true,
    );
    expect(result).toEqual({ observation: 'last-good' });
  });
});
