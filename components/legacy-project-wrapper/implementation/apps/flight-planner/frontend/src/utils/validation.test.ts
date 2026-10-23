import { validateAirportCode, validateRequired, normalizeAirportCode } from './validation';

describe('Validation Utilities', () => {
  describe('normalizeAirportCode', () => {
    it('should normalize and return a valid airport code', () => {
      expect(normalizeAirportCode(' KPAO - Palo Alto Airport ')).toBe('KPAO');
      expect(normalizeAirportCode('JFK')).toBe('JFK');
      expect(normalizeAirportCode('')).toBe('');
    });
  });

  describe('validateAirportCode', () => {
    it('should validate airport codes correctly', () => {
      expect(validateAirportCode('KPAO')).toEqual({ valid: true, normalized: 'KPAO' });
      expect(validateAirportCode('')).toEqual({ valid: false, error: 'Airport code is required' });
      expect(validateAirportCode('K')).toEqual({ valid: false, error: 'Airport code must be 3-5 characters' });
      expect(validateAirportCode('KPAO123')).toEqual({ valid: false, error: 'Airport code must be 3-5 characters' });
      expect(validateAirportCode('KPAO!')).toEqual({ valid: false, error: 'Airport code must contain only letters and numbers' });
    });
  });

  describe('validateRequired', () => {
    it('should validate required fields correctly', () => {
      expect(validateRequired('value', 'Field')).toEqual({ valid: true });
      expect(validateRequired('', 'Field')).toEqual({ valid: false, error: 'Field is required' });
    });
  });
});
