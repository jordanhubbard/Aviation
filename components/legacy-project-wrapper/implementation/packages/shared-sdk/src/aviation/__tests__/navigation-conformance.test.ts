import { describe, expect, it } from "vitest";
import { loadConformanceContract } from "./conformance-contract.js";
import {
  distanceNM,
  initialBearing,
  calculateWindComponents,
  calculateWindComponentsFromVector,
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
  headingDifference,
  circularMeanHeading,
  runwayDesignator,
  toLocalTangentPlane,
  fromLocalTangentPlane,
} from "../navigation/index.js";

interface NavigationVector {
  id: string;
  operation: string;
  args: unknown[];
  expected?: number | string;
  absolute_tolerance?: number;
  expected_error?: "invalid_input";
}

interface NavigationVectors {
  schema: string;
  vectors: NavigationVector[];
}

const contract = loadConformanceContract<NavigationVectors>("navigation");

const operations: Record<string, (...args: never[]) => number | string> = {
  distance_nm: distanceNM,
  initial_bearing: initialBearing,
  headwind_component: ((
    windDirection: number,
    windSpeed: number,
    course: number,
  ) => calculateWindComponents(windDirection, windSpeed, course).headwind) as (
    ...args: never[]
  ) => number,
  crosswind_component: ((
    windDirection: number,
    windSpeed: number,
    course: number,
  ) => calculateWindComponents(windDirection, windSpeed, course).crosswind) as (
    ...args: never[]
  ) => number,
  headwind_component_from_vector: ((
    windEast: number,
    windNorth: number,
    course: number,
  ) =>
    calculateWindComponentsFromVector(windEast, windNorth, course)
      .headwind) as (...args: never[]) => number,
  crosswind_component_from_vector: ((
    windEast: number,
    windNorth: number,
    course: number,
  ) =>
    calculateWindComponentsFromVector(windEast, windNorth, course)
      .crosswind) as (...args: never[]) => number,
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
  heading_difference: headingDifference,
  circular_mean_heading: circularMeanHeading as (...args: never[]) => number,
  runway_designator: runwayDesignator,
  local_east_m: ((
    lat: number,
    lon: number,
    originLat: number,
    originLon: number,
  ) => toLocalTangentPlane(lat, lon, originLat, originLon).eastMeters) as (
    ...args: never[]
  ) => number,
  local_north_m: ((
    lat: number,
    lon: number,
    originLat: number,
    originLon: number,
  ) => toLocalTangentPlane(lat, lon, originLat, originLon).northMeters) as (
    ...args: never[]
  ) => number,
  local_latitude: ((
    east: number,
    north: number,
    originLat: number,
    originLon: number,
  ) => fromLocalTangentPlane(east, north, originLat, originLon)[0]) as (
    ...args: never[]
  ) => number,
  local_longitude: ((
    east: number,
    north: number,
    originLat: number,
    originLon: number,
  ) => fromLocalTangentPlane(east, north, originLat, originLon)[1]) as (
    ...args: never[]
  ) => number,
};

describe("aviation.navigation Component conformance", () => {
  it("uses the versioned Component-owned vector schema", () => {
    expect(contract.schema).toBe("aviation/navigation-acceptance-vectors@3");
    expect(contract.vectors.length).toBeGreaterThan(0);
  });

  for (const vector of contract.vectors) {
    it(vector.id, () => {
      const operation = operations[vector.operation];
      expect(
        operation,
        `unsupported operation: ${vector.operation}`,
      ).toBeTypeOf("function");
      if (vector.expected_error) {
        expect(() => operation(...(vector.args as never[]))).toThrow();
        return;
      }
      const actual = operation(...(vector.args as never[]));
      if (typeof vector.expected === "string") {
        expect(actual).toBe(vector.expected);
        return;
      }
      expect(typeof actual === "number" && Number.isFinite(actual)).toBe(true);
      expect(vector.expected).toBeTypeOf("number");
      expect(vector.absolute_tolerance).toBeTypeOf("number");
      if (vector.absolute_tolerance === 0) {
        expect(actual).toBe(vector.expected);
      } else {
        expect(
          Math.abs((actual as number) - vector.expected!),
        ).toBeLessThanOrEqual(vector.absolute_tolerance!);
      }
    });
  }
});
