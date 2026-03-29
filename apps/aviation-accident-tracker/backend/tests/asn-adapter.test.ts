/**
 * Unit tests for ASNAdapter
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ASNAdapter } from '../src/ingest/asn-adapter';

// Minimal HTML page that looks like ASN's datatable
const MOCK_ASN_HTML = `
<html><body>
<table class="datatable">
  <tr><th>Date</th><th>Type</th><th>Registration</th><th>Operator</th><th>Fat.</th><th>Location</th></tr>
  <tr>
    <td><a href="/database/record.php?id=20240315-1">2024-03-15</a></td>
    <td>Cessna 172</td>
    <td>N12345</td>
    <td>Private</td>
    <td>0</td>
    <td>United States</td>
  </tr>
  <tr>
    <td><a href="/database/record.php?id=20240310-2">2024-03-10</a></td>
    <td>Boeing 737-800</td>
    <td>G-XYZW</td>
    <td>British Airways</td>
    <td>2</td>
    <td>United Kingdom</td>
  </tr>
</table>
</body></html>
`;

describe('ASNAdapter', () => {
  let adapter: ASNAdapter;

  beforeEach(() => {
    adapter = new ASNAdapter();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('fetchRecent', () => {
    it('returns [] and logs warning when fetch returns 403', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response('Forbidden', { status: 403 })
      );
      const result = await adapter.fetchRecent(30);
      expect(result).toEqual([]);
    });

    it('returns [] and logs warning when fetch returns 429', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response('Too Many Requests', { status: 429 })
      );
      const result = await adapter.fetchRecent(30);
      expect(result).toEqual([]);
    });

    it('returns [] when fetch throws a network error', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network failure'));
      const result = await adapter.fetchRecent(30);
      expect(result).toEqual([]);
    });

    it('returns [] when HTML contains no parseable datatable', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response('<html><body>No table here</body></html>', { status: 200 })
      );
      const result = await adapter.fetchRecent(30);
      expect(result).toEqual([]);
    });

    it('parses EventRecords from valid HTML and filters by window', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(MOCK_ASN_HTML, { status: 200 })
      );
      // windowDays=365*10 ensures both rows pass the cutoff filter
      const result = await adapter.fetchRecent(3650);
      expect(result.length).toBe(2);
      expect(result[0].registration).toBe('N12345');
      expect(result[0].aircraftType).toBe('Cessna 172');
      expect(result[0].dateZ).toBe('2024-03-15');
      expect(result[0].sourceName ?? result[0].sources[0].sourceName).toBe('asn');
    });

    it('excludes events outside the retention window (pre-2000)', async () => {
      const oldHtml = MOCK_ASN_HTML.replace('2024-03-15', '1999-06-01').replace('2024-03-10', '1998-01-01');
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(oldHtml, { status: 200 })
      );
      const result = await adapter.fetchRecent(3650);
      expect(result).toEqual([]);
    });

    it('excludes events outside the windowDays cutoff', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(MOCK_ASN_HTML, { status: 200 })
      );
      // windowDays=1 — both 2024 dates are well outside a 1-day window
      const result = await adapter.fetchRecent(1);
      expect(result).toEqual([]);
    });
  });
});
