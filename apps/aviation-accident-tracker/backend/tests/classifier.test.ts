/**
 * Unit tests for aircraft classifier
 */

import { describe, it, expect } from 'vitest';
import { AircraftClassifier } from '../src/classifier';

describe('AircraftClassifier', () => {
  const classifier = new AircraftClassifier();

  describe('Commercial classification', () => {
    it('should classify known airlines as commercial', () => {
      expect(classifier.classify('Delta Air Lines', '')).toBe('commercial');
      expect(classifier.classify('United Airlines', '')).toBe('commercial');
      expect(classifier.classify('American Airlines', '')).toBe('commercial');
    });

    it('should classify commercial aircraft types as commercial', () => {
      expect(classifier.classify('', 'Boeing 737')).toBe('commercial');
      expect(classifier.classify('', 'Airbus A320')).toBe('commercial');
      expect(classifier.classify('', 'Embraer E175')).toBe('commercial');
    });

    it('should classify cargo carriers as commercial', () => {
      expect(classifier.classify('FedEx', '')).toBe('commercial');
      expect(classifier.classify('UPS Airlines', '')).toBe('commercial');
      expect(classifier.classify('DHL Cargo', '')).toBe('commercial');
    });
  });

  describe('General Aviation classification', () => {
    it('should classify private operators as general aviation', () => {
      expect(classifier.classify('Private', '')).toBe('general');
      expect(classifier.classify('Private Owner', '')).toBe('general');
      expect(classifier.classify('Aviation LLC', '')).toBe('general');
    });

    it('should classify GA aircraft types as general aviation', () => {
      expect(classifier.classify('', 'Cessna 172')).toBe('general');
      expect(classifier.classify('', 'Piper PA-28')).toBe('general');
      expect(classifier.classify('', 'Cirrus SR22')).toBe('general');
    });

    it('should classify N-number only operators as general aviation', () => {
      expect(classifier.classify('N12345', '')).toBe('general');
      expect(classifier.classify('N123AB', '')).toBe('general');
    });
  });

  describe('Unknown classification', () => {
    it('should return unknown for ambiguous cases', () => {
      expect(classifier.classify('Unknown Operator', 'Unknown Type')).toBe('unknown');
      expect(classifier.classify('', '')).toBe('unknown');
    });
  });
});
