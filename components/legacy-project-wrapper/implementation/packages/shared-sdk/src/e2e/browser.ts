import type { E2ERun } from './index.js';

export interface E2EBrowserRoute {
  request(): { headers(): Record<string, string>; url(): string };
  continue(options: { headers: Record<string, string> }): Promise<void>;
  fulfill?(options: { status: number; contentType: string; body: string }): Promise<void>;
}

export interface E2ENetworkMock {
  path: string;
  response: object;
  status?: number;
  textBody?: string;
}

/** Serve SDK mock responses for exact same-origin paths; no external request is made. */
export async function installE2ENetworkMocks(page: E2EBrowserPage, baseUrl: string,
  run: E2ERun, mocks: E2ENetworkMock[]): Promise<void> {
  const origin = new URL(baseUrl).origin;
  for (const mock of mocks) {
    if (!mock.path.startsWith('/') || mock.path.startsWith('//') || mock.path.includes('..')) {
      throw new Error('E2E mock path must be an absolute same-origin path');
    }
    if ((mock.response as { test_run_id?: string }).test_run_id !== run.id
      || (mock.response as { is_test_data?: boolean }).is_test_data !== true) {
      throw new Error('E2E mock response is not tagged for this run');
    }
    if (mock.textBody !== undefined && !mock.textBody.includes(run.id)) {
      throw new Error('E2E text mock must contain its run ID');
    }
    await page.route(`${origin}${mock.path}`, async route => {
      if (!route.fulfill) throw new Error('Browser route cannot fulfill E2E mock');
      await route.fulfill({ status: mock.status ?? 200,
        contentType: mock.textBody === undefined ? 'application/json' : 'text/plain; charset=utf-8',
        body: mock.textBody ?? JSON.stringify(mock.response) });
    });
  }
}

export interface E2EBrowserPage {
  route(url: string, handler: (route: E2EBrowserRoute) => Promise<void>): Promise<void>;
}

/** Add test credentials only to the app's own API requests, never to assets or third parties. */
export async function installE2EApiHeaders(page: E2EBrowserPage, baseUrl: string,
  appId: string, run: E2ERun): Promise<void> {
  const origin = new URL(baseUrl).origin;
  await page.route(`${origin}/api/**`, async route => {
    if (new URL(route.request().url()).origin !== origin) throw new Error('E2E route escaped app origin');
    await route.continue({ headers: { ...route.request().headers(), ...run.headersFor(appId) } });
  });
}

export interface E2EScreen {
  id: string;
  dataMode: 'tagged-database' | 'isolated-browser' | 'sdk-mock' | 'stateless';
  visit(): Promise<void>;
  verify(): Promise<void>;
}

/** A missing or duplicate screen fails the run before any interaction begins. */
export async function runE2EScreens(expectedIds: string[], screens: E2EScreen[]): Promise<void> {
  const expected = [...expectedIds].sort();
  const actual = screens.map(screen => screen.id).sort();
  if (new Set(expected).size !== expected.length || new Set(actual).size !== actual.length
    || JSON.stringify(expected) !== JSON.stringify(actual)) {
    throw new Error(`E2E screen inventory mismatch: expected ${expected}, actual ${actual}`);
  }
  for (const screen of screens) {
    await screen.visit();
    await screen.verify();
  }
}
