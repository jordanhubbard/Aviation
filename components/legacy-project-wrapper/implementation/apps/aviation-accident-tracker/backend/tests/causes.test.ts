import { describe, expect, it } from 'vitest';
import { classifyCauses } from '../src/ingest/causes.js';

describe('cause classification', () => {
  const labels = (text: string) => classifyCauses(text, 'report', 'https://example.com/report', 'reported').map(c => c.label);
  it('recognizes explicit mechanisms with a source', () => {
    expect(labels('Engine failure led to a forced landing. The airplane subsequently lost control.'))
      .toEqual(['Engine failure', 'Loss of control']);
    expect(labels('Controlled flight into terrain.')).toEqual(['CFIT']);
  });
  it('leaves uncertain, negated, and generic reports unknown', () => {
    expect(labels('Investigating possible engine failure after the crash.')).toEqual([]);
    expect(labels('No engine failure was found.')).toEqual([]);
    expect(labels('Aircraft crashed near the airport; investigation ongoing.')).toEqual([]);
    expect(labels('Collision with terrain (non-CFIT)')).toEqual([]);
  });
});
