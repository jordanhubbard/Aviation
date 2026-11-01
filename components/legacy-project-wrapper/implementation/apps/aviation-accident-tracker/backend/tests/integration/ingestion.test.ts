/**
 * Integration test for the ingest pipeline: adapters -> normalize -> dedupe -> repo.
 *
 * Previously this exercised a parallel class-based ingest implementation that
 * the service never used, hit the live network, and was excluded from the test
 * run. It now drives the real pipeline (runRecentIngest) with mocked transports,
 * so it is deterministic and runs by default.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runRecentIngest } from '../../src/ingest/ingestService.js';
import { memoryRepo } from '../../src/repo/memoryRepo.js';
import { EventRepository } from '../../src/db/repository.js';
import { fetchRecentNtsb } from '../../src/ingest/adapters/ntsbAdapter.js';
import * as asnAdapter from '../../src/ingest/adapters/asnAdapter.js';

vi.mock('../../src/ingest/adapters/ntsbAdapter.js', () => ({
  fetchRecentNtsb: vi.fn().mockResolvedValue([]),
}));

const ASN_HOST = 'aviation-safety.net';

function asnPage(date: string, registration: string): string {
  return `<html><table><tr class="list">
    <td class="list"><a href=/database/record.php?id=${registration}>${date}</a></td>
    <td class="list">Cessna 172</td>
    <td class="list">${registration}</td>
    <td class="list">Private</td>
    <td class="list">0</td>
    <td class="list">United States</td>
  </tr></table></html>`;
}

function avHeraldFeed(link: string, title: string, pubDate: string): string {
  return `<?xml version="1.0"?><rss><channel>
    <item><title>${title}</title><link>${link}</link><pubDate>${pubDate}</pubDate></item>
  </channel></rss>`;
}

/** Route mocked fetch by URL so both adapters can run in one pass. */
function mockSources(asnHtml: string, avHeraldXml: string) {
  vi.mocked(fetch).mockImplementation(async (input: any) => {
    const url = String(input);
    if (url.includes(ASN_HOST)) {
      return new Response(asnHtml, { status: 200 });
    }
    return new Response(avHeraldXml, { status: 200 });
  });
}

describe('ingest pipeline', () => {
  const today = new Date().toISOString().slice(0, 10);
  const pubDate = new Date().toUTCString();

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizes and persists events from both sources', async () => {
    mockSources(
      asnPage(today, 'N12345'),
      avHeraldFeed('https://avherald.com/h?article=1', 'Incident: Example A320 at London, engine shutdown', pubDate)
    );

    const result = await runRecentIngest();

    expect(result.totalNormalized).toBeGreaterThan(0);
    expect(result.inserted + result.updated).toBeGreaterThan(0);
  });

  it('reports counts that account for every normalized event', async () => {
    mockSources(
      asnPage(today, 'N54321'),
      avHeraldFeed('https://avherald.com/h?article=2', 'Accident: Asia Air B789 at Tokyo, runway excursion', pubDate)
    );

    const result = await runRecentIngest();

    // Dedupe may collapse records, so persisted <= normalized.
    expect(result.inserted + result.updated).toBeLessThanOrEqual(result.totalNormalized);
  });

  it('makes ingested events retrievable from the repository', async () => {
    const registration = 'N99999';
    mockSources(
      asnPage(today, registration),
      avHeraldFeed('https://avherald.com/h?article=3', 'Incident: Example at Paris', pubDate)
    );

    await runRecentIngest();

    const { data } = memoryRepo.list({ limit: 200 });
    expect(data.some((e) => e.registration === registration)).toBe(true);
  });

  it('re-ingesting the same source data updates rather than duplicating', async () => {
    const registration = 'N77777';
    mockSources(
      asnPage(today, registration),
      avHeraldFeed('https://avherald.com/h?article=4', 'Incident: Example at Berlin', pubDate)
    );

    await runRecentIngest();
    const before = memoryRepo.list({ limit: 500 }).total;

    await runRecentIngest();
    const after = memoryRepo.list({ limit: 500 }).total;

    expect(after).toBe(before);
  });

  it('still completes when one source fails', async () => {
    vi.mocked(fetch).mockImplementation(async (input: any) => {
      if (String(input).includes(ASN_HOST)) {
        throw new Error('ASN unreachable');
      }
      return new Response(
        avHeraldFeed('https://avherald.com/h?article=5', 'Incident: Example at Madrid', pubDate),
        { status: 200 }
      );
    });

    const result = await runRecentIngest();
    expect(result.totalNormalized).toBeGreaterThan(0);
  });
});

