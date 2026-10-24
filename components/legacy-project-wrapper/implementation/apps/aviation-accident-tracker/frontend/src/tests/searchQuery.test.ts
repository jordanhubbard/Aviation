import { describe, it, expect } from 'vitest';
import { countryLabel, regionLabel, parseSearchQuery } from '../searchQuery';

describe('deterministic accident search', () => {
  it('extracts cause, place, and date without a token', () => {
    expect(parseSearchQuery('Engine failure in California last 30 days', ['USA'], ['CA'], new Date('2026-10-24T12:00:00Z'))).toEqual({
      cause: 'Engine failure', region: 'CA', from: '2026-09-25', to: '2026-10-24',
    });
  });
  it('keeps unsupported terms as ordinary text', () => {
    expect(parseSearchQuery('commercial accidents involving N12345', ['USA'], ['CA'])).toEqual({
      category: 'commercial', search: 'involving N12345',
    });
  });
  it('shows full labels while preserving the filter codes', () => {
    expect(countryLabel('USA')).toBe('United States (USA)');
    expect(regionLabel('CA')).toBe('California (CA)');
  });
});
