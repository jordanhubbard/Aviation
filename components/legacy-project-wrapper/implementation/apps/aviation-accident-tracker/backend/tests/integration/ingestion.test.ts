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
