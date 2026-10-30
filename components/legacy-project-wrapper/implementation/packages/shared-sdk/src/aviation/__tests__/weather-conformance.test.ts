import { describe, expect, it } from 'vitest';
import { loadConformanceContract } from './conformance-contract.js';
import {
  WeatherCache,
  flightCategory,
  parseMetar,
  toWeatherData,
  warningsForConditions,
} from '../weather/index.js';

const contract = loadConformanceContract<any>('weather');

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
