/**
 * Unit tests for the airport database, lookup and search services.
 *
 * Exercises the canonical `aviation/airports` module against the packaged
 * dataset loaded via `aviation/airports/bundled`.
 */

import { describe, test, expect, beforeAll } from 'vitest';
import {
  findAirport,
  findAirportRequired,
  findAirportsNearby,
  findNearestAirport,
  searchAirports,
  searchAirportsAdvanced,
  getAirportDatabase,
  clearAirportCache,
  getAirportCacheStats,
  AirportNotFoundError,
} from '../airports/index.js';
import { loadBundledAirports } from '../airports/bundled.js';

describe('Airport Database and Search', () => {
  beforeAll(() => {
    loadBundledAirports();
  });

  describe('dataset loading', () => {
    test('loads the packaged dataset', () => {
      expect(getAirportDatabase().length).toBeGreaterThan(50000);
    });

    test('loading is idempotent', () => {
      const before = getAirportDatabase().length;
      loadBundledAirports();
      expect(getAirportDatabase().length).toBe(before);
    });
  });

  describe('findAirport', () => {
    test('finds airport by ICAO code', () => {
      const sfo = findAirport('KSFO');
      expect(sfo).toBeDefined();
      expect(sfo?.icao).toBe('KSFO');
      expect(sfo?.name).toMatch(/San Francisco/i);
    });

    test('finds airport by IATA code', () => {
      expect(findAirport('SFO')?.icao).toBe('KSFO');
    });

    test('is case insensitive', () => {
      expect(findAirport('ksfo')?.icao).toBe('KSFO');
    });

    test('handles K-prefix for US local identifiers', () => {
      expect(findAirport('PAO')?.icao).toBe('KPAO');
    });

    test('handles numeric US identifiers', () => {
      expect(findAirport('7S5')?.icao).toBe('K7S5');
    });

    test('returns undefined for a non-existent code', () => {
      expect(findAirport('ZZZZ')).toBeUndefined();
    });

    test('returns undefined for an empty code', () => {
      expect(findAirport('')).toBeUndefined();
    });

    test('finds several major airports', () => {
      for (const code of ['KJFK', 'KLAX', 'KORD', 'EGLL']) {
        expect(findAirport(code)?.icao, `expected ${code}`).toBe(code);
      }
    });

    test('findAirportRequired throws for unknown codes', () => {
      expect(() => findAirportRequired('ZZZZ')).toThrow(AirportNotFoundError);
    });

    test('findAirportRequired returns the airport when present', () => {
      expect(findAirportRequired('KSFO').icao).toBe('KSFO');
    });
  });

  describe('searchAirports', () => {
    test('finds airports by name', () => {
      expect(searchAirports('San Francisco', 5).length).toBeGreaterThan(0);
    });

    test('respects the limit parameter', () => {
      expect(searchAirports('International', 3).length).toBeLessThanOrEqual(3);
    });

    test('returns an empty array for no matches', () => {
      expect(searchAirports('zzzznomatch', 5)).toEqual([]);
    });

    test('returns an empty array for an empty query', () => {
      expect(searchAirports('', 5)).toEqual([]);
    });
  });

  describe('searchAirportsAdvanced', () => {
    test('ranks an exact code match first', () => {
      expect(searchAirportsAdvanced({ query: 'KSFO', limit: 5 })[0].icao).toBe('KSFO');
    });

    test('trims whitespace in the query', () => {
      expect(searchAirportsAdvanced({ query: '  KSFO  ', limit: 2 })[0].icao).toBe('KSFO');
    });

    test('is case insensitive', () => {
      expect(searchAirportsAdvanced({ query: 'ksfo', limit: 2 })[0].icao).toBe('KSFO');
    });

    test('performs proximity search sorted nearest first', () => {
      const near = searchAirportsAdvanced({ lat: 37.619, lon: -122.375, radiusNm: 30, limit: 10 });
      expect(near.length).toBeGreaterThan(1);
      expect(near[0].icao).toBe('KSFO');
      for (let i = 1; i < near.length; i++) {
        expect(near[i].distance_nm!).toBeGreaterThanOrEqual(near[i - 1].distance_nm!);
      }
    });

    test('annotates distance_nm only for proximity searches', () => {
      expect(searchAirportsAdvanced({ lat: 37.619, lon: -122.375, radiusNm: 10 })[0].distance_nm)
        .toBeTypeOf('number');
      expect(searchAirportsAdvanced({ query: 'KSFO', limit: 1 })[0].distance_nm).toBeUndefined();
    });

    test('honours the radius filter', () => {
      const results = searchAirportsAdvanced({ lat: 37.619, lon: -122.375, radiusNm: 15 });
      expect(results.length).toBeGreaterThan(0);
      for (const r of results) {
        expect(r.distance_nm!).toBeLessThanOrEqual(15);
      }
    });

    test('combines text and proximity search', () => {
      const results = searchAirportsAdvanced({
        query: 'international',
        lat: 37.619,
        lon: -122.375,
        radiusNm: 100,
        limit: 5,
      });
      expect(results.length).toBeGreaterThan(0);
      for (const r of results) {
        expect(r.distance_nm!).toBeLessThanOrEqual(100);
      }
    });

    test('returns an empty array when neither query nor origin is given', () => {
      expect(searchAirportsAdvanced({})).toEqual([]);
    });

    test('respects the limit parameter', () => {
      expect(searchAirportsAdvanced({ query: 'airport', limit: 4 }).length).toBeLessThanOrEqual(4);
    });

    test('returns no duplicate codes', () => {
      const results = searchAirportsAdvanced({ query: 'international', limit: 25 });
      const codes = results.map((r) => r.icao);
      expect(new Set(codes).size).toBe(codes.length);
    });

    test('handles proximity search near the poles', () => {
      expect(() =>
        searchAirportsAdvanced({ lat: 89.9, lon: 0, radiusNm: 500, limit: 3 })
      ).not.toThrow();
    });

    test('handles proximity search across the date line', () => {
      const results = searchAirportsAdvanced({ lat: 0, lon: 179.9, radiusNm: 300, limit: 3 });
      for (const r of results) {
        expect(r.distance_nm!).toBeLessThanOrEqual(300);
      }
    });

    test('handles special characters without throwing', () => {
      expect(() => searchAirportsAdvanced({ query: "!@#$%^&*()", limit: 3 })).not.toThrow();
    });
  });

  describe('proximity helpers', () => {
    test('findAirportsNearby returns airports within the radius', () => {
      const nearby = findAirportsNearby(37.619, -122.375, 50, 10);
      expect(nearby.length).toBeGreaterThan(0);
    });

    test('findNearestAirport finds KSFO from its own coordinates', () => {
      expect(findNearestAirport(37.619, -122.375)?.icao).toBe('KSFO');
    });
  });

  describe('data integrity', () => {
    test('results carry the required fields', () => {
      for (const airport of searchAirportsAdvanced({ query: 'international', limit: 10 })) {
        expect(airport.icao).toBeTruthy();
        expect(typeof airport.latitude).toBe('number');
        expect(typeof airport.longitude).toBe('number');
        expect(airport.latitude).toBeGreaterThanOrEqual(-90);
        expect(airport.latitude).toBeLessThanOrEqual(90);
        expect(airport.longitude).toBeGreaterThanOrEqual(-180);
        expect(airport.longitude).toBeLessThanOrEqual(180);
      }
    });

    test('lookups are stable across repeated calls', () => {
      expect(findAirport('KSFO')).toEqual(findAirport('KSFO'));
    });
  });

  describe('caching and performance', () => {
    test('findAirport is fast once warmed', () => {
      findAirport('KSFO');
      const start = performance.now();
      findAirport('KSFO');
      expect(performance.now() - start).toBeLessThan(50);
    });

    test('searchAirportsAdvanced text search completes promptly', () => {
      const start = performance.now();
      searchAirportsAdvanced({ query: 'Los Angeles', limit: 10 });
      expect(performance.now() - start).toBeLessThan(1000);
    });

    test('searchAirportsAdvanced geo search completes promptly', () => {
      const start = performance.now();
      searchAirportsAdvanced({ lat: 37.619, lon: -122.375, radiusNm: 100, limit: 10 });
      expect(performance.now() - start).toBeLessThan(1000);
    });

    test('cache statistics are reported', () => {
      findAirport('KSFO');
      expect(getAirportCacheStats().codeCache).toBeDefined();
    });

    test('clearAirportCache empties the caches without losing data', () => {
      clearAirportCache();
      expect(findAirport('KSFO')?.icao).toBe('KSFO');
    });
  });
});
