import { beforeEach, vi, type Mock } from 'vitest'

// Install a global fetch mock (service.ts calls global fetch for OpenSky)
global.fetch = vi.fn();

beforeEach(() => {
  (global.fetch as Mock).mockClear();
  // Default: OpenSky returns an empty state list — tests that need specific
  // data install their own mockResolvedValueOnce.
  (global.fetch as Mock).mockResolvedValue({
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: () => Promise.resolve({ states: [] }),
    text: () => Promise.resolve('{"states":[]}'),
  });
});
