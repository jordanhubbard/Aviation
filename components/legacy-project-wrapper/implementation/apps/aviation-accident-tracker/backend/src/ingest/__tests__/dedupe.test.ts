import { dedupe, fuzzyDedup } from '../dedupe.js';
import { NormalizedEvent } from '../types.js';

const base: NormalizedEvent = {
  id: 'a',
  dateZ: '2025-12-01T00:00:00Z',
  registration: 'N123AB',
  aircraftType: 'B738',
  operator: 'Sample Air',
  category: 'commercial',
  country: 'US',
  sources: [],
  createdAt: '2025-12-01T00:00:00Z',
  updatedAt: '2025-12-01T00:00:00Z',
};

describe('fuzzyDedup', () => {
  it('merges near-duplicate events within 1 day and same reg', () => {
    const dup: NormalizedEvent = { ...base, id: 'b', dateZ: '2025-12-02T00:00:00Z', summary: 'later update' };
    const result = fuzzyDedup([base, dup], 0.7);
    expect(result).toHaveLength(1);
    expect(result[0].sources.length).toBe(0);
    expect(result[0].summary).toBe('later update');
  });

  it('keeps distinct events when below threshold', () => {
    const other: NormalizedEvent = { ...base, id: 'c', registration: 'G-TEST', country: 'GB' };
    const result = fuzzyDedup([base, other], 0.9);
    expect(result).toHaveLength(2);
  });

  it('retains a known operation category when merging source reports', () => {
    const unknown = { ...base, category: 'unknown' as const };
    const ntsb = { ...base, id: 'ntsb', category: 'general' as const,
      dateZ: '2025-12-02T00:00:00Z' };
    expect(fuzzyDedup([unknown, ntsb], 0.7)[0].category).toBe('general');
    expect(fuzzyDedup([ntsb, unknown], 0.7)[0].category).toBe('general');
    expect(dedupe([ntsb, { ...unknown, dateZ: ntsb.dateZ }])[0].category).toBe('general');
  });
});