describe('persistent ingest matching through the real pipeline', () => {
  const date = '2026-01-02T00:00:00Z';
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn().mockImplementation(async () =>
    new Response('<rss><channel></channel></rss>', { status: 200 }))); });
  afterEach(() => {
    vi.mocked(fetchRecentNtsb).mockResolvedValue([]);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([
    { name: 'exact identity', dateZ: date, registration: 'N123AB', fuzzy: false },
    { name: 'adjacent date', dateZ: '2026-01-03T23:00:00Z', registration: 'N123AB', fuzzy: true },
    { name: 'missing registration', dateZ: '2026-01-03T23:00:00Z', registration: 'UNKNOWN', fuzzy: true },
  ])('uses $name without duplicating the persisted event', async row => {
    const repo = new EventRepository(':memory:');
    try {
      await repo.initialize();
      const id = await repo.upsertEvent({ dateZ: date, registration: 'N123AB',
        aircraftType: 'Cessna 172', country: 'US', category: 'general', fatalities: 2 });
      vi.spyOn(repo, 'listEventsNeedingMediaSearch').mockResolvedValue([]);
      const fuzzy = vi.spyOn(repo, 'findFuzzyEvent');
      vi.mocked(fetchRecentNtsb).mockResolvedValue([{ source: 'ntsb', id: 'synthetic',
        dateZ: row.dateZ, registration: row.registration, country: 'US',
        aircraftType: 'Cessna 172', farPart: '91', summary: 'A later cited report',
        url: 'https://example.invalid/synthetic', fetchedAt: row.dateZ }]);
      expect(await runRecentIngest(repo)).toEqual({ inserted: 0, updated: 1, totalNormalized: 1 });
      expect((await repo.listEvents({})).total).toBe(1);
      const event = await repo.getEventWithSources(id);
      expect(event).toMatchObject({ dateZ: date, registration: 'N123AB', fatalities: 2,
        summary: 'A later cited report' });
      expect(event?.sources).toHaveLength(1);
      expect(event?.sources[0].sourceName).toBe('ntsb');
      expect(fuzzy.mock.calls.length > 0).toBe(row.fuzzy);
    } finally { await repo.close(); }
  });

  it('keeps ambiguous persisted candidates separate from a new source report', async () => {
    const repo = new EventRepository(':memory:');
    try {
      await repo.initialize();
      for (const registration of ['N1', 'N2']) await repo.upsertEvent({ dateZ: date,
        registration, country: 'US', aircraftType: 'Cessna 172', category: 'general' });
      vi.spyOn(repo, 'listEventsNeedingMediaSearch').mockResolvedValue([]);
      vi.mocked(fetchRecentNtsb).mockResolvedValue([{ source: 'ntsb', id: 'synthetic',
        dateZ: '2026-01-03T00:00:00Z', registration: 'UNKNOWN', country: 'US',
        aircraftType: 'Cessna 172', url: 'https://example.invalid/synthetic', fetchedAt: date }]);
      expect(await runRecentIngest(repo)).toMatchObject({ inserted: 1, updated: 0 });
      expect((await repo.listEvents({})).total).toBe(3);
    } finally { await repo.close(); }
  });

  it.each([true, false])('keeps separate source reports distinct even with matching context=%s', async sameContext => {
    const repo = new EventRepository(':memory:');
    try {
      await repo.initialize();
      vi.spyOn(repo, 'listEventsNeedingMediaSearch').mockResolvedValue([]);
      const report = { source: 'ntsb' as const, dateZ: date, registration: 'UNKNOWN',
        fetchedAt: date, country: 'US', aircraftType: 'Cessna 172' };
      vi.mocked(fetchRecentNtsb).mockResolvedValue([
        { ...report, id: 'one', url: 'https://example.invalid/shared-archive' },
        { ...report, id: 'two', country: sameContext ? 'US' : 'Canada',
          aircraftType: sameContext ? 'Cessna 172' : 'Boeing 737', url: 'https://example.invalid/shared-archive' },
      ]);
      expect(await runRecentIngest(repo)).toEqual({ inserted: 2, updated: 0, totalNormalized: 2 });
      expect((await repo.listEvents({})).total).toBe(2);
      // Re-import now uses context and provenance, not the UNKNOWN placeholder.
      expect(await runRecentIngest(repo)).toEqual({ inserted: 0, updated: 2, totalNormalized: 2 });
      const events = (await repo.listEvents({})).events;
      expect(events).toHaveLength(2);
      expect(events.map(event => event.sources.length)).toEqual([1, 1]);
    } finally { await repo.close(); }
  });

  it('reconciles missing-registration reports across different providers and re-imports idempotently', async () => {
    const repo = new EventRepository(':memory:');
    try {
      await repo.initialize();
      vi.spyOn(repo, 'listEventsNeedingMediaSearch').mockResolvedValue([]);
      const today = new Date().toISOString().slice(0, 10);
      vi.spyOn(asnAdapter, 'fetchRecentAsn').mockResolvedValue([{ source: 'asn', id: 'synthetic-asn',
        dateZ: `${today}T00:00:00Z`, registration: 'UNKNOWN', country: 'United States',
        aircraftType: 'Cessna 172', url: 'https://example.invalid/asn', fetchedAt: `${today}T00:00:00Z` }]);
      vi.mocked(fetchRecentNtsb).mockResolvedValue([{ source: 'ntsb', id: 'synthetic',
        dateZ: `${today}T00:00:00Z`, registration: 'UNKNOWN', country: 'United States',
        aircraftType: 'Cessna 172', url: 'https://example.invalid/ntsb', fetchedAt: `${today}T00:00:00Z` }]);
      expect(await runRecentIngest(repo)).toEqual({ inserted: 1, updated: 1, totalNormalized: 2 });
      expect(await runRecentIngest(repo)).toEqual({ inserted: 0, updated: 2, totalNormalized: 2 });
      const events = (await repo.listEvents({})).events;
      expect(events).toHaveLength(1);
      expect(events[0].sources.map(source => source.sourceName).sort()).toEqual(['asn', 'ntsb']);
    } finally { await repo.close(); }
  });

  it('learns a missing registration by record identity and preserves conflicting aircraft identities', async () => {
    const repo = new EventRepository(':memory:');
    try {
      await repo.initialize();
      vi.spyOn(repo, 'listEventsNeedingMediaSearch').mockResolvedValue([]);
      const id = await repo.upsertEvent({ dateZ: date, registration: 'UNKNOWN', country: 'US' });
      await repo.addSource(id, { sourceName: 'ntsb', recordId: 'case-one', url: 'https://example.invalid/old-archive', fetchedAt: date });
      const raw = { source: 'ntsb' as const, id: 'case-one', dateZ: '2026-01-03T00:00:00Z',
        registration: 'N123', country: 'US', url: 'https://example.invalid/new-archive', fetchedAt: date };
      vi.mocked(fetchRecentNtsb).mockResolvedValue([raw]);
      expect(await runRecentIngest(repo)).toMatchObject({ inserted: 0, updated: 1 });
      expect(await repo.findEventId(date, 'N123')).toBe(id);
      expect((await repo.getEventWithSources(id))?.sources).toHaveLength(2);
      // Even a shared archive/case identity cannot silently replace a known aircraft.
      vi.mocked(fetchRecentNtsb).mockResolvedValue([{ ...raw, registration: 'N999' }]);
      expect(await runRecentIngest(repo)).toMatchObject({ inserted: 1, updated: 0 });
      vi.mocked(fetchRecentNtsb).mockResolvedValue([raw]);
      expect(await runRecentIngest(repo)).toMatchObject({ inserted: 0, updated: 1 });
      expect((await repo.listEvents({})).total).toBe(2);
    } finally { await repo.close(); }
  });
});
