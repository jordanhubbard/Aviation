import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExplainerClient } from '../src/ExplainerClient.js';

describe('ExplainerClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('uses RCC_BRAIN_URL env var when no option provided', () => {
    process.env['RCC_BRAIN_URL'] = 'http://custom-host/api/brain/request';
    const client = new ExplainerClient();
    // Access private field via cast to verify
    expect((client as unknown as { brainUrl: string }).brainUrl).toBe(
      'http://custom-host/api/brain/request'
    );
    delete process.env['RCC_BRAIN_URL'];
  });

  it('constructor option overrides env var', () => {
    process.env['RCC_BRAIN_URL'] = 'http://env-host/api/brain/request';
    const client = new ExplainerClient({ brainUrl: 'http://override/api/brain/request' });
    expect((client as unknown as { brainUrl: string }).brainUrl).toBe(
      'http://override/api/brain/request'
    );
    delete process.env['RCC_BRAIN_URL'];
  });

  it('explain calls fetch with correct body and returns explanation', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ explanation: 'The autopilot corrected for crosswind.' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const client = new ExplainerClient({ brainUrl: 'http://test/api/brain/request' });
    const result = await client.explain('some context', 'why?');

    expect(result).toBe('The autopilot corrected for crosswind.');
    expect(mockFetch).toHaveBeenCalledWith('http://test/api/brain/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context: 'some context', question: 'why?' }),
    });
  });

  it('explain omits question field when not provided', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ explanation: 'Decision explanation.' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const client = new ExplainerClient({ brainUrl: 'http://test/api/brain/request' });
    await client.explain('context only');

    const call = mockFetch.mock.calls[0];
    const sentBody = JSON.parse(call[1].body as string);
    expect(sentBody).toEqual({ context: 'context only' });
    expect(sentBody.question).toBeUndefined();
  });

  it('throws when response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503, statusText: 'Service Unavailable' }));
    const client = new ExplainerClient({ brainUrl: 'http://test/api/brain/request' });
    await expect(client.explain('ctx')).rejects.toThrow('503 Service Unavailable');
  });

  it('throws when response is missing explanation field', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: 'wrong shape' }),
    }));
    const client = new ExplainerClient({ brainUrl: 'http://test/api/brain/request' });
    await expect(client.explain('ctx')).rejects.toThrow('missing explanation field');
  });
});
