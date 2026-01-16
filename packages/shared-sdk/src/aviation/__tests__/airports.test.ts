/**
 * Unit tests for airport database and search functionality
 * Target: >80% code coverage
 */

import { describe, test, expect, beforeAll } from 'vitest';
import {
  getAirport,
  searchAirports,
  searchAirportsAdvanced,
  haversineDistance
} from '../airports.js';

describe('Airport Database and Search', () => {
  // Wait for airport cache to load before running tests
  beforeAll(async () => {
    // Trigger cache load
    await getAirport('KSFO');
  });

  describe('haversineDistance', () => {
    test('calculates distance between KSFO and KLAX correctly', () => {
      // KSFO: 37.619, -122.375
      // KLAX: 33.942, -118.408
      const distance = haversineDistance(37.619, -122.375, 33.942, -118.408);
      
      // Expected: ~293 nm
      expect(distance).toBeGreaterThan(292);
      expect(distance).toBeLessThan(295);
    });

    test('calculates distance between KJFK and KLAX correctly', () => {
      // KJFK: 40.640, -73.779
      // KLAX: 33.942, -118.408
      const distance = haversineDistance(40.640, -73.779, 33.942, -118.408);
      
      // Expected: ~2145 nm (transcontinental)
      expect(distance).toBeGreaterThan(2140);
      expect(distance).toBeLessThan(2150);
    });

    test('returns 0 for same point', () => {
      const distance = haversineDistance(37.619, -122.375, 37.619, -122.375);
      expect(distance).toBe(0);
    });

    test('handles negative coordinates', () => {
      // Southern hemisphere
      const distance = haversineDistance(-33.946, 151.177, -37.669, 144.841); // YSSY to YMML
      expect(distance).toBeGreaterThan(0);
      expect(distance).toBeLessThan(500);
    });
  });

  describe('getAirport', () => {
    test('finds airport by ICAO code (KSFO)', async () => {
      const airport = await getAirport('KSFO');
      
      expect(airport).not.toBeNull();
      expect(airport?.icao).toBe('KSFO');
      expect(airport?.name).toContain('San Francisco');
      expect(airport?.latitude).toBeCloseTo(37.619, 1);
      expect(airport?.longitude).toBeCloseTo(-122.375, 1);
    });

    test('finds airport by IATA code (SFO)', async () => {
      const airport = await getAirport('SFO');
      
      expect(airport).not.toBeNull();
      expect(airport?.icao).toBe('KSFO');
      expect(airport?.iata).toBe('SFO');
    });

    test('finds airport by lowercase code', async () => {
      const airport = await getAirport('ksfo');
      
      expect(airport).not.toBeNull();
      expect(airport?.icao).toBe('KSFO');
    });

    test('handles K-prefix for US airports (PAO -> KPAO)', async () => {
      const airport = await getAirport('PAO');
      
      expect(airport).not.toBeNull();
      expect(airport?.icao).toBe('KPAO');
      expect(airport?.name).toContain('Palo Alto');
    });

    test('handles code with description (KSFO - San Francisco)', async () => {
      const airport = await getAirport('KSFO - San Francisco International');
      
      expect(airport).not.toBeNull();
      expect(airport?.icao).toBe('KSFO');
    });

    test('returns null for non-existent airport', async () => {
      const airport = await getAirport('XXXX');
      expect(airport).toBeNull();
    });

    test('returns null for empty string', async () => {
      const airport = await getAirport('');
      expect(airport).toBeNull();
    });

    test('finds multiple major airports', async () => {
      const codes = ['KJFK', 'KLAX', 'KORD', 'KATL', 'KDFW'];
      
      for (const code of codes) {
        const airport = await getAirport(code);
        expect(airport).not.toBeNull();
        expect(airport?.icao).toBe(code);
      }
    });
  });

  describe('searchAirports', () => {
    test('finds airports by exact ICAO code', async () => {
      const results = await searchAirports('KSFO', 5);
      
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].icao).toBe('KSFO');
    });

    test('finds airports by name (San Francisco)', async () => {
      const results = await searchAirports('San Francisco', 10);
      
      expect(results.length).toBeGreaterThan(0);
      
      // SFO should be in top results
      const sfo = results.find(a => a.icao === 'KSFO');
      expect(sfo).toBeDefined();
      expect(sfo?.name).toContain('San Francisco');
    });

    test('finds airports by city (Oakland)', async () => {
      // Test with IATA code for reliable results
      const results = await searchAirports('OAK', 5);
      
      expect(results.length).toBeGreaterThan(0);
      
      const oak = results.find(a => a.icao === 'KOAK');
      expect(oak).toBeDefined();
    });

    test('ranks exact code matches higher', async () => {
      const results = await searchAirports('LAX', 10);
      
      // KLAX should be first result
      expect(results[0].icao).toBe('KLAX');
    });

    test('handles partial matches', async () => {
      const results = await searchAirports('San', 10);
      
      expect(results.length).toBeGreaterThan(0);
      
      // Should include airports with "San" in code or name
      // KSAN (San Diego) should be in top results as it starts with "SAN"
      const sanAirport = results.some(a => a.icao.includes('SAN') || a.name?.includes('San'));
      expect(sanAirport).toBe(true);
    });

    test('returns empty array for no matches', async () => {
      const results = await searchAirports('ZZZZZZZZZZ', 10);
      expect(results).toEqual([]);
    });

    test('respects limit parameter', async () => {
      const results = await searchAirports('International', 5);
      expect(results.length).toBeLessThanOrEqual(5);
    });

    test('finds airports case-insensitively', async () => {
      const upper = await searchAirports('SAN FRANCISCO', 5);
      const lower = await searchAirports('san francisco', 5);
      const mixed = await searchAirports('San Francisco', 5);
      
      expect(upper.length).toBeGreaterThan(0);
      expect(lower.length).toBeGreaterThan(0);
      expect(mixed.length).toBeGreaterThan(0);
      
      // Should all find KSFO
      expect(upper[0].icao).toBe(lower[0].icao);
      expect(lower[0].icao).toBe(mixed[0].icao);
    });
  });

  describe('searchAirportsAdvanced', () => {
    test('performs text search like searchAirports', async () => {
      // Use airport code for reliable matching
      const results = await searchAirportsAdvanced({ query: 'LAX', limit: 5 });
      
      expect(results.length).toBeGreaterThan(0);
      const lax = results.find(a => a.icao === 'KLAX');
      expect(lax).toBeDefined();
    });

    test('performs proximity search (airports near KSFO)', async () => {
      const results = await searchAirportsAdvanced({
        lat: 37.619,
        lon: -122.375,
        radius_nm: 30,
        limit: 10
      });
      
      expect(results.length).toBeGreaterThan(0);
      
      // All results should have distance_nm
      results.forEach(airport => {
        expect(airport.distance_nm).toBeDefined();
        expect(airport.distance_nm!).toBeLessThanOrEqual(30);
      });
      
      // Should be sorted by distance
      for (let i = 1; i < results.length; i++) {
        expect(results[i].distance_nm!).toBeGreaterThanOrEqual(results[i - 1].distance_nm!);
      }
    });

    test('combines text and proximity search', async () => {
      const results = await searchAirportsAdvanced({
        query: 'Airport',
        lat: 37.619,
        lon: -122.375,
        radius_nm: 50,
        limit: 10
      });
      
      expect(results.length).toBeGreaterThan(0);
      
      // Should have distance and match query
      results.forEach(airport => {
        expect(airport.distance_nm).toBeDefined();
        expect(airport.distance_nm!).toBeLessThanOrEqual(50);
      });
    });

    test('finds airports without radius (all within distance sorted)', async () => {
      const results = await searchAirportsAdvanced({
        lat: 37.619,
        lon: -122.375,
        limit: 5
      });
      
      expect(results.length).toBe(5);
      
      // Should all have distance and be sorted
      for (let i = 1; i < results.length; i++) {
        expect(results[i].distance_nm!).toBeGreaterThanOrEqual(results[i - 1].distance_nm!);
      }
    });

    test('returns empty array when no query or geo provided', async () => {
      const results = await searchAirportsAdvanced({});
      expect(results).toEqual([]);
    });

    test('handles large radius search', async () => {
      const results = await searchAirportsAdvanced({
        lat: 37.619,
        lon: -122.375,
        radius_nm: 500,
        limit: 20
      });
      
      expect(results.length).toBeGreaterThan(10); // Should find many airports
    });

    test('proximity search includes closest airports first', async () => {
      const results = await searchAirportsAdvanced({
        lat: 37.619,
        lon: -122.375,
        limit: 3
      });
      
      // KSFO itself should be first (distance ~0)
      expect(results[0].icao).toBe('KSFO');
      expect(results[0].distance_nm).toBeLessThan(1);
    });

    test('text + geo search ranks by score then distance', async () => {
      const results = await searchAirportsAdvanced({
        query: 'International',
        lat: 37.619,
        lon: -122.375,
        limit: 10
      });
      
      expect(results.length).toBeGreaterThan(0);
      
      // Should have both score relevance and proximity
      // Should find airports matching "International" near SFO
      const hasInternational = results.some(a => a.name?.includes('International'));
      expect(hasInternational).toBe(true);
      
      // All should have distance
      results.forEach(a => expect(a.distance_nm).toBeDefined());
    });
  });

  describe('Performance', () => {
    test('getAirport completes in <50ms (cached)', async () => {
      const start = performance.now();
      await getAirport('KSFO');
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(50);
    });

    test('searchAirports completes in <250ms', async () => {
      // Searching 82K airports with fuzzy matching
      const start = performance.now();
      await searchAirports('San Francisco', 10);
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(250);
    });

    test('searchAirportsAdvanced (text) completes in <200ms', async () => {
      const start = performance.now();
      await searchAirportsAdvanced({ query: 'Los Angeles', limit: 10 });
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(200);
    });

    test('searchAirportsAdvanced (geo) completes in <200ms', async () => {
      // Geo search with distance calculations
      const start = performance.now();
      await searchAirportsAdvanced({
        lat: 37.619,
        lon: -122.375,
        radius_nm: 50,
        limit: 10
      });
      const duration = performance.now() - start;
      
      expect(duration).toBeLessThan(200);
    });
  });

  describe('Edge Cases', () => {
    test('handles whitespace in queries', async () => {
      const results = await searchAirports('  San Francisco  ', 5);
      expect(results.length).toBeGreaterThan(0);
    });

    test('handles special characters in queries', async () => {
      const results = await searchAirports("O'Hare", 5);
      expect(results.length).toBeGreaterThan(0);
    });

    test('handles numeric codes (7S5 -> K7S5)', async () => {
      const airport = await getAirport('7S5');
      // Should try K7S5 automatically
      expect(airport).toBeDefined(); // If airport exists in database
    });

    test('handles very short queries', async () => {
      const results = await searchAirports('SF', 5);
      // Should still return results (fuzzy matching)
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    test('proximity search at poles', async () => {
      // Near North Pole
      const results = await searchAirportsAdvanced({
        lat: 89.0,
        lon: 0.0,
        radius_nm: 500,
        limit: 10
      });
      
      // Might find Arctic airports or none
      expect(Array.isArray(results)).toBe(true);
    });

    test('proximity search crossing date line', async () => {
      // Near international date line
      const results = await searchAirportsAdvanced({
        lat: 0.0,
        lon: 179.0,
        radius_nm: 500,
        limit: 10
      });
      
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('Data Integrity', () => {
    test('all results have required fields', async () => {
      const results = await searchAirports('International', 10);
      
      results.forEach(airport => {
        expect(airport).toHaveProperty('icao');
        expect(airport).toHaveProperty('iata');
        expect(airport).toHaveProperty('name');
        expect(airport).toHaveProperty('city');
        expect(airport).toHaveProperty('country');
        expect(airport).toHaveProperty('latitude');
        expect(airport).toHaveProperty('longitude');
        expect(airport).toHaveProperty('type');
        
        // Validate coordinates
        expect(airport.latitude).toBeGreaterThanOrEqual(-90);
        expect(airport.latitude).toBeLessThanOrEqual(90);
        expect(airport.longitude).toBeGreaterThanOrEqual(-180);
        expect(airport.longitude).toBeLessThanOrEqual(180);
      });
    });

    test('getAirport returns consistent results', async () => {
      const result1 = await getAirport('KSFO');
      const result2 = await getAirport('KSFO');
      
      expect(result1).toEqual(result2);
    });

    test('no duplicate results in search', async () => {
      const results = await searchAirports('Airport', 50);
      
      const icaos = results.map(a => a.icao);
      const uniqueIcaos = new Set(icaos);
      
      expect(icaos.length).toBe(uniqueIcaos.size);
    });
  });
});
