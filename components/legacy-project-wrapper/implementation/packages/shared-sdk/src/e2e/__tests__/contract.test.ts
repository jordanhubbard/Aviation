import { describe, expect, it } from 'vitest';
import { assertTestDataForRun, createE2ERunId, parseE2ERunId, seedRemoteFixture,
  signE2EHeaders, standardE2EFixtures, tagTestData, verifyE2EHeaders, withE2ERun,
  installE2EApiHeaders, installE2ENetworkMocks, standardE2EMocks, runE2EScreens } from '../index.js';

const secret = 'test-only-secret-with-at-least-32-characters';

describe('remote E2E isolation contract', () => {
  it('requires an explicit run tag and never accepts a production or foreign record', () => {
    const runId = createE2ERunId();
    const tagged = tagTestData(runId, { title: 'fixture' });
    expect(tagged).toMatchObject({ is_test_data: true, test_run_id: runId });
    expect(() => assertTestDataForRun(tagged, runId)).not.toThrow();
    expect(() => assertTestDataForRun({ title: 'production' }, runId)).toThrow();
    expect(() => assertTestDataForRun(tagged, createE2ERunId())).toThrow();
    expect(() => tagTestData(runId, tagged)).toThrow();
    expect(() => parseE2ERunId('production')).toThrow();
    expect(Object.values(standardE2EFixtures(runId)).every(record =>
      record.is_test_data && record.test_run_id === runId)).toBe(true);
  });

  it('binds short-lived credentials to the intended app and run', () => {
    const runId = createE2ERunId();
    const now = 1_800_000_000_000;
    const headers = signE2EHeaders('aviation-missions-app', runId, secret, now);
    expect(verifyE2EHeaders('aviation-missions-app', headers, secret, now)).toBe(runId);
    expect(() => verifyE2EHeaders('flightschool', headers, secret, now)).toThrow();
    expect(() => verifyE2EHeaders('aviation-missions-app', headers, secret, now + 900_001)).toThrow();
    expect(() => verifyE2EHeaders('aviation-missions-app', { 'x-aviation-test-run': runId }, secret, now)).toThrow();
    expect(verifyE2EHeaders('aviation-missions-app', {}, secret, now)).toBeNull();
  });

  it('deletes tagged database fixtures and verifies zero residual rows even after a test failure', async () => {
    const rows = new Map<string, object[]>();
    const requests: string[] = [];
    const mockFetch = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const path = new URL(String(url)).pathname;
      const method = init?.method ?? 'GET';
      requests.push(`${method} ${path}`);
      if (method === 'POST') {
        const body = JSON.parse(String(init?.body)) as { record: object };
        const runId = (body.record as { test_run_id: string }).test_run_id;
        rows.set(runId, [body.record]);
        return Response.json({ id: 1 }, { status: 201 });
      }
      const runId = path.split('/').at(-1)!;
      if (method === 'DELETE') rows.delete(runId);
      return Response.json({ count: rows.get(runId)?.length ?? 0 });
    };
    await expect(withE2ERun(secret, async run => {
      await seedRemoteFixture(run, { appId: 'aviation-missions-app',
        baseUrl: 'https://missions.example.test', fetch: mockFetch as typeof fetch },
      'mission', run.tag({ title: 'fixture' }));
      throw new Error('browser assertion failed');
    })).rejects.toThrow('E2E run or cleanup failed');
    expect(rows.size).toBe(0);
    expect(requests.map(request => request.split(' ')[0])).toEqual(['POST', 'DELETE', 'GET']);
  });

  it('rejects incomplete screen inventories and keeps credentials on the app API origin', async () => {
    await expect(runE2EScreens(['list', 'detail'], [{ id: 'list', dataMode: 'sdk-mock',
      visit: async () => {}, verify: async () => {} }])).rejects.toThrow('inventory mismatch');
    const handlers: Array<(route: any) => Promise<void>> = [];
    await withE2ERun(secret, async run => {
      await installE2EApiHeaders({ route: async (_url, handler) => { handlers.push(handler); } },
        'https://tracker.example.test/', 'aviation-accident-tracker', run);
      const supplied: Record<string, string>[] = [];
      await handlers[0]({ request: () => ({ url: () => 'https://tracker.example.test/api/events',
        headers: () => ({ accept: 'application/json' }) }),
      continue: async ({ headers }: { headers: Record<string, string> }) => { supplied.push(headers); } });
      expect(supplied[0]['x-aviation-test-run']).toBe(run.id);
      expect(supplied[0].accept).toBe('application/json');
      await expect(handlers[0]({ request: () => ({ url: () => 'https://other.example.test/api/events',
        headers: () => ({}) }), continue: async () => {} })).rejects.toThrow('escaped app origin');
    });
  });

  it('serves tagged standard mocks without contacting an external service', async () => {
    const routes: Array<{ url: string; handler: (route: any) => Promise<void> }> = [];
    await withE2ERun(secret, async run => {
      const weather = standardE2EMocks(run.id).weather;
      await installE2ENetworkMocks({ route: async (url, handler) => { routes.push({ url, handler }); } },
        'https://weather.example.test/', run, [{ path: '/api/weather/KOAK', response: weather }]);
      expect(routes[0].url).toBe('https://weather.example.test/api/weather/KOAK');
      let body = '';
      await routes[0].handler({ fulfill: async (options: { body: string }) => { body = options.body; } });
      expect(JSON.parse(body)).toMatchObject({ is_test_data: true, test_run_id: run.id, station: 'KOAK' });
      await expect(installE2ENetworkMocks({ route: async () => {} }, 'https://weather.example.test/', run,
        [{ path: '//other.example.test/steal', response: weather }])).rejects.toThrow('same-origin');
    });
  });
});
