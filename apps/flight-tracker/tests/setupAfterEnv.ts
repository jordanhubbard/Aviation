/**
 * Jest setup file run AFTER the test environment is loaded (setupFilesAfterEnv).
 * Jest globals (describe, it, beforeEach, afterEach, expect, jest) are available here.
 *
 * Installs a global fetch mock that every test can override per-call.
 * The mock is cleared before each test to prevent cross-test contamination.
 */

// Install a global fetch mock (service.ts calls global fetch for OpenSky)
global.fetch = jest.fn();

beforeEach(() => {
  (global.fetch as jest.Mock).mockClear();
  // Default: OpenSky returns an empty state list — tests that need specific
  // data install their own mockResolvedValueOnce.
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: () => Promise.resolve({ states: [] }),
    text: () => Promise.resolve('{"states":[]}'),
  });
});
