import { describe, expect, it } from 'vitest';
import { loadConformanceContract } from './conformance-contract.js';
import {
  C172S_OPERATING_PROFILE,
  C182T_OPERATING_PROFILE,
  SR22_PERSPECTIVE_3600_OPERATING_PROFILE,
  createAircraftOperatingProfile,
  findAircraftOperatingProfile,
  matchAircraftOperatingProfile,
  type AircraftOperatingProfile,
  ADDITIONAL_SUPPORTED_TYPE_DESIGNATORS,
  AIRCRAFT_TYPE_DESIGNATORS,
  aircraftTypeDesignatorCatalogSummary,
  aircraftTypeDesignatorsByManufacturer,
  findAircraftTypeDesignator,
  isSupportedAircraftTypeDesignator,
  suggestAircraftTypeDesignators,
} from '../aircraft.js';

interface AircraftVectors {
  schema: string;
  profiles: Record<string, AircraftOperatingProfile>;
  lookups: Array<{
    query: string;
    expectedProfileId: string | null;
  }>;
  identityMatches: Array<{
    manufacturer: string;
    model: string;
    expectedProfileId: string | null;
  }>;
  invalidMutations: Array<{
    id: string;
    path: string[];
    value: number | string;
  }>;
  typeDesignators: Record<string, {
    manufacturer: string;
    model: string;
    category: string;
  }>;
  additionalSupportedTypeDesignators: string[];
  typeDesignatorLookups: Array<{
    query: string;
    expectedCode: string | null;
    supported: boolean;
  }>;
  typeDesignatorManufacturerLookups: Array<{
    manufacturer: string;
    expectedCodes: string[];
  }>;
  typeDesignatorSuggestions: Array<{
    query: string;
    maximum: number;
    expectedCodes: string[];
  }>;
  typeDesignatorSummary: ReturnType<typeof aircraftTypeDesignatorCatalogSummary>;
}

const contract = loadConformanceContract<AircraftVectors>('aircraft');

const mutateProfile = (
  profile: AircraftOperatingProfile,
  path: string[],
  value: number | string
): AircraftOperatingProfile => {
  const result = structuredClone(profile) as unknown as Record<string, unknown>;
  let target = result;
  for (const segment of path.slice(0, -1)) {
    target = target[segment] as Record<string, unknown>;
  }
  target[path[path.length - 1]] = value === 'non-finite' ? Number.NaN : value;
  return result as unknown as AircraftOperatingProfile;
};

describe('aviation.aircraft Component conformance', () => {
  it('exports every Component-owned operating profile', () => {
    expect(contract.schema).toBe('aviation/aircraft-acceptance-vectors@5');
    const profiles = [
      C172S_OPERATING_PROFILE,
      C182T_OPERATING_PROFILE,
      SR22_PERSPECTIVE_3600_OPERATING_PROFILE,
    ];
    for (const profile of profiles) {
      expect(profile).toEqual(contract.profiles[profile.profileId]);
      expect(Object.isFrozen(profile)).toBe(true);
      expect(Object.isFrozen(profile.airspeedLimits)).toBe(true);
      expect(Object.isFrozen(profile.fuelLimits)).toBe(true);
      expect(Object.isFrozen(profile.weightLimits)).toBe(true);
      expect(Object.isFrozen(profile.dimensions)).toBe(true);
      expect(Object.isFrozen(profile.referencePerformance)).toBe(true);
    }
  });

  for (const lookup of contract.lookups) {
    it(`resolves bundled profile lookup ${lookup.query}`, () => {
      expect(findAircraftOperatingProfile(lookup.query)?.profileId ?? null)
        .toBe(lookup.expectedProfileId);
    });
  }

  for (const identity of contract.identityMatches) {
    it(`matches bundled profile identity ${identity.manufacturer}/${identity.model}`, () => {
      expect(matchAircraftOperatingProfile(identity.manufacturer, identity.model)?.profileId ?? null)
        .toBe(identity.expectedProfileId);
    });
  }

  for (const mutation of contract.invalidMutations) {
    it(`rejects ${mutation.id}`, () => {
      const profile = contract.profiles['cessna-172s'];
      expect(() => createAircraftOperatingProfile(
        mutateProfile(profile, mutation.path, mutation.value)
      )).toThrow();
    });
  }

  it('exports the complete Component-owned type-designator snapshot', () => {
    expect(Object.fromEntries(
      Object.entries(AIRCRAFT_TYPE_DESIGNATORS).map(([code, record]) => [
        code,
        {
          manufacturer: record.manufacturer,
          model: record.model,
          category: record.category,
        },
      ]),
    )).toEqual(contract.typeDesignators);
    expect([...ADDITIONAL_SUPPORTED_TYPE_DESIGNATORS].sort())
      .toEqual(contract.additionalSupportedTypeDesignators);
  });

  for (const lookup of contract.typeDesignatorLookups) {
    it(`looks up type designator ${lookup.query || '<blank>'}`, () => {
      expect(findAircraftTypeDesignator(lookup.query)?.code ?? null)
        .toBe(lookup.expectedCode);
      expect(isSupportedAircraftTypeDesignator(lookup.query)).toBe(lookup.supported);
    });
  }

  for (const lookup of contract.typeDesignatorManufacturerLookups) {
    it(`lists type designators for ${lookup.manufacturer}`, () => {
      expect(aircraftTypeDesignatorsByManufacturer(lookup.manufacturer))
        .toEqual(lookup.expectedCodes);
    });
  }

  for (const suggestion of contract.typeDesignatorSuggestions) {
    it(`suggests type designators for ${suggestion.query || '<blank>'}`, () => {
      expect(suggestAircraftTypeDesignators(suggestion.query, suggestion.maximum))
        .toEqual(suggestion.expectedCodes);
    });
  }

  it('summarizes the type-designator snapshot', () => {
    expect(aircraftTypeDesignatorCatalogSummary()).toEqual(contract.typeDesignatorSummary);
  });
});
