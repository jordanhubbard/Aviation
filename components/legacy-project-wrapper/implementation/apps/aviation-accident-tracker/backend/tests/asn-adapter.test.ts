/**
 * Unit tests for the ASN adapter (src/ingest/adapters/asnAdapter.ts).
 *
 * This is the adapter the ingest pipeline actually uses; a parallel
 * class-based implementation used to live alongside it and carried the only
 * tests, so coverage moved here when that duplicate was removed.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchRecentAsn, parseAsnListPage } from '../src/ingest/adapters/asnAdapter.js';

const FETCHED_AT = '2026-01-01T00:00:00.000Z';

// ASN's year listing wraps each accident in <tr class="list"> with
// <td class="list"> cells: date, type, registration, operator, fatalities, location.
function asnRow(
  href: string,
  date: string,
  type: string,
  registration: string,
  operator: string,
  fatalities: string,
  location: string
): string {
  return `<tr class="list">
    <td class="list"><a href=${href}>${date}</a></td>
    <td class="list">${type}</td>
    <td class="list">${registration}</td>
    <td class="list">${operator}</td>
    <td class="list">${fatalities}</td>
    <td class="list">${location}</td>
  </tr>`;
}

const MOCK_ASN_HTML = `<html><body><table>
${asnRow('/database/record.php?id=20240315-1', '2024-03-15', 'Cessna 172', 'N12345', 'Private', '0', 'United States')}
${asnRow('/database/record.php?id=20240310-2', '2024-03-10', 'Boeing 737-800', 'G-XYZW', 'British Airways', '2', 'United Kingdom')}
</table></body></html>`;

describe('parseAsnListPage', () => {
  it('parses each listing row into a RawEvent', () => {
    const events = parseAsnListPage(MOCK_ASN_HTML, FETCHED_AT);
    expect(events).toHaveLength(2);

    const [first] = events;
    expect(first.source).toBe('asn');
    expect(first.registration).toBe('N12345');
    expect(first.aircraftType).toBe('Cessna 172');
    expect(first.operator).toBe('Private');
    expect(first.dateZ.slice(0, 10)).toBe('2024-03-15');
    expect(first.fetchedAt).toBe(FETCHED_AT);
    expect(first.status).toBe('preliminary');
  });

  it('builds an absolute source url from the row link', () => {
    const [first] = parseAsnListPage(MOCK_ASN_HTML, FETCHED_AT);
    expect(first.url).toBe('https://aviation-safety.net/database/record.php?id=20240315-1');
    expect(first.id).toBe(first.url);
  });

  it('parses the fatalities column', () => {
    const events = parseAsnListPage(MOCK_ASN_HTML, FETCHED_AT);
    expect(events[0].fatalities).toBe(0);
    expect(events[1].fatalities).toBe(2);
  });

  it('falls back to UNKNOWN when the registration cell is empty', () => {
    const html = `<html><table>${asnRow('/r/1', '2024-03-15', 'Cessna 172', '', 'Private', '0', 'United States')}</table></html>`;
    expect(parseAsnListPage(html, FETCHED_AT)[0].registration).toBe('UNKNOWN');
  });

  it('skips rows with too few cells', () => {
    const html = '<html><table><tr class="list"><td class="list">2024-03-15</td></tr></table></html>';
    expect(parseAsnListPage(html, FETCHED_AT)).toEqual([]);
  });

  it('skips rows whose date cannot be parsed', () => {
    const html = `<html><table>${asnRow('/r/1', 'not-a-date', 'Cessna 172', 'N12345', 'Private', '0', 'US')}</table></html>`;
    expect(parseAsnListPage(html, FETCHED_AT)).toEqual([]);
  });

  it('returns [] for markup with no listing rows', () => {
    expect(parseAsnListPage('<html><body>No table here</body></html>', FETCHED_AT)).toEqual([]);
  });
});

describe('fetchRecentAsn', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns [] when the listing responds 403', async () => {
    vi.mocked(fetch).mockImplementation(async () => new Response('Forbidden', { status: 403 }));
    await expect(fetchRecentAsn()).resolves.toEqual([]);
  });

  it('returns [] when the listing responds 429', async () => {
    vi.mocked(fetch).mockImplementation(async () => new Response('Too Many Requests', { status: 429 }));
    await expect(fetchRecentAsn()).resolves.toEqual([]);
  });

  it('returns [] when the request throws', async () => {
    vi.mocked(fetch).mockImplementation(async () => { throw new Error('Network failure'); });
    await expect(fetchRecentAsn()).resolves.toEqual([]);
  });

  it('returns [] when the page has no parseable rows', async () => {
    vi.mocked(fetch).mockImplementation(async () => new Response('<html><body>nothing</body></html>', { status: 200 }));
    await expect(fetchRecentAsn()).resolves.toEqual([]);
  });

  it('returns parsed events for a listing within the ingest window', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const html = `<html><table>${asnRow('/r/1', today, 'Cessna 172', 'N12345', 'Private', '0', 'United States')}</table></html>`;
    vi.mocked(fetch).mockImplementation(async () => new Response(html, { status: 200 }));

    const events = await fetchRecentAsn();
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].registration).toBe('N12345');
    expect(events[0].source).toBe('asn');
  });

  it('stops before events older than the ingest window', async () => {
    const html = `<html><table>${asnRow('/r/1', '1999-06-01', 'Cessna 172', 'N12345', 'Private', '0', 'United States')}</table></html>`;
    vi.mocked(fetch).mockImplementation(async () => new Response(html, { status: 200 }));
    await expect(fetchRecentAsn()).resolves.toEqual([]);
  });
});
