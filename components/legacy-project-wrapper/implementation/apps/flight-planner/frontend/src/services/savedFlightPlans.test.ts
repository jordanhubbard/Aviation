import { describe, expect, it, vi } from 'vitest';
import { loadSavedFlightPlans } from './savedFlightPlans';

describe('saved flight plans', () => {
  it('uses the deployed route and returns plan summaries', async () => {
    const request = vi.fn().mockResolvedValue({ ok: true, json: async () => [{ id: 'one', name: 'Trip' }] });
    expect(await loadSavedFlightPlans(request)).toEqual([{ id: 'one', name: 'Trip' }]);
    expect(request).toHaveBeenCalledWith('/flight-plans/');
  });

  it('rejects an error response instead of passing it to the table', async () => {
    const request = vi.fn().mockResolvedValue({ ok: false, status: 404, json: async () => ({ detail: 'Not Found' }) });
    await expect(loadSavedFlightPlans(request)).rejects.toThrow('HTTP 404');
  });
});
