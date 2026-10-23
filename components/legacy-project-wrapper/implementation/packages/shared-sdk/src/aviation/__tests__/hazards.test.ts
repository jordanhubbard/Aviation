/**
 * Hazard module tests — fully hermetic, no live network calls.
 *
 * Fixtures under ./fixtures/ contain captured-style GeoJSON responses.
 * The "now" reference used throughout is pinned to 2099-01-26T06:00:00Z so
 * all future-dated fixture records are active and the two expired records
 * are reliably expired.
 */

import { describe, it, expect } from 'vitest';
import {
  // Types
  Hazard,
  HazardKind,
  LatLon,
  GeoPolygon,
  RawAwcCollection,
  RawFaaTfrCollection,
  // Parsing helpers
  parseDateSafe,
  awcCoordsToLatLon,
  deriveSeverity,
  parseAwcFeature,
  parseFaaTfrFeature,
  // Geometry
  pointInPolygon,
  altitudeOverlaps,
  hazardIntersectsLeg,
  // Temporal
  isHazardActive,
  filterActiveHazards,
  // Route
  findRouteHazards,
  // Client
  HazardClient,
} from '../hazards.js';

import sigmetFixture from './fixtures/sigmets.json';
import airmetFixture from './fixtures/airmets.json';
import tfrFixture from './fixtures/tfrs.json';

// Pinned reference time: all fixture records with validTimeTo in year 2099
// are active; records with validTimeTo in year 2000 are expired.
const REF_NOW = new Date('2099-01-26T06:00:00Z');

