import { describe, expect, it } from 'vitest';
import { loadConformanceContract } from './conformance-contract.js';
import {
  distanceNM,
  initialBearing,
  normalizeBearing,
  normalizeLongitude,
  dmsToDecimal,
  flightTime,
  vfrFuelReserve,
  ifrFuelReserve,
  distance,
} from '../navigation/index.js';

interface NavigationVector {
  id: string;
  operation: string;
  args: unknown[];
  expected?: number;
  absolute_tolerance?: number;
  expected_error?: 'invalid_input';
}

interface NavigationVectors {
  schema: string;
  vectors: NavigationVector[];
}

const contract = loadConformanceContract<NavigationVectors>('navigation');

const operations: Record<string, (...args: never[]) => number> = {
  distance_nm: distanceNM,
  initial_bearing: initialBearing,
  normalize_bearing: normalizeBearing,
  normalize_longitude: normalizeLongitude,
  dms_to_decimal: dmsToDecimal,
  flight_time: flightTime,
  vfr_fuel_reserve: vfrFuelReserve,
  ifr_fuel_reserve: ifrFuelReserve,
  tsd_distance: distance,
};

describe('aviation.navigation Component conformance', () => {
  it('uses the versioned Component-owned vector schema', () => {
    expect(contract.schema).toBe('aviation/navigation-acceptance-vectors@1');
    expect(contract.vectors.length).toBeGreaterThan(0);
  });

  for (const vector of contract.vectors) {
    it(vector.id, () => {
      const operation = operations[vector.operation];
      expect(operation, `unsupported operation: ${vector.operation}`).toBeTypeOf('function');
      if (vector.expected_error) {
        expect(() => operation(...vector.args as never[])).toThrow();
        return;
      }
      const actual = operation(...vector.args as never[]);
      expect(Number.isFinite(actual)).toBe(true);
      expect(vector.expected).toBeTypeOf('number');
      expect(vector.absolute_tolerance).toBeTypeOf('number');
      if (vector.absolute_tolerance === 0) {
        expect(actual).toBe(vector.expected);
      } else {
        expect(Math.abs(actual - vector.expected!)).toBeLessThanOrEqual(
          vector.absolute_tolerance!,
        );
      }
    });
  }
});
