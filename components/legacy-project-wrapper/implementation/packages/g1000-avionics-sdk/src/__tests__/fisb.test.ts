import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { Gdl90Decoder } from '../gdl90';
const vectors = JSON.parse(
  readFileSync(
    new URL('../../../../conformance/aviation-fisb.json', import.meta.url),
    'utf8',
  ),
);
it('decodes the published five-TAF application field at every framing boundary', () => {
  const frame = Uint8Array.from(Buffer.from(vectors.frame_hex, 'hex'));
  for (let split = 0; split <= frame.length; split++) {
    const decoder = new Gdl90Decoder();
    const a = decoder.push(frame.slice(0, split)),
      b = decoder.push(frame.slice(split));
    expect([...a.errors, ...b.errors]).toEqual([]);
    const messages = [...a.messages, ...b.messages];
    expect(messages).toHaveLength(1);
    const report = messages[0];
    if (report.kind !== 'uplink') throw new Error('Expected uplink');
    expect(report.application_data_valid).toBe(true);
    expect(report.time_of_reception_ns).toBeNull();
    expect(report.errors).toEqual([]);
    expect(report.records.map((r) => r.location_id)).toEqual(
      vectors.expected_locations,
    );
    expect(
      report.records.every(
        (r) => r.report_type === vectors.expected_report_type,
      ),
    ).toBe(true);
    expect(
      report.records.every(
        (r) => r.report_time === vectors.expected_report_time,
      ),
    ).toBe(true);
    expect(report.records[0].raw_text).toBe(vectors.expected_first_raw_text);
  }
});
for (const vector of vectors.cases)
  it(vector.id, () => {
    const result = new Gdl90Decoder().push(
      Uint8Array.from(Buffer.from(vector.frame_hex, 'hex')),
    );
    if (vector.error) {
      expect(result).toEqual({ messages: [], errors: [vector.error] });
      return;
    }
    expect(result.errors).toEqual([]);
    expect(result.messages).toHaveLength(1);
    const report = result.messages[0];
    if (report.kind !== 'uplink') throw new Error('Expected uplink');
    for (const [field, value] of Object.entries(vector.expected))
      if (field === 'has_errors')
        expect(Boolean(report.errors.length)).toBe(value);
      else
        expect((report as unknown as Record<string, unknown>)[field]).toEqual(
          value,
        );
  });
