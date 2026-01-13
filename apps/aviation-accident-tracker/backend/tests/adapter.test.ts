/**
 * Unit tests for adapter utilities
 */

import { describe, it, expect } from 'vitest';
import { normalizeToUTC, isWithinRetentionWindow } from '../src/ingest/adapter';

describe('Adapter utilities', () => {
  describe('normalizeToUTC', () => {
    it('should normalize ISO date strings to UTC date', () => {
      expect(normalizeToUTC('2024-03-15T10:30:00Z')).toBe('2024-03-15');
      expect(normalizeToUTC('2024-03-15')).toBe('2024-03-15');
    });

    it('should throw on invalid dates', () => {
      expect(() => normalizeToUTC('invalid')).toThrow('Invalid date');
    });
  });

  describe('isWithinRetentionWindow', () => {
    it('should accept dates >= 2000-01-01', () => {
      expect(isWithinRetentionWindow('2000-01-01')).toBe(true);
      expect(isWithinRetentionWindow('2024-03-15')).toBe(true);
      expect(isWithinRetentionWindow('2025-12-31')).toBe(true);
    });

    it('should reject dates < 2000-01-01', () => {
      expect(isWithinRetentionWindow('1999-12-31')).toBe(false);
      expect(isWithinRetentionWindow('1990-01-01')).toBe(false);
    });
  });
});
