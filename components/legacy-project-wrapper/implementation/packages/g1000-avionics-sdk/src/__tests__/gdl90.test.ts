import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Gdl90Decoder, resolveGeometricAltitude } from '../gdl90';

const vectors = JSON.parse(
  readFileSync(
    new URL('../../../../conformance/aviation-gdl90.json', import.meta.url),
    'utf8',
  ),
);
const heartbeat = Uint8Array.from(
  Buffer.from(vectors.reports[0].frame_hex, 'hex'),
);
const join = (...parts: Uint8Array[]) =>
  Uint8Array.from(parts.flatMap((part) => Array.from(part)));

describe('GDL90 independent conformance', () => {
  for (const vector of vectors.invalid_frames) {
    it(`${vector.id}: invalid frames produce no report`, () => {
      expect(
        new Gdl90Decoder().push(
          Uint8Array.from(Buffer.from(vector.frame_hex, 'hex')),
        ),
      ).toEqual({ messages: [], errors: [vector.error] });
    });
  }
  for (const vector of vectors.reports) {
    it(`${vector.id}: fields and every input split`, () => {
      const frame = Uint8Array.from(Buffer.from(vector.frame_hex, 'hex'));
      for (let split = 0; split <= frame.length; split++) {
        const decoder = new Gdl90Decoder();
        const a = decoder.push(frame.slice(0, split)),
          b = decoder.push(frame.slice(split));
        expect([...a.errors, ...b.errors]).toEqual([]);
        const messages = [...a.messages, ...b.messages];
        expect(messages).toHaveLength(1);
        const report = messages[0] as unknown as Record<string, unknown>;
        for (const [field, value] of Object.entries(vector.expected)) {
          if (
            (field === 'latitude_deg' || field === 'longitude_deg') &&
            typeof value === 'number'
          ) {
            expect(
              Math.abs(Number(report[field]) - Number(value)),
            ).toBeLessThanOrEqual(vector.coordinate_tolerance_deg);
          } else expect(report[field]).toEqual(value);
        }
      }
    });
  }
  it('rejects corrupt FCS and recovers at the next frame', () => {
    const corrupt = heartbeat.slice();
    corrupt[3] ^= 1;
    const result = new Gdl90Decoder().push(join(corrupt, heartbeat));
    expect(result.errors).toEqual(['invalid-fcs']);
    expect(result.messages).toHaveLength(1);
  });
  it('bounds pending state and resets incomplete frames', () => {
    const decoder = new Gdl90Decoder();
    expect(
      decoder.push(join(Uint8Array.of(126), new Uint8Array(5000).fill(97)))
        .errors,
    ).toEqual(['frame-too-large']);
    expect(decoder.push(heartbeat).messages).toHaveLength(1);
    decoder.push(Uint8Array.of(126, 0, 125));
    expect(decoder.finish().errors).toEqual(['incomplete-frame']);
    expect(decoder.finish().errors).toEqual([]);
    expect(decoder.push(heartbeat).messages).toHaveLength(1);
  });
  it('reports dangling escapes and short frames without losing subsequent reports', () => {
    const result = new Gdl90Decoder().push(
      join(Uint8Array.of(126, 125, 126, 0, 126), heartbeat),
    );
    expect(result.errors).toEqual(['incomplete-escape', 'short-frame']);
    expect(result.messages).toHaveLength(1);
  });
  it('bounds input, emitted reports and errors', () => {
    const decoder = new Gdl90Decoder();
    const result = decoder.push(
      join(...Array.from({ length: 300 }, () => heartbeat)),
    );
    expect(result.messages).toHaveLength(256);
    expect(result.errors).toEqual(['message-limit']);
    const errors = decoder.push(
      join(...Array.from({ length: 100 }, () => Uint8Array.of(126, 0, 126))),
    ).errors;
    expect(errors).toHaveLength(32);
    expect(errors[31]).toBe('error-limit');
    expect(() => decoder.push(new Uint8Array(65536))).toThrow('65535');
    expect(decoder.push(heartbeat).messages).toHaveLength(1);
  });
});


it('resolves geometry with explicit profile provenance without converting or mutating values', () => {
  const decode = (id: string) => new Gdl90Decoder().push(Uint8Array.from(Buffer.from(vectors.reports.find((row: {id: string}) => row.id === id).frame_hex, 'hex'))).messages[0];
  const vector = vectors.reports.find((row: {expected: {kind: string}}) => row.expected.kind === 'geometric_altitude');
  const report = new Gdl90Decoder().push(Uint8Array.from(Buffer.from(vector.frame_hex, 'hex'))).messages[0];
  const original = {...report};
  expect(resolveGeometricAltitude(report, decode('extension-id-msl-serial64'))).toEqual({...original, datum: 'MSL', datum_source: 'foreflight_device_id'});
  expect(resolveGeometricAltitude(report, decode('extension-id-ellipsoid-utf8'))).toEqual({...original, datum_source: 'foreflight_device_id'});
  expect(resolveGeometricAltitude(report)).toEqual(original);
  expect(resolveGeometricAltitude(report, null, true)).toEqual({...original, datum: null, datum_source: 'unknown_receiver_profile'});
  expect(report).toEqual(original);
  expect(() => resolveGeometricAltitude(decode('published-traffic-section-3.5.2'))).toThrow('geometric-altitude');
  expect(() => resolveGeometricAltitude(report, decode('extension-id-unknown-version'))).toThrow('supported device-ID');
});
