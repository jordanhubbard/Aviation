/**
 * Tests for Airport Cache
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AirportCache } from '../cache';

interface TestItem {
  id: string;
  value: string;
}

describe('AirportCache', () => {
  let cache: AirportCache<TestItem>;

  beforeEach(() => {
    cache = new AirportCache<TestItem>(3); // Small cache for testing
  });

  describe('Basic operations', () => {
    it('should store and retrieve values', () => {
      const item = { id: 'KSFO', value: 'San Francisco' };
      cache.set('KSFO', item);
      
      const retrieved = cache.get('KSFO');
      expect(retrieved).toEqual(item);
    });

    it('should return null for non-existent keys', () => {
      const result = cache.get('NONEXISTENT');
      expect(result).toBeNull();
    });

    it('should check if key exists', () => {
      cache.set('KSFO', { id: 'KSFO', value: 'San Francisco' });
      
      expect(cache.has('KSFO')).toBe(true);
      expect(cache.has('KJFK')).toBe(false);
    });

    it('should clear all entries', () => {
      cache.set('KSFO', { id: 'KSFO', value: 'San Francisco' });
      cache.set('KJFK', { id: 'KJFK', value: 'New York' });
      
      expect(cache.size()).toBe(2);
      
      cache.clear();
      
      expect(cache.size()).toBe(0);
      expect(cache.get('KSFO')).toBeNull();
    });
  });

  describe('LRU eviction', () => {
    it('should evict least recently used item when cache is full', () => {
      cache.set('A', { id: 'A', value: 'First' });
      cache.set('B', { id: 'B', value: 'Second' });
      cache.set('C', { id: 'C', value: 'Third' });
      
      expect(cache.size()).toBe(3);
      
      // Adding fourth item should evict 'A' (least recently used)
      cache.set('D', { id: 'D', value: 'Fourth' });
      
      expect(cache.size()).toBe(3);
      expect(cache.get('A')).toBeNull(); // Evicted
      expect(cache.get('B')).not.toBeNull();
      expect(cache.get('C')).not.toBeNull();
      expect(cache.get('D')).not.toBeNull();
    });

    it('should move accessed items to end (most recently used)', () => {
      cache.set('A', { id: 'A', value: 'First' });
      cache.set('B', { id: 'B', value: 'Second' });
      cache.set('C', { id: 'C', value: 'Third' });
      
      // Access 'A' to move it to end
      cache.get('A');
      
      // Adding fourth item should evict 'B' (now least recently used)
      cache.set('D', { id: 'D', value: 'Fourth' });
      
      expect(cache.get('A')).not.toBeNull(); // Still there
      expect(cache.get('B')).toBeNull(); // Evicted
      expect(cache.get('C')).not.toBeNull();
      expect(cache.get('D')).not.toBeNull();
    });
  });

  describe('Statistics', () => {
    it('should track cache hits and misses', () => {
      cache.set('A', { id: 'A', value: 'First' });
      
      cache.get('A'); // Hit
      cache.get('A'); // Hit
      cache.get('B'); // Miss
      cache.get('C'); // Miss
      
      const stats = cache.getStatistics();
      
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBe(50); // 50%
    });

    it('should track evictions', () => {
      cache.set('A', { id: 'A', value: 'First' });
      cache.set('B', { id: 'B', value: 'Second' });
      cache.set('C', { id: 'C', value: 'Third' });
      cache.set('D', { id: 'D', value: 'Fourth' }); // Evicts A
      cache.set('E', { id: 'E', value: 'Fifth' }); // Evicts B
      
      const stats = cache.getStatistics();
      
      expect(stats.evictions).toBe(2);
    });

    it('should reset statistics without clearing cache', () => {
      cache.set('A', { id: 'A', value: 'First' });
      cache.get('A'); // Hit
      cache.get('B'); // Miss
      
      expect(cache.getStatistics().hits).toBe(1);
      expect(cache.getStatistics().misses).toBe(1);
      
      cache.resetStatistics();
      
      expect(cache.getStatistics().hits).toBe(0);
      expect(cache.getStatistics().misses).toBe(0);
      expect(cache.get('A')).not.toBeNull(); // Cache still has data
    });
  });

  describe('Batch operations', () => {
    it('should get multiple values', () => {
      cache.set('A', { id: 'A', value: 'First' });
      cache.set('B', { id: 'B', value: 'Second' });
      cache.set('C', { id: 'C', value: 'Third' });
      
      const results = cache.getMany(['A', 'B', 'D']); // D doesn't exist
      
      expect(results.size).toBe(2);
      expect(results.get('A')).toEqual({ id: 'A', value: 'First' });
      expect(results.get('B')).toEqual({ id: 'B', value: 'Second' });
      expect(results.has('D')).toBe(false);
    });

    it('should set multiple values', () => {
      const entries = new Map<string, TestItem>();
      entries.set('A', { id: 'A', value: 'First' });
      entries.set('B', { id: 'B', value: 'Second' });
      
      cache.setMany(entries);
      
      expect(cache.get('A')).toEqual({ id: 'A', value: 'First' });
      expect(cache.get('B')).toEqual({ id: 'B', value: 'Second' });
    });
  });

  describe('Cache warming', () => {
    it('should warm cache with data', () => {
      const airports = [
        { id: '1', icao: 'KSFO', iata: 'SFO', name: 'San Francisco' },
        { id: '2', icao: 'KJFK', iata: 'JFK', name: 'New York' },
      ];
      
      cache.warm(airports as any, (airport: any) => [airport.icao, airport.iata]);
      
      expect(cache.size()).toBeGreaterThan(0);
      expect(cache.get('KSFO')).toBeDefined();
      expect(cache.get('SFO')).toBeDefined();
      expect(cache.get('KJFK')).toBeDefined();
      expect(cache.get('JFK')).toBeDefined();
    });
  });

  describe('Most accessed items', () => {
    it('should return most accessed items', () => {
      cache.set('A', { id: 'A', value: 'First' });
      cache.set('B', { id: 'B', value: 'Second' });
      cache.set('C', { id: 'C', value: 'Third' });
      
      // Access items with different frequencies
      cache.get('A'); // 1
      cache.get('A'); // 2
      cache.get('A'); // 3
      cache.get('B'); // 1
      cache.get('B'); // 2
      cache.get('C'); // 1
      
      const mostAccessed = cache.getMostAccessed(2);
      
      expect(mostAccessed.length).toBe(2);
      expect(mostAccessed[0].key).toBe('A');
      expect(mostAccessed[0].accessCount).toBe(3);
      expect(mostAccessed[1].key).toBe('B');
      expect(mostAccessed[1].accessCount).toBe(2);
    });
  });
});
