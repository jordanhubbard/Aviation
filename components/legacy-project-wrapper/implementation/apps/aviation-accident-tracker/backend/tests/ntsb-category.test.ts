import { describe, expect, it } from 'vitest';
import { normalize } from '../src/ingest/normalize.js';

const base = { source: 'ntsb' as const, id: 'case', url: 'https://data.ntsb.gov/report',
  fetchedAt: '2026-10-24T00:00:00Z', dateZ: '2026-10-20T00:00:00Z', registration: 'N12345' };

describe('NTSB operation category', () => {
  it('classifies recorded FAR part and preserves unknown codes', () => {
    expect(normalize({ ...base, farPart: '091' }).category).toBe('general');
    expect(normalize({ ...base, farPart: '121' }).category).toBe('commercial');
    expect(normalize({ ...base, farPart: '135' }).category).toBe('commercial');
    expect(normalize({ ...base, farPart: 'NUSC' }).category).toBe('unknown');
    expect(normalize(base).category).toBe('unknown');
  });
});
