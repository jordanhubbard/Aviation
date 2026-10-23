import { describe, expect, it } from 'vitest';
import { AviationWeatherClient } from '../weather.js';

describe('AviationWeatherClient', () => {
  it('returns METAR using injected fetch', async () => {
    const mockFetch = async () => ({ ok: true, text: async () => 'KSFO 010056Z ...' }) as any;
    const client = new AviationWeatherClient({ fetchFn: mockFetch });
    const res = await client.getMetar('KSFO');
    expect(res.raw).toContain('KSFO');
    expect(res.station).toBe('KSFO');
  });

  it('throws on HTTP error', async () => {
    const mockFetch = async () => ({ ok: false, status: 500 }) as any;
    const client = new AviationWeatherClient({ fetchFn: mockFetch });
    await expect(client.getMetar('KSFO')).rejects.toThrow(/METAR fetch failed/);
  });
});