// ---------------------------------------------------------------------------
// parseDateSafe
// ---------------------------------------------------------------------------
describe('parseDateSafe', () => {
  it('parses a valid ISO-8601 string', () => {
    const d = parseDateSafe('2099-01-26T06:00:00Z');
    expect(d.getFullYear()).toBe(2099);
  });

  it('returns epoch 0 for null/undefined', () => {
    expect(parseDateSafe(null).getTime()).toBe(0);
    expect(parseDateSafe(undefined).getTime()).toBe(0);
  });

  it('returns epoch 0 for an unparseable string', () => {
    expect(parseDateSafe('not-a-date').getTime()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// awcCoordsToLatLon
// ---------------------------------------------------------------------------
describe('awcCoordsToLatLon', () => {
  it('converts [lon, lat] pairs to LatLon objects', () => {
    const raw = [[-122.5, 37.5], [-121.5, 38.5]];
    const result = awcCoordsToLatLon(raw);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ lat: 37.5, lon: -122.5 });
    expect(result[1]).toEqual({ lat: 38.5, lon: -121.5 });
  });

  it('returns [] for non-array input', () => {
    expect(awcCoordsToLatLon(null)).toEqual([]);
    expect(awcCoordsToLatLon('bad')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// deriveSeverity
// ---------------------------------------------------------------------------
describe('deriveSeverity', () => {
  it('SIGMET CONVECTIVE => warning', () => {
    expect(deriveSeverity('SIGMET', 'CONVECTIVE')).toBe('warning');
  });

  it('SIGMET NON-CONVECTIVE => watch', () => {
    expect(deriveSeverity('SIGMET', 'NON-CONVECTIVE')).toBe('watch');
  });

  it('AIRMET SIERRA => watch', () => {
    expect(deriveSeverity('AIRMET', 'SIERRA')).toBe('watch');
  });

  it('TFR SECURITY => emergency', () => {
    expect(deriveSeverity('TFR', 'SECURITY')).toBe('emergency');
  });

  it('TFR SFRA => emergency', () => {
    expect(deriveSeverity('TFR', 'SFRA')).toBe('emergency');
  });

  it('TFR VIP => advisory', () => {
    expect(deriveSeverity('TFR', 'VIP')).toBe('advisory');
  });
});

// ---------------------------------------------------------------------------
// parseAwcFeature — SIGMET fixture
// ---------------------------------------------------------------------------
describe('parseAwcFeature (SIGMET)', () => {
  it('parses an active convective SIGMET', () => {
    const feature = (sigmetFixture as RawAwcCollection).features[0];
    const hazard = parseAwcFeature(feature, 'SIGMET', REF_NOW);
    expect(hazard).not.toBeNull();
    expect(hazard!.kind).toBe('SIGMET');
    expect(hazard!.subType).toBe('CONVECTIVE');
    expect(hazard!.severity).toBe('warning');
    expect(hazard!.id).toBe('SIGI01');
    expect(hazard!.altitudeBandFt.floor).toBe(10000);
    expect(hazard!.altitudeBandFt.ceiling).toBe(45000);
    expect(hazard!.geometry.type).toBe('Polygon');
  });

  it('parses an active non-convective SIGMET', () => {
    const feature = (sigmetFixture as RawAwcCollection).features[1];
    const hazard = parseAwcFeature(feature, 'SIGMET', REF_NOW);
    expect(hazard).not.toBeNull();
    expect(hazard!.severity).toBe('watch');
    expect(hazard!.subType).toBe('NON-CONVECTIVE');
  });

  it('returns null for an expired SIGMET', () => {
    const expiredFeature = (sigmetFixture as RawAwcCollection).features[2];
    const hazard = parseAwcFeature(expiredFeature, 'SIGMET', REF_NOW);
    expect(hazard).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// parseAwcFeature — AIRMET fixture
// ---------------------------------------------------------------------------
describe('parseAwcFeature (AIRMET)', () => {
  it('parses AIRMET SIERRA', () => {
    const feature = (airmetFixture as RawAwcCollection).features[0];
    const hazard = parseAwcFeature(feature, 'AIRMET', REF_NOW);
    expect(hazard).not.toBeNull();
    expect(hazard!.kind).toBe('AIRMET');
    expect(hazard!.subType).toBe('SIERRA');
    expect(hazard!.severity).toBe('watch');
  });

  it('parses AIRMET TANGO', () => {
    const feature = (airmetFixture as RawAwcCollection).features[1];
    const hazard = parseAwcFeature(feature, 'AIRMET', REF_NOW);
    expect(hazard).not.toBeNull();
    expect(hazard!.subType).toBe('TANGO');
    expect(hazard!.altitudeBandFt.floor).toBe(8000);
    expect(hazard!.altitudeBandFt.ceiling).toBe(25000);
  });

  it('parses AIRMET ZULU', () => {
    const feature = (airmetFixture as RawAwcCollection).features[2];
    const hazard = parseAwcFeature(feature, 'AIRMET', REF_NOW);
    expect(hazard).not.toBeNull();
    expect(hazard!.subType).toBe('ZULU');
  });
});

// ---------------------------------------------------------------------------
// parseFaaTfrFeature — TFR fixture
// ---------------------------------------------------------------------------
describe('parseFaaTfrFeature (TFR)', () => {
  it('parses a VIP TFR', () => {
    const feature = (tfrFixture as RawFaaTfrCollection).features[0];
    const hazard = parseFaaTfrFeature(feature, REF_NOW);
    expect(hazard).not.toBeNull();
    expect(hazard!.kind).toBe('TFR');
    expect(hazard!.subType).toBe('VIP');
    expect(hazard!.severity).toBe('advisory');
    expect(hazard!.id).toBe('0/7812');
    expect(hazard!.altitudeBandFt.floor).toBe(0);
    expect(hazard!.altitudeBandFt.ceiling).toBe(18000);
  });

  it('parses a SECURITY (SFRA) TFR as emergency', () => {
    const feature = (tfrFixture as RawFaaTfrCollection).features[1];
    const hazard = parseFaaTfrFeature(feature, REF_NOW);
    expect(hazard).not.toBeNull();
    expect(hazard!.severity).toBe('emergency');
    expect(hazard!.subType).toBe('SECURITY');
  });

  it('returns null for an expired TFR', () => {
    const expiredFeature = (tfrFixture as RawFaaTfrCollection).features[3];
    const hazard = parseFaaTfrFeature(expiredFeature, REF_NOW);
    expect(hazard).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// pointInPolygon
// ---------------------------------------------------------------------------
describe('pointInPolygon', () => {
  // Unit square polygon: (0,0)→(1,0)→(1,1)→(0,1)
  const square: LatLon[] = [
    { lat: 0, lon: 0 },
    { lat: 0, lon: 1 },
    { lat: 1, lon: 1 },
    { lat: 1, lon: 0 },
  ];

  it('returns true for a point inside the polygon', () => {
    expect(pointInPolygon({ lat: 0.5, lon: 0.5 }, square)).toBe(true);
  });

  it('returns false for a point clearly outside', () => {
    expect(pointInPolygon({ lat: 5, lon: 5 }, square)).toBe(false);
  });

  it('returns false for a point just outside the edge', () => {
    expect(pointInPolygon({ lat: 0.5, lon: 1.5 }, square)).toBe(false);
  });

  it('handles the SIGMET polygon from the fixture', () => {
    const feature = (sigmetFixture as RawAwcCollection).features[0];
    const hazard = parseAwcFeature(feature, 'SIGMET', REF_NOW)!;
    const poly = (hazard.geometry as GeoPolygon).coordinates;
    // KSFO area (37.6, -122.4) is inside the SIGMET polygon
    expect(pointInPolygon({ lat: 37.8, lon: -122.0 }, poly)).toBe(true);
    // KJFK area (40.6, -73.8) is well outside
    expect(pointInPolygon({ lat: 40.6, lon: -73.8 }, poly)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// altitudeOverlaps
// ---------------------------------------------------------------------------
describe('altitudeOverlaps', () => {
  const makeHazard = (floor: number | null, ceiling: number | null): Hazard =>
    ({
      altitudeBandFt: { floor, ceiling },
    } as unknown as Hazard);

  it('returns true when ranges fully overlap', () => {
    const h = makeHazard(10000, 45000);
    expect(altitudeOverlaps(h, 15000, 25000)).toBe(true);
  });

  it('returns true when route range spans the hazard band', () => {
    const h = makeHazard(15000, 20000);
    expect(altitudeOverlaps(h, 5000, 30000)).toBe(true);
  });

  it('returns false when route is entirely below hazard floor', () => {
    const h = makeHazard(18000, 35000);
    expect(altitudeOverlaps(h, 1000, 8000)).toBe(false);
  });

  it('returns false when route is entirely above hazard ceiling', () => {
    const h = makeHazard(5000, 12000);
    expect(altitudeOverlaps(h, 15000, 20000)).toBe(false);
  });

  it('treats null floor as 0 and null ceiling as 60000', () => {
    const h = makeHazard(null, null);
    expect(altitudeOverlaps(h, 0, 500)).toBe(true);
    expect(altitudeOverlaps(h, 55000, 60000)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isHazardActive / filterActiveHazards
// ---------------------------------------------------------------------------
describe('isHazardActive', () => {
  const makeHazardWithTimes = (from: string, to: string): Hazard =>
    ({
      validFrom: new Date(from),
      validTo: new Date(to),
    } as unknown as Hazard);

  it('returns true for an active hazard', () => {
    const h = makeHazardWithTimes('2099-01-26T00:00:00Z', '2099-01-26T12:00:00Z');
    expect(isHazardActive(h, REF_NOW)).toBe(true);
  });

  it('returns false for a hazard before its valid time', () => {
    const h = makeHazardWithTimes('2099-01-26T08:00:00Z', '2099-01-26T12:00:00Z');
    expect(isHazardActive(h, REF_NOW)).toBe(false);
  });

  it('returns false for an expired hazard', () => {
    const h = makeHazardWithTimes('2099-01-25T00:00:00Z', '2099-01-25T06:00:00Z');
    expect(isHazardActive(h, REF_NOW)).toBe(false);
  });
});

describe('filterActiveHazards', () => {
  it('only returns active hazards', () => {
    const active: Hazard = {
      validFrom: new Date('2099-01-26T00:00:00Z'),
      validTo: new Date('2099-01-26T12:00:00Z'),
    } as unknown as Hazard;

    const expired: Hazard = {
      validFrom: new Date('2000-01-01T00:00:00Z'),
      validTo: new Date('2000-01-01T06:00:00Z'),
    } as unknown as Hazard;

    const result = filterActiveHazards([active, expired], REF_NOW);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(active);
  });
});

// ---------------------------------------------------------------------------
// hazardIntersectsLeg
// ---------------------------------------------------------------------------
describe('hazardIntersectsLeg', () => {
  const makeActiveHazard = (poly: LatLon[], floor: number, ceiling: number): Hazard => ({
    id: 'test',
    kind: 'SIGMET' as HazardKind,
    subType: 'CONVECTIVE',
    summary: 'test',
    geometry: { type: 'Polygon', coordinates: poly },
    altitudeBandFt: { floor, ceiling },
    validFrom: new Date('2099-01-26T00:00:00Z'),
    validTo: new Date('2099-01-26T12:00:00Z'),
    severity: 'warning',
  } as Hazard);

  const box: LatLon[] = [
    { lat: 0, lon: 0 },
    { lat: 0, lon: 10 },
    { lat: 10, lon: 10 },
    { lat: 10, lon: 0 },
  ];

  it('detects intersection when leg endpoint is inside polygon', () => {
    const h = makeActiveHazard(box, 5000, 15000);
    const start: LatLon = { lat: 5, lon: 5 }; // inside
    const end: LatLon = { lat: 20, lon: 20 };  // outside
    expect(hazardIntersectsLeg(h, start, end, 9000, 11000, REF_NOW)).toBe(true);
  });

  it('detects intersection when midpoint is inside polygon', () => {
    const h = makeActiveHazard(box, 5000, 15000);
    const start: LatLon = { lat: -5, lon: 5 };
    const end: LatLon = { lat: 15, lon: 5 };
    // mid = {lat:5, lon:5} which is inside
    expect(hazardIntersectsLeg(h, start, end, 9000, 11000, REF_NOW)).toBe(true);
  });

  it('returns false when route altitude does not overlap hazard band', () => {
    const h = makeActiveHazard(box, 18000, 35000);
    const start: LatLon = { lat: 5, lon: 5 };
    const end: LatLon = { lat: 6, lon: 6 };
    // Cruise altitude 2000 ft — well below SIGMET floor
    expect(hazardIntersectsLeg(h, start, end, 1500, 2500, REF_NOW)).toBe(false);
  });

  it('returns false when leg is entirely outside polygon', () => {
    const h = makeActiveHazard(box, 5000, 15000);
    const start: LatLon = { lat: 20, lon: 20 };
    const end: LatLon = { lat: 30, lon: 30 };
    expect(hazardIntersectsLeg(h, start, end, 9000, 11000, REF_NOW)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// findRouteHazards
// ---------------------------------------------------------------------------
describe('findRouteHazards', () => {
  it('finds SIGMET intersecting a route leg', () => {
    const feature = (sigmetFixture as RawAwcCollection).features[0];
    const sigmet = parseAwcFeature(feature, 'SIGMET', REF_NOW)!;

    // Route: KSFO → KOAK — passes through the SIGMET polygon (approx bay area)
    const waypoints: LatLon[] = [
      { lat: 37.6, lon: -122.4 }, // KSFO
      { lat: 37.7, lon: -122.2 }, // KOAK
    ];

    const results = findRouteHazards(waypoints, 12000, [sigmet], REF_NOW);
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].hazard.id).toBe('SIGI01');
  });

  it('returns no results when route avoids all hazards', () => {
    const feature = (sigmetFixture as RawAwcCollection).features[0];
    const sigmet = parseAwcFeature(feature, 'SIGMET', REF_NOW)!;

    // Route well outside the SIGMET polygon (east coast)
    const waypoints: LatLon[] = [
      { lat: 40.6, lon: -73.8 },
      { lat: 41.9, lon: -87.9 },
    ];

    const results = findRouteHazards(waypoints, 12000, [sigmet], REF_NOW);
    expect(results).toHaveLength(0);
  });

  it('skips expired hazards', () => {
    const feature = (sigmetFixture as RawAwcCollection).features[2]; // expired
    const sigmet = parseAwcFeature(feature, 'SIGMET', new Date('2000-01-01T05:00:00Z'))!;
    // sigmet is "active" relative to year-2000 time but expired relative to REF_NOW
    // findRouteHazards passes REF_NOW to filterActiveHazards
    const waypoints: LatLon[] = [
      { lat: 35.5, lon: -119.5 },
      { lat: 35.8, lon: -119.2 },
    ];
    const results = findRouteHazards(waypoints, 12000, [sigmet], REF_NOW);
    expect(results).toHaveLength(0);
  });

  it('handles empty waypoints list gracefully', () => {
    const results = findRouteHazards([], 10000, [], REF_NOW);
    expect(results).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// HazardClient — hermetic fetch mocks
// ---------------------------------------------------------------------------
describe('HazardClient', () => {
  // Build a mock fetch that returns a specific fixture
  const makeMockFetch =
    (payload: unknown) =>
    async (_url: string): Promise<Response> =>
      ({
        ok: true,
        status: 200,
        json: async () => payload,
      } as unknown as Response);

  const makeMockFetchError = async (_url: string): Promise<Response> =>
    ({ ok: false, status: 503 } as unknown as Response);

  it('fetchSigmets returns active SIGMETs from fixture', async () => {
    const client = new HazardClient({ fetchFn: makeMockFetch(sigmetFixture) });
    const hazards = await client.fetchSigmets(REF_NOW);
    // Fixture has 2 active + 1 expired → should return 2
    expect(hazards).toHaveLength(2);
    expect(hazards.every((h) => h.kind === 'SIGMET')).toBe(true);
  });

  it('fetchAirmets returns all 3 active AIRMETs from fixture', async () => {
    const client = new HazardClient({ fetchFn: makeMockFetch(airmetFixture) });
    const hazards = await client.fetchAirmets(REF_NOW);
    expect(hazards).toHaveLength(3);
    expect(hazards.every((h) => h.kind === 'AIRMET')).toBe(true);
  });

  it('fetchTfrs returns 3 active TFRs (filters 1 expired)', async () => {
    const client = new HazardClient({ fetchFn: makeMockFetch(tfrFixture) });
    const hazards = await client.fetchTfrs(REF_NOW);
    // Fixture has 4 features: VIP, SECURITY, SPECIAL_EVENT, EXPIRED
    expect(hazards).toHaveLength(3);
    expect(hazards.every((h) => h.kind === 'TFR')).toBe(true);
    expect(hazards.find((h) => h.id === 'EXPIRED-001')).toBeUndefined();
  });

  it('fetchAll merges all three hazard types', async () => {
    let callCount = 0;
    const fixtures = [sigmetFixture, airmetFixture, tfrFixture];
    const roundRobinFetch = async (_url: string): Promise<Response> => {
      const idx = callCount % 3;
      callCount++;
      return {
        ok: true,
        status: 200,
        json: async () => fixtures[idx],
      } as unknown as Response;
    };

    const client = new HazardClient({ fetchFn: roundRobinFetch });
    const hazards = await client.fetchAll(REF_NOW);
    // 2 SIGMETs + 3 AIRMETs + 3 TFRs = 8
    expect(hazards).toHaveLength(8);
    const kinds = new Set(hazards.map((h) => h.kind));
    expect(kinds.has('SIGMET')).toBe(true);
    expect(kinds.has('AIRMET')).toBe(true);
    expect(kinds.has('TFR')).toBe(true);
  });

  it('throws on HTTP error from SIGMET endpoint', async () => {
    const client = new HazardClient({ fetchFn: makeMockFetchError });
    await expect(client.fetchSigmets(REF_NOW)).rejects.toThrow(/SIGMET fetch failed/);
  });

  it('throws on HTTP error from AIRMET endpoint', async () => {
    const client = new HazardClient({ fetchFn: makeMockFetchError });
    await expect(client.fetchAirmets(REF_NOW)).rejects.toThrow(/AIRMET fetch failed/);
  });

  it('throws on HTTP error from TFR endpoint', async () => {
    const client = new HazardClient({ fetchFn: makeMockFetchError });
    await expect(client.fetchTfrs(REF_NOW)).rejects.toThrow(/TFR fetch failed/);
  });

  it('uses custom base URLs when provided', async () => {
    let capturedUrl = '';
    const captureFetch = async (url: string): Promise<Response> => {
      capturedUrl = url;
      return {
        ok: true,
        status: 200,
        json: async () => ({ type: 'FeatureCollection', features: [] }),
      } as unknown as Response;
    };

    const client = new HazardClient({
      awcBaseUrl: 'https://test.example.com/awc',
      fetchFn: captureFetch,
    });
    await client.fetchSigmets(REF_NOW);
    expect(capturedUrl).toContain('test.example.com/awc');
  });
});

// ---------------------------------------------------------------------------
// End-to-end: parse all fixtures + route intersection
// ---------------------------------------------------------------------------
describe('end-to-end route briefing', () => {
  it('identifies SIGMET hazard on KSFO→KOAK route at 12000 ft', async () => {
    // Parse fixtures like the client would
    const hazards: Hazard[] = [];

    for (const f of (sigmetFixture as RawAwcCollection).features) {
      const h = parseAwcFeature(f, 'SIGMET', REF_NOW);
      if (h) hazards.push(h);
    }
    for (const f of (airmetFixture as RawAwcCollection).features) {
      const h = parseAwcFeature(f, 'AIRMET', REF_NOW);
      if (h) hazards.push(h);
    }
    for (const f of (tfrFixture as RawFaaTfrCollection).features) {
      const h = parseFaaTfrFeature(f, REF_NOW);
      if (h) hazards.push(h);
    }

    // Total active: 2 SIGMET + 3 AIRMET + 3 TFR = 8
    expect(hazards).toHaveLength(8);

    // Route through the SIGMET polygon (bay area)
    const route: LatLon[] = [
      { lat: 37.6, lon: -122.4 }, // KSFO
      { lat: 37.7, lon: -122.2 }, // KOAK
    ];

    const hits = findRouteHazards(route, 12000, hazards, REF_NOW);
    expect(hits.length).toBeGreaterThanOrEqual(1);
    // The convective SIGMET should be flagged
    const convective = hits.find((r) => r.hazard.subType === 'CONVECTIVE');
    expect(convective).toBeDefined();
    expect(convective!.hazard.severity).toBe('warning');
  });

  it('returns no hazards for a cruise at low altitude below all SIGMET floors', () => {
    const hazards: Hazard[] = [];
    for (const f of (sigmetFixture as RawAwcCollection).features) {
      const h = parseAwcFeature(f, 'SIGMET', REF_NOW);
      if (h) hazards.push(h);
    }

    // SIGMETs start at 10000 ft — fly at 1500 ft VFR
    const route: LatLon[] = [
      { lat: 37.6, lon: -122.4 },
      { lat: 37.7, lon: -122.2 },
    ];
    const hits = findRouteHazards(route, 1500, hazards, REF_NOW);
    expect(hits).toHaveLength(0);
  });
});
