import { describe, expect, it } from 'vitest';
import { loadConformanceContract } from './conformance-contract.js';
import {
  HazardValidationError,
  altitudeOverlaps,
  deriveSeverity,
  findRouteHazardsInBand,
  hazardIntersectsLeg,
  isHazardActive,
  normalizeHazardRecord,
  pointInPolygon,
  type Hazard,
  type HazardKind,
  type HazardRecordInput,
  type LatLon,
} from '../hazards.js';

type Vectors = {
  schema: string;
  referenceTime: string;
  normalizationCases: Array<{ id: string; input: HazardRecordInput; expected: Record<string, unknown> }>;
  invalidNormalizationCases: Array<{ id: string; input: HazardRecordInput; expectedErrorCode: string }>;
  severityCases: Array<{ kind: HazardKind; subType: string; expected: string }>;
  evaluationCases: {
    active: Array<{ instant: string; expected: boolean }>;
    altitude: Array<{ floor: number; ceiling: number; expected: boolean }>;
    points: Array<{ point: LatLon; expected: boolean }>;
    legs: Array<{ id: string; start: LatLon; end: LatLon; expected: boolean }>;
  };
  routeCase: { waypoints: LatLon[]; floor: number; ceiling: number; expected: Array<{ id: string; legStartIndex: number }> };
};

const contract = loadConformanceContract<Vectors>('hazards');
const portable = (hazard: Hazard) => ({
  id: hazard.id, kind: hazard.kind, subType: hazard.subType, summary: hazard.summary,
  geometry: hazard.geometry, altitudeBandFt: hazard.altitudeBandFt,
  validFrom: hazard.validFrom.toISOString(), validTo: hazard.validTo.toISOString(),
  severity: hazard.severity,
});

describe('aviation.hazards Component conformance', () => {
  it('uses the declared vector schema', () => {
    expect(contract.schema).toBe('aviation/hazards-acceptance-vectors@1');
  });

  for (const vector of contract.normalizationCases) {
    it(`normalizes ${vector.id}`, () => {
      const input = structuredClone(vector.input);
      const before = structuredClone(input);
      expect(portable(normalizeHazardRecord(input))).toEqual(vector.expected);
      expect(input).toEqual(before);
    });
  }

  for (const vector of contract.invalidNormalizationCases) {
    it(`rejects ${vector.id}`, () => {
      try {
        normalizeHazardRecord(vector.input);
        throw new Error('normalization unexpectedly succeeded');
      } catch (error) {
        expect(error).toBeInstanceOf(HazardValidationError);
        expect((error as HazardValidationError).code).toBe(vector.expectedErrorCode);
      }
    });
  }

  for (const vector of contract.severityCases) {
    it(`derives ${vector.kind} ${vector.subType}`, () => {
      expect(deriveSeverity(vector.kind, vector.subType)).toBe(vector.expected);
    });
  }

  const polygonHazard = normalizeHazardRecord(contract.normalizationCases[0].input);
  for (const vector of contract.evaluationCases.active) {
    it(`evaluates active window at ${vector.instant}`, () => {
      expect(isHazardActive(polygonHazard, new Date(vector.instant))).toBe(vector.expected);
    });
  }
  for (const vector of contract.evaluationCases.altitude) {
    it(`evaluates altitude ${vector.floor}-${vector.ceiling}`, () => {
      expect(altitudeOverlaps(polygonHazard, vector.floor, vector.ceiling)).toBe(vector.expected);
    });
  }
  for (const vector of contract.evaluationCases.points) {
    it(`evaluates point ${vector.point.lat},${vector.point.lon}`, () => {
      if (polygonHazard.geometry.type !== 'Polygon') throw new Error('expected polygon');
      expect(pointInPolygon(vector.point, polygonHazard.geometry.coordinates)).toBe(vector.expected);
    });
  }
  for (const vector of contract.evaluationCases.legs) {
    it(`evaluates leg ${vector.id}`, () => {
      expect(hazardIntersectsLeg(
        polygonHazard, vector.start, vector.end, 12000, 12000,
        new Date(contract.referenceTime)
      )).toBe(vector.expected);
    });
  }

  it('returns route hits in stable leg-major and hazard-input order', () => {
    const waypoints = structuredClone(contract.routeCase.waypoints);
    const before = structuredClone(waypoints);
    const pointHazard = normalizeHazardRecord(contract.normalizationCases[1].input);
    const hazards = [pointHazard, polygonHazard];
    expect(findRouteHazardsInBand(
      waypoints, contract.routeCase.floor, contract.routeCase.ceiling, hazards,
      new Date(contract.referenceTime)
    ).map(({ hazard, legStartIndex }) => ({ id: hazard.id, legStartIndex })))
      .toEqual(contract.routeCase.expected);
    expect(waypoints).toEqual(before);
    expect(hazards).toEqual([pointHazard, polygonHazard]);
  });
});
