/**
 * Tests for the FAA NOTAM integration.
 *
 * All tests use injected mock fetch functions — no live network calls needed.
 */
import { describe, it, expect } from 'vitest';
import { nmsNotice, nmsPage } from './notam-reports.fixtures.js';
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

describe('NotamClient compatibility against the cached service', () => {
  it('sends no FAA key or browser credentials and uses a source-scoped query', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const client = new NotamClient({ apiKey: 'must-not-be-forwarded', fetchFn: async (url, init) => {
      calls.push({ url: String(url), init }); return new Response(JSON.stringify(nmsPage()));
    } });
    const rows = await client.fetchByIcao('KSFO');
    expect(rows[0].id).toBe('A0001/26'); expect(rows[0].severity).toBe('critical');
    expect(calls).toHaveLength(1); expect(calls[0].url).toContain('airport=KSFO');
    expect(calls[0].init?.headers).toEqual({ Accept: 'application/json' });
    expect(calls[0].init?.credentials).toBe('omit'); expect(calls[0].init?.redirect).toBe('error');
    expect(JSON.stringify(calls)).not.toContain('must-not-be-forwarded');
  });
  it('rejects malformed envelopes instead of claiming an empty result', async () => {
    const client = new NotamClient({ fetchFn: async () => new Response('{}') });
    await expect(client.fetchByIcao('KSFO')).rejects.toThrow('invalid');
  });
  it('returns an empty array only for an explicit current production no-reports response', async () => {
    const client = new NotamClient({ fetchFn: async () => new Response(JSON.stringify(nmsPage([]))) });
    expect(await client.fetchByIcao('KSFO')).toEqual([]);
  });
  it('fetches a route in one cached-service query', async () => {
    let count = 0;
    const client = new NotamClient({ fetchFn: async () => { count++; return new Response(JSON.stringify(nmsPage([nmsNotice({ id: 'shared' })], { requested_locations: ['KOAK', 'KSFO'] }))); } });
    expect(await client.fetchForRoute(['KSFO', 'KOAK'])).toHaveLength(1); expect(count).toBe(1);
  });
  it('does not imply unsupported radius coverage', async () => {
    await expect(new NotamClient().fetchByIcao('KSFO', 50)).rejects.toThrow('radius coverage');
  });
  it.each(['stale', 'partial', 'unavailable'] as const)('does not project %s reports into a complete legacy array', async status => {
    const client = new NotamClient({ fetchFn: async () => new Response(JSON.stringify(nmsPage([], { status }))) });
    await expect(client.fetchByIcao('KSFO')).rejects.toThrow('production NOTAM reports required');
  });
  it('preserves permanent reports in the rich API and refuses a fake legacy expiry', async () => {
    const page = nmsPage([nmsNotice({ permanent: true, effective_end_utc: null })]);
    const client = new NotamClient({ fetchFn: async () => new Response(JSON.stringify(page)) });
    expect((await client.fetchReportsByIcao('KSFO')).notams[0].permanent).toBe(true);
    await expect(client.fetchByIcao('KSFO')).rejects.toThrow('legacy dated shape');
  });
});

describe('fetchNotams compatibility', () => {
  it('uses the cached production source for an ICAO request', async () => {
    expect(await fetchNotams({ icao: 'KSFO' }, { fetchFn: async () => new Response(JSON.stringify(nmsPage())) })).toHaveLength(1);
  });
  it('makes no request for empty input', async () => { expect(await fetchNotams({})).toEqual([]); });
  it.each(['', 'configured-key'])('never falls back to sample data after failure (key=%s)', async apiKey => {
    await expect(fetchNotams({ icao: 'KSFO' }, { apiKey, fetchFn: async () => new Response('', { status: 503 }) })).rejects.toThrow('HTTP 503');
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
