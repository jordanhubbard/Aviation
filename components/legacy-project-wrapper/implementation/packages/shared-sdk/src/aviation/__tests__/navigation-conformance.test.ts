import { describe, expect, it } from 'vitest';
import { loadConformanceContract } from './conformance-contract.js';
import {
  distanceNM,
  initialBearing,
  calculateWindComponents,
  windCorrectionAngle,
  trueHeading,
  groundSpeed,
  normalizeBearing,
  normalizeLongitude,
  dmsToDecimal,
  flightTime,
  fuelConsumption,
  fuelReserve,
  fuelRange,
  vfrFuelReserve,
  ifrFuelReserve,
  pressureAltitude,
  isaTemperature,
  densityAltitude,
  densityAltitudeFromIndicated,
  distance,
  iasToTas,
  tasToMach,
  machToTas,
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
  headwind_component: ((windDirection: number, windSpeed: number, course: number) =>
    calculateWindComponents(windDirection, windSpeed, course).headwind) as (...args: never[]) => number,
  crosswind_component: ((windDirection: number, windSpeed: number, course: number) =>
    calculateWindComponents(windDirection, windSpeed, course).crosswind) as (...args: never[]) => number,
  wind_correction_angle: windCorrectionAngle,
  true_heading: trueHeading,
  ground_speed: groundSpeed,
  normalize_bearing: normalizeBearing,
  normalize_longitude: normalizeLongitude,
  dms_to_decimal: dmsToDecimal,
  flight_time: flightTime,
  fuel_consumption: fuelConsumption,
  fuel_reserve: fuelReserve,
  fuel_range: fuelRange,
  vfr_fuel_reserve: vfrFuelReserve,
  ifr_fuel_reserve: ifrFuelReserve,
  pressure_altitude: pressureAltitude,
  isa_temperature: isaTemperature,
  density_altitude: densityAltitude,
  density_altitude_from_indicated: densityAltitudeFromIndicated,
  tsd_distance: distance,
  ias_to_tas: iasToTas,
  tas_to_mach: tasToMach,
  mach_to_tas: machToTas,
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
