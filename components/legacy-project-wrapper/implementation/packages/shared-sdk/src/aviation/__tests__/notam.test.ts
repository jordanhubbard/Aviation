/**
 * Tests for the FAA NOTAM integration.
 *
 * All tests use injected mock fetch functions — no live network calls needed.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  NotamClient,
  parseNotamItem,
  categorizeNotamSeverity,
  categorizeNotam,
  isNotamEffective,
  filterRelevantNotams,
  sortNotamsBySeverity,
  formatNotamText,
  fetchNotams,
  fetchMockNotams,
  type NOTAM,
  type FaaNotamApiItem,
} from '../notam.js';

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function makeFaaItem(overrides: Partial<FaaNotamApiItem['properties']['coreNOTAMData']['notam']> = {}): FaaNotamApiItem {
  const defaults = {
    id: 'KSFO-2024-001',
    type: 'NOTAM',
    location: 'KSFO',
    scope: 'A',
    EffectiveStart: '2024-01-01T00:00:00Z',
    EffectiveEnd: '2024-12-31T23:59:59Z',
    classification: 'Class I',
    text: 'RWY 10L/28R CLSD FOR MAINTENANCE',
    plainLanguage: 'Runway 10L/28R CLOSED for maintenance.',
  };
  return {
    properties: {
      coreNOTAMData: {
        notam: { ...defaults, ...overrides },
      },
    },
  };
}

function makeNotam(overrides: Partial<NOTAM> = {}): NOTAM {
  const now = new Date();
  const future = new Date(now.getTime() + 86400000);
  return {
    id: 'test-001',
    type: 'NOTAM',
    location: 'KSFO',
    facilityType: 'AD',
    effectiveStart: now,
    effectiveEnd: future,
    classification: 'Class I',
    text: 'RWY 10L CLSD',
    severity: 'critical',
    category: 'Runway',
    ...overrides,
  };
}

// ─── parseNotamItem ───────────────────────────────────────────────────────────

describe('parseNotamItem', () => {
  it('maps id, location, text from FAA item', () => {
    const item = makeFaaItem();
    const notam = parseNotamItem(item);
    expect(notam.id).toBe('KSFO-2024-001');
    expect(notam.location).toBe('KSFO');
    expect(notam.text).toBe('Runway 10L/28R CLOSED for maintenance.');
  });

  it('prefers plainLanguage over icaoMessage for text', () => {
    const item = makeFaaItem({ plainLanguage: 'Plain text.', icaoMessage: 'Raw ICAO.' });
    expect(parseNotamItem(item).text).toBe('Plain text.');
  });

  it('falls back to traditionalMessage when plainLanguage absent', () => {
    const item = makeFaaItem({ plainLanguage: undefined, traditionalMessage: 'Traditional.', icaoMessage: 'ICAO.' });
    expect(parseNotamItem(item).text).toBe('Traditional.');
  });

  it('falls back to icaoMessage when plainLanguage and traditionalMessage absent', () => {
    const item = makeFaaItem({ plainLanguage: undefined, traditionalMessage: undefined, icaoMessage: 'ICAO msg.' });
    expect(parseNotamItem(item).text).toBe('ICAO msg.');
  });

  it('parses effectiveStart and effectiveEnd dates', () => {
    const item = makeFaaItem({
      EffectiveStart: '2024-06-01T10:00:00Z',
      EffectiveEnd: '2024-06-30T23:59:00Z',
    });
    const notam = parseNotamItem(item);
    expect(notam.effectiveStart).toBeInstanceOf(Date);
    expect(notam.effectiveEnd).toBeInstanceOf(Date);
    expect(notam.effectiveStart.toISOString()).toContain('2024-06-01');
    expect(notam.effectiveEnd.toISOString()).toContain('2024-06-30');
  });

  it('sets severity via categorizeNotamSeverity', () => {
    const item = makeFaaItem({ plainLanguage: 'Runway CLSD.' });
    expect(parseNotamItem(item).severity).toBe('critical');
  });

  it('sets category via categorizeNotam', () => {
    const item = makeFaaItem({ plainLanguage: 'RWY 28 closed.' });
    expect(parseNotamItem(item).category).toBe('Runway');
  });

  it('handles empty/missing properties gracefully', () => {
    const item: FaaNotamApiItem = {};
    const notam = parseNotamItem(item);
    expect(notam.text).toBe('');
    expect(notam.location).toBe('');
    expect(notam.severity).toBe('low');
  });
});

// ─── categorizeNotamSeverity ──────────────────────────────────────────────────

describe('categorizeNotamSeverity', () => {
  it.each([
    ['RWY 10 CLSD', 'critical'],
    ['VOR OUT OF SERVICE', 'critical'],
    ['ILS U/S', 'critical'],
    ['CRANE 500FT AGL ERECTED', 'high'],
    ['CONSTRUCTION NEAR TWY B', 'high'],
    ['PAPI OTS', 'medium'],
    ['LIGHTING LGT REDUCED', 'medium'],
    ['TAXIWAY MARKINGS FADED', 'low'],
  ])('"%s" → %s', (text, expected) => {
    const notam = makeNotam({ text });
    expect(categorizeNotamSeverity(notam)).toBe(expected);
  });
});

// ─── categorizeNotam ─────────────────────────────────────────────────────────

describe('categorizeNotam', () => {
  it.each([
    ['RWY 10L CLSD', 'Runway'],
    ['TWY ALPHA CLOSED', 'Taxiway'],
    ['APRON EAST CLOSED', 'Apron/Ramp'],
    ['RAMP AREA RESTRICTED', 'Apron/Ramp'],
    ['LIGHTING OUT', 'Lighting'],
    ['VOR UNSERVICEABLE', 'Navigation'],
    ['ILS 28L OUT OF SERVICE', 'Navigation'],
    ['OBST CRANE 250FT', 'Obstacle'],
    ['AIRSPACE RESTRICTED', 'Airspace'],
    ['TFR IN EFFECT', 'Airspace'],
    ['ATIS FREQ CHANGED', 'Communications'],
    ['FUEL NOT AVAILABLE', 'Fuel'],
    ['WEATHER MINIMA CHANGE', 'Weather'],
    ['GENERAL NOTAM', 'General'],
  ])('"%s" → %s', (text, expected) => {
    expect(categorizeNotam(text)).toBe(expected);
  });
});

// ─── isNotamEffective ─────────────────────────────────────────────────────────

describe('isNotamEffective', () => {
  it('returns true when checkDate is within the effective window', () => {
    const now = new Date();
    const notam = makeNotam({
      effectiveStart: new Date(now.getTime() - 3600000),
      effectiveEnd: new Date(now.getTime() + 3600000),
    });
    expect(isNotamEffective(notam, now)).toBe(true);
  });

  it('returns false when checkDate is before effectiveStart', () => {
    const now = new Date();
    const notam = makeNotam({
      effectiveStart: new Date(now.getTime() + 3600000),
      effectiveEnd: new Date(now.getTime() + 7200000),
    });
    expect(isNotamEffective(notam, now)).toBe(false);
  });

  it('returns false when checkDate is after effectiveEnd', () => {
    const now = new Date();
    const notam = makeNotam({
      effectiveStart: new Date(now.getTime() - 7200000),
      effectiveEnd: new Date(now.getTime() - 3600000),
    });
    expect(isNotamEffective(notam, now)).toBe(false);
  });

  it('uses current time when checkDate is not provided', () => {
    const now = new Date();
    const notam = makeNotam({
      effectiveStart: new Date(now.getTime() - 1000),
      effectiveEnd: new Date(now.getTime() + 1000),
    });
    expect(isNotamEffective(notam)).toBe(true);
  });
});

// ─── filterRelevantNotams ─────────────────────────────────────────────────────

describe('filterRelevantNotams', () => {
  const now = new Date();
  const active = (loc: string, facilityType = 'AD') =>
    makeNotam({
      id: loc,
      location: loc,
      facilityType,
      effectiveStart: new Date(now.getTime() - 1000),
      effectiveEnd: new Date(now.getTime() + 86400000),
    });
  const expired = (loc: string) =>
    makeNotam({
      id: `${loc}-exp`,
      location: loc,
      effectiveStart: new Date(now.getTime() - 7200000),
      effectiveEnd: new Date(now.getTime() - 3600000),
    });

  it('includes active NOTAMs for route ICAOs', () => {
    const notams = [active('KSFO'), active('KOAK'), active('KSJC')];
    const result = filterRelevantNotams(notams, ['KSFO', 'KOAK']);
    expect(result.map((n) => n.id)).toContain('KSFO');
    expect(result.map((n) => n.id)).toContain('KOAK');
    expect(result.map((n) => n.id)).not.toContain('KSJC');
  });

  it('excludes expired NOTAMs', () => {
    const notams = [active('KSFO'), expired('KSFO')];
    const result = filterRelevantNotams(notams, ['KSFO']);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('KSFO');
  });

  it('includes en-route NOTAMs when includeEnroute=true', () => {
    const enRoute = active('ZZZZ', 'EN');
    const result = filterRelevantNotams([enRoute], [], true);
    expect(result).toHaveLength(1);
  });

  it('excludes en-route NOTAMs when includeEnroute=false (default)', () => {
    const enRoute = active('ZZZZ', 'EN');
    const result = filterRelevantNotams([enRoute], []);
    expect(result).toHaveLength(0);
  });
});

// ─── sortNotamsBySeverity ─────────────────────────────────────────────────────

describe('sortNotamsBySeverity', () => {
  it('sorts critical > high > medium > low', () => {
    const notams = [
      makeNotam({ id: 'low', severity: 'low' }),
      makeNotam({ id: 'high', severity: 'high' }),
      makeNotam({ id: 'critical', severity: 'critical' }),
      makeNotam({ id: 'medium', severity: 'medium' }),
    ];
    const sorted = sortNotamsBySeverity(notams);
    expect(sorted.map((n) => n.severity)).toEqual(['critical', 'high', 'medium', 'low']);
  });

  it('does not mutate the input array', () => {
    const notams = [makeNotam({ severity: 'low' }), makeNotam({ severity: 'critical' })];
    const original = [...notams];
    sortNotamsBySeverity(notams);
    expect(notams[0].severity).toBe(original[0].severity);
  });
});

// ─── formatNotamText ──────────────────────────────────────────────────────────

describe('formatNotamText', () => {
  it('expands RWY to Runway', () => {
    expect(formatNotamText('RWY 10L CLSD')).toContain('Runway');
  });
  it('expands TWY to Taxiway', () => {
    expect(formatNotamText('TWY A OTS')).toContain('Taxiway');
  });
  it('expands CLSD to CLOSED', () => {
    expect(formatNotamText('RWY CLSD')).toContain('CLOSED');
  });
  it('expands U/S to Out of Service', () => {
    expect(formatNotamText('ILS U/S')).toContain('Out of Service');
  });
  it('collapses multiple spaces', () => {
    expect(formatNotamText('RWY  10L   CLSD')).toMatch(/^Runway 10L CLOSED$/);
  });
});

// ─── NotamClient ─────────────────────────────────────────────────────────────

describe('NotamClient', () => {
  const sampleApiResponse = {
    items: [
      makeFaaItem({ id: 'A0001/24', location: 'KSFO', plainLanguage: 'RWY 28R CLSD' }),
      makeFaaItem({ id: 'A0002/24', location: 'KSFO', plainLanguage: 'OBST CRANE ERECTED' }),
    ],
  };

  it('calls the FAA NOTAM API with correct URL and headers', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const mockFetch = async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return { ok: true, json: async () => sampleApiResponse } as Response;
    };

    const client = new NotamClient({ apiKey: 'test-key', fetchFn: mockFetch as unknown as typeof fetch });
    await client.fetchByIcao('KSFO');

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain('icaoLocation=KSFO');
    expect(calls[0].init?.headers).toMatchObject({ client_id: 'test-key' });
  });

  it('returns parsed NOTAMs from a successful API response', async () => {
    const mockFetch = async () =>
      ({ ok: true, json: async () => sampleApiResponse }) as Response;

    const client = new NotamClient({ apiKey: 'key', fetchFn: mockFetch as unknown as typeof fetch });
    const notams = await client.fetchByIcao('KSFO');

    expect(notams).toHaveLength(2);
    expect(notams[0].id).toBe('A0001/24');
    expect(notams[0].severity).toBe('critical'); // RWY CLSD
    expect(notams[1].severity).toBe('high');     // OBST CRANE
  });

  it('throws on non-2xx HTTP status', async () => {
    const mockFetch = async () =>
      ({ ok: false, status: 403 }) as Response;

    const client = new NotamClient({ apiKey: 'bad-key', fetchFn: mockFetch as unknown as typeof fetch });
    await expect(client.fetchByIcao('KSFO')).rejects.toThrow('HTTP 403');
  });

  it('returns empty array when API returns no items', async () => {
    const mockFetch = async () =>
      ({ ok: true, json: async () => ({}) }) as Response;

    const client = new NotamClient({ fetchFn: mockFetch as unknown as typeof fetch });
    const notams = await client.fetchByIcao('KSFO');
    expect(notams).toHaveLength(0);
  });

  it('fetchForRoute de-duplicates by id across airports', async () => {
    let callCount = 0;
    const mockFetch = async (url: string | URL | Request) => {
      callCount++;
      // Both airports return the same NOTAM id
      return { ok: true, json: async () => ({ items: [makeFaaItem({ id: 'SHARED-001' })] }) } as Response;
    };

    const client = new NotamClient({ fetchFn: mockFetch as unknown as typeof fetch });
    const notams = await client.fetchForRoute(['KSFO', 'KOAK']);

    expect(callCount).toBe(2);
    expect(notams).toHaveLength(1); // de-duplicated
  });

  it('appends radius param when radiusNm > 0', async () => {
    const calls: string[] = [];
    const mockFetch = async (url: string | URL | Request) => {
      calls.push(String(url));
      return { ok: true, json: async () => ({}) } as Response;
    };

    const client = new NotamClient({ fetchFn: mockFetch as unknown as typeof fetch });
    await client.fetchByIcao('KSFO', 50);

    expect(calls[0]).toContain('radius=50');
  });
});

// ─── fetchNotams (convenience wrapper) ───────────────────────────────────────

describe('fetchNotams', () => {
  it('calls NotamClient.fetchByIcao when icao param is provided', async () => {
    const mockFetch = async () =>
      ({ ok: true, json: async () => ({ items: [makeFaaItem()] }) }) as Response;

    const notams = await fetchNotams({ icao: 'KSFO' }, { fetchFn: mockFetch as unknown as typeof fetch });
    expect(notams).toHaveLength(1);
  });

  it('returns empty array when no icao provided', async () => {
    const notams = await fetchNotams({});
    expect(notams).toEqual([]);
  });

  it('falls back to mock data when API fails and no key is configured', async () => {
    const mockFetch = async () => ({ ok: false, status: 401 }) as Response;

    // Temporarily clear env key
    const saved = process.env.FAA_NOTAM_API_KEY;
    delete process.env.FAA_NOTAM_API_KEY;

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const notams = await fetchNotams(
      { icao: 'KSFO' },
      { fetchFn: mockFetch as unknown as typeof fetch, apiKey: '' }
    );

    expect(notams.length).toBeGreaterThan(0); // mock data returned
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('FAA API call failed'));

    warnSpy.mockRestore();
    if (saved !== undefined) process.env.FAA_NOTAM_API_KEY = saved;
  });

  it('rethrows when API fails and a key is configured', async () => {
    const mockFetch = async () => ({ ok: false, status: 403 }) as Response;

    await expect(
      fetchNotams({ icao: 'KSFO' }, { apiKey: 'real-key', fetchFn: mockFetch as unknown as typeof fetch })
    ).rejects.toThrow('HTTP 403');
  });
});

// ─── fetchMockNotams ──────────────────────────────────────────────────────────

describe('fetchMockNotams', () => {
  it('returns NOTAMs with the requested ICAO as location', async () => {
    const notams = await fetchMockNotams('KLAX');
    expect(notams.length).toBeGreaterThan(0);
    notams.forEach((n) => expect(n.location).toBe('KLAX'));
  });

  it('returns at least one critical NOTAM (runway closed)', async () => {
    const notams = await fetchMockNotams('KORD');
    expect(notams.some((n) => n.severity === 'critical')).toBe(true);
  });
});
