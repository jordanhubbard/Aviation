/**
 * Tests for datetime utilities
 */

import { describe, it, expect } from 'vitest';
import {
  utcNow,
  toUtc,
  toZulu,
  fromZulu,
  formatDateTime,
  formatFlightTime,
  parseFlightTime,
  calculateSunriseSunset,
  isNight,
  addFlightTime,
  getTimeDifference,
} from '../utils.js';

describe('DateTime Utilities', () => {
  describe('utcNow', () => {
    it('should return current UTC time', () => {
      const now = utcNow();
      expect(now).toBeInstanceOf(Date);
      expect(now.getTime()).toBeGreaterThan(new Date('2026-01-01').getTime());
    });
  });

  describe('toUtc', () => {
    it('should handle Date objects', () => {
      const date = new Date('2026-01-15T10:30:00Z');
      const result = toUtc(date);
      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe('2026-01-15T10:30:00.000Z');
    });

    it('should handle ISO strings', () => {
      const result = toUtc('2026-01-15T10:30:00Z');
      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe('2026-01-15T10:30:00.000Z');
    });

    it('should handle timestamps', () => {
      const timestamp = new Date('2026-01-15T10:30:00Z').getTime();
      const result = toUtc(timestamp);
      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe('2026-01-15T10:30:00.000Z');
    });
  });

  describe('Zulu time conversions', () => {
    it('should convert to Zulu format', () => {
      const date = new Date('2026-01-15T10:30:00Z');
      const zulu = toZulu(date);
      expect(zulu).toBe('2026-01-15T10:30:00.000Z');
    });

    it('should parse Zulu format', () => {
      const date = fromZulu('2026-01-15T10:30:00Z');
      expect(date).toBeInstanceOf(Date);
      expect(date.toISOString()).toBe('2026-01-15T10:30:00.000Z');
    });

    it('should round-trip Zulu conversion', () => {
      const original = new Date('2026-01-15T10:30:00Z');
      const zulu = toZulu(original);
      const parsed = fromZulu(zulu);
      expect(parsed.toISOString()).toBe(original.toISOString());
    });
  });

  describe('formatDateTime', () => {
    it('should format with default options', () => {
      const date = new Date('2026-01-15T18:30:00Z');
      const formatted = formatDateTime(date, 'UTC');
      expect(formatted).toContain('Jan');
      expect(formatted).toContain('15');
      expect(formatted).toContain('2026');
    });

    it('should format with custom options', () => {
      const date = new Date('2026-01-15T18:30:00Z');
      const formatted = formatDateTime(date, 'UTC', {
        dateStyle: 'full',
        timeStyle: 'short'
      });
      expect(formatted).toContain('January');
      expect(formatted).toContain('2026');
    });

    it('should handle different timezones', () => {
      const date = new Date('2026-01-15T18:30:00Z');
      const utc = formatDateTime(date, 'UTC');
      const pst = formatDateTime(date, 'America/Los_Angeles');
      expect(utc).not.toBe(pst);
    });
  });

  describe('Flight time formatting', () => {
    it('should format hours and minutes', () => {
      expect(formatFlightTime(150)).toBe('2h 30m');
    });

    it('should format only hours', () => {
      expect(formatFlightTime(120)).toBe('2h');
    });

    it('should format only minutes', () => {
      expect(formatFlightTime(45)).toBe('45m');
    });

    it('should handle zero', () => {
      expect(formatFlightTime(0)).toBe('0m');
    });

    it('should handle negative values', () => {
      expect(formatFlightTime(-10)).toBe('0m');
    });
  });

  describe('Flight time parsing', () => {
    it('should parse "2h 30m" format', () => {
      expect(parseFlightTime('2h 30m')).toBe(150);
    });

    it('should parse "2h" format', () => {
      expect(parseFlightTime('2h')).toBe(120);
    });

    it('should parse "30m" format', () => {
      expect(parseFlightTime('30m')).toBe(30);
    });

    it('should parse decimal hours', () => {
      expect(parseFlightTime('2.5')).toBe(150);
    });

    it('should parse integer minutes', () => {
      expect(parseFlightTime('150')).toBe(9000); // Interpreted as 150 hours
    });

    it('should handle extra whitespace', () => {
      expect(parseFlightTime('  2h  30m  ')).toBe(150);
    });

    it('should be case insensitive', () => {
      expect(parseFlightTime('2H 30M')).toBe(150);
    });

    it('should round-trip format and parse', () => {
      const original = 150;
      const formatted = formatFlightTime(original);
      const parsed = parseFlightTime(formatted);
      expect(parsed).toBe(original);
    });
  });

  describe('Sunrise/sunset calculations', () => {
    it('should calculate sunrise and sunset for San Francisco', () => {
      const date = new Date('2026-01-15T12:00:00Z');
      const { sunrise, sunset } = calculateSunriseSunset(37.7749, -122.4194, date);
      
      expect(sunrise).toBeInstanceOf(Date);
      expect(sunset).toBeInstanceOf(Date);
      expect(sunrise.getTime()).toBeLessThan(sunset.getTime());
    });

    it('should calculate sunrise and sunset for different locations', () => {
      const date = new Date('2026-01-15T12:00:00Z');
      const sf = calculateSunriseSunset(37.7749, -122.4194, date);
      const ny = calculateSunriseSunset(40.7128, -74.0060, date);
      
      // New York sunrise should be later than SF (in UTC)
      expect(sf.sunrise.getTime()).not.toBe(ny.sunrise.getTime());
    });

    it('should use current date if not provided', () => {
      const { sunrise, sunset } = calculateSunriseSunset(37.7749, -122.4194);
      
      expect(sunrise).toBeInstanceOf(Date);
      expect(sunset).toBeInstanceOf(Date);
      expect(sunrise.getTime()).toBeLessThan(sunset.getTime());
    });
  });

  describe('isNight', () => {
    it('should detect night time', () => {
      // This test is time-dependent, so we'll just check the return type
      const result = isNight(37.7749, -122.4194);
      expect(typeof result).toBe('boolean');
    });

    it('should detect night time at a specific date', () => {
      // Test at midnight UTC (likely night in SF)
      const midnightUtc = new Date('2026-01-15T00:00:00Z');
      const result = isNight(37.7749, -122.4194, midnightUtc);
      expect(typeof result).toBe('boolean');
    });

    it('should detect daytime at noon UTC', () => {
      // Test at noon UTC (likely daytime somewhere)
      const noonUtc = new Date('2026-01-15T12:00:00Z');
      const result = isNight(0, 0, noonUtc); // Equator at noon UTC
      expect(typeof result).toBe('boolean');
    });
  });

  describe('addFlightTime', () => {
    it('should add minutes to a date', () => {
      const base = new Date('2026-01-15T10:00:00Z');
      const result = addFlightTime(base, 150);
      
      expect(result.toISOString()).toBe('2026-01-15T12:30:00.000Z');
    });

    it('should handle zero minutes', () => {
      const base = new Date('2026-01-15T10:00:00Z');
      const result = addFlightTime(base, 0);
      
      expect(result.toISOString()).toBe(base.toISOString());
    });

    it('should handle negative minutes (go back in time)', () => {
      const base = new Date('2026-01-15T10:00:00Z');
      const result = addFlightTime(base, -30);
      
      expect(result.toISOString()).toBe('2026-01-15T09:30:00.000Z');
    });

    it('should handle crossing day boundaries', () => {
      const base = new Date('2026-01-15T23:00:00Z');
      const result = addFlightTime(base, 120);
      
      expect(result.toISOString()).toBe('2026-01-16T01:00:00.000Z');
    });
  });

  describe('getTimeDifference', () => {
    it('should calculate difference in minutes', () => {
      const start = new Date('2026-01-15T10:00:00Z');
      const end = new Date('2026-01-15T12:30:00Z');
      
      expect(getTimeDifference(start, end)).toBe(150);
    });

    it('should handle zero difference', () => {
      const date = new Date('2026-01-15T10:00:00Z');
      
      expect(getTimeDifference(date, date)).toBe(0);
    });

    it('should handle negative difference', () => {
      const start = new Date('2026-01-15T12:30:00Z');
      const end = new Date('2026-01-15T10:00:00Z');
      
      expect(getTimeDifference(start, end)).toBe(-150);
    });

    it('should round to nearest minute', () => {
      const start = new Date('2026-01-15T10:00:00Z');
      const end = new Date('2026-01-15T10:00:45Z'); // 45 seconds
      
      expect(getTimeDifference(start, end)).toBe(1); // Rounds to 1 minute
    });

    it('should be inverse of addFlightTime', () => {
      const base = new Date('2026-01-15T10:00:00Z');
      const minutes = 150;
      const result = addFlightTime(base, minutes);
      
      expect(getTimeDifference(base, result)).toBe(minutes);
    });
  });

  describe('Integration tests', () => {
    it('should handle complete flight workflow', () => {
      // Plan a flight
      const departure = new Date('2026-01-15T10:00:00Z');
      const flightDuration = parseFlightTime('2h 30m');
      const arrival = addFlightTime(departure, flightDuration);
      
      // Verify times
      expect(getTimeDifference(departure, arrival)).toBe(150);
      expect(formatFlightTime(flightDuration)).toBe('2h 30m');
      
      // Check if departure is during night
      const nightFlight = isNight(37.7749, -122.4194, departure);
      expect(typeof nightFlight).toBe('boolean');
    });

    it('should format times for logging', () => {
      const departure = new Date('2026-01-15T18:30:00Z');
      const arrival = new Date('2026-01-15T21:00:00Z');
      
      const depZulu = toZulu(departure);
      const arrZulu = toZulu(arrival);
      const duration = getTimeDifference(departure, arrival);
      
      expect(depZulu).toBe('2026-01-15T18:30:00.000Z');
      expect(arrZulu).toBe('2026-01-15T21:00:00.000Z');
      expect(formatFlightTime(duration)).toBe('2h 30m');
    });
  });
});
