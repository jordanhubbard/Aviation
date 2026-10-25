import { assertTestDataForRun, type E2ERun } from './index.js';

export interface FixtureApi {
  readonly appId: string;
  readonly baseUrl: string;
  readonly fetch: typeof fetch;
}

function fixtureUrl(api: FixtureApi, path: string): string {
  const base = new URL(api.baseUrl);
  if (base.protocol !== 'https:' && base.hostname !== '127.0.0.1' && base.hostname !== 'localhost') {
    throw new Error('Remote E2E fixture API requires HTTPS');
  }
  return new URL(path, base).toString();
}

/**
 * App adapters implement these endpoints against isolated, tagged test storage.
 * Register cleanup before seed so partial server writes are still removed.
 */
export async function seedRemoteFixture(run: E2ERun, api: FixtureApi,
  fixtureType: string, record: object): Promise<unknown> {
  assertTestDataForRun(record, run.id);
  if (!/^[a-z0-9-]+$/.test(fixtureType)) throw new Error('Invalid fixture type');
  const headers = { ...run.headersFor(api.appId), 'content-type': 'application/json' };
  const runUrl = fixtureUrl(api, `/__e2e/runs/${run.id}`);
  run.onCleanup(async () => {
    const deleted = await api.fetch(runUrl, { method: 'DELETE', headers: run.headersFor(api.appId) });
    if (!deleted.ok) throw new Error(`E2E cleanup failed for ${api.appId}: HTTP ${deleted.status}`);
    const residual = await api.fetch(runUrl, { method: 'GET', headers: run.headersFor(api.appId) });
    if (!residual.ok) throw new Error(`E2E residual check failed for ${api.appId}: HTTP ${residual.status}`);
    const state = await residual.json() as { count?: number };
    if (state.count !== 0) throw new Error(`E2E data remains in ${api.appId}: ${state.count}`);
  });
  const response = await api.fetch(fixtureUrl(api, '/__e2e/fixtures'), {
    method: 'POST', headers, body: JSON.stringify({ fixture_type: fixtureType, record }),
  });
  if (!response.ok) throw new Error(`E2E seed failed for ${api.appId}: HTTP ${response.status}`);
  return response.json();
}
