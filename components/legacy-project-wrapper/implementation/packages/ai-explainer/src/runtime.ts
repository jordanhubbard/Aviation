import express, { Router, json, type Request, type Response, type NextFunction, type ErrorRequestHandler } from 'express';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { E2E_MAX_AGE_MS, assertTestDataForRun, parseE2ERunId, tagTestData, verifyE2EHeaders } from '@aviation/shared-sdk/e2e';
import { ExplainerClient, ExplanationError, type BrainRequest, type ProviderConfiguration } from './ExplainerClient.js';
import { providerConfigurationReader, type ExplanationEnvironment } from './configuration.js';
import { explainerRoute, type ExplanationMiddleware } from './explainerRoute.js';
import { isRecord } from './protocol.js';

export type ExplanationRuntimeOptions = {
  environment?: ExplanationEnvironment;
  keystorePath?: string;
  configuration?: () => ProviderConfiguration | undefined;
  fetch?: typeof globalThis.fetch;
};
export type ExplanationRuntime = { client: ExplainerClient; middleware: ExplanationMiddleware;
  handle(request: IncomingMessage, response: ServerResponse): boolean; close(): void };

/** Shared normal/private policy. Applications contribute only their fixed identity and access policy. */
export function createExplanationRuntime(appId: string, options: ExplanationRuntimeOptions = {}): ExplanationRuntime {
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(appId)) throw new ExplanationError('configuration', 503);
  const environment = options.environment ?? process.env;
  const run = environment.AVIATION_E2E_RUN_ID === undefined ? undefined : parseE2ERunId(environment.AVIATION_E2E_RUN_ID);
  if (run && (!environment.AVIATION_E2E_SECRET || environment.AVIATION_E2E_SECRET.length < 32)) {
    throw new ExplanationError('configuration', 503);
  }
  let ledger: ReturnType<typeof tagTestData<{ entity: string; app_id: string; run_id: string; created_at_ms: number; expires_at_ms: number }>> | undefined;
  let fixtureRequests = 0;
  const requireFixture = () => {
    if (run && (!ledger || ledger.expires_at_ms <= Date.now())) throw new ExplanationError('fixture', 409);
  };
  let client: ExplainerClient;
  const fixtureFetch: typeof globalThis.fetch = async (_url, init) => {
    if (!run) throw new ExplanationError('unavailable', 503);
    const body = JSON.parse(String(init?.body)) as BrainRequest;
    if (!isRecord(body.metadata) || body.metadata.aviation_app_id !== appId || body.metadata.app_id !== appId) throw new ExplanationError('access', 403);
    assertTestDataForRun(body.metadata, run);
    const requestId = `rcc-fixture-${++fixtureRequests}`;
    const question = body.messages[body.messages.length - 1].content;
    const historyCount = Math.max(0, body.messages.length - 3);
    // SDK fixture only: no network, environment fallback or production credential lookup.
    client.receiveCallback({ requestId, result: `SDK fixture explanation. Question: ${question}\nFollow-up history: ${historyCount} messages.`,
      completedAt: new Date().toISOString(), model: 'sdk-fixture', metadata: body.metadata });
    return new globalThis.Response(JSON.stringify({ ok: true, status: 'queued', requestId }), { status: 202 });
  };
  client = new ExplainerClient({ appId, beforeSubmit: requireFixture,
    ...(run ? {
      brainUrl: 'http://rcc-fixture.invalid/api/brain/request', apiToken: `synthetic-rcc-${run}`,
      publicBaseUrl: 'http://127.0.0.1', metadata: tagTestData(run, { app_id: appId }), fetch: fixtureFetch,
    } : { configuration: options.configuration ?? providerConfigurationReader(environment, options.keystorePath), fetch: options.fetch }),
  });

  const authorize = (request: Request) => {
    const requestedApp = request.get('X-Aviation-Application');
    if (requestedApp !== undefined && requestedApp !== appId) throw new ExplanationError('access', 403);
    const path = request.path;
    if (path === '/widget.js' || path === '/api/explain/widget.js') return;
    const headers = Object.fromEntries(Object.entries(request.headers).map(([key, value]) => [key, typeof value === 'string' ? value : undefined]));
    let authenticated;
    try { authenticated = verifyE2EHeaders(appId, headers, environment.AVIATION_E2E_SECRET); }
    catch { throw new ExplanationError('access', 403); }
    const callback = path === '/callback' || path === '/api/explain/callback';
    if (callback && run && authenticated === null) return; // The provider's independent callback nonce authorizes this request.
    if (authenticated !== (run ?? null)) throw new ExplanationError('access', 403);
  };
  const validateCallback = (value: unknown) => {
    if (!isRecord(value) || !isRecord(value.metadata)) throw new ExplanationError('missing', 404);
    if (run) {
      if (value.metadata.app_id !== appId) throw new ExplanationError('missing', 404);
      try { assertTestDataForRun(value.metadata, run); }
      catch { throw new ExplanationError('missing', 404); }
    } else if ('is_test_data' in value.metadata || 'test_run_id' in value.metadata) {
      throw new ExplanationError('missing', 404);
    }
  };
  const router = Router();
  if (run) router.use('/api/explain', (_request, response, next) => { response.set('X-Aviation-Test-Run', run); next(); });
  router.use(explainerRoute(client, { authorize, validateCallback }));
  if (run) {
    const state = () => tagTestData(run, {
      app_id: appId, run_id: run, records: client.activeRequests, run_records: ledger ? 1 : 0,
      count: client.activeRequests + (ledger ? 1 : 0), fixture_requests: fixtureRequests,
      entries: [...(ledger ? [ledger] : []), ...client.listRequests().map(item => tagTestData(run, {
        entity: 'explanations', app_id: appId, ...item,
      }))],
    });
    const failed = (response: Response, error: unknown) => response.status(error instanceof ExplanationError ? error.status : 400)
      .json({ error: error instanceof ExplanationError ? error.message : 'Invalid explanation fixture.' });
    const selectedRun = (request: Request) => {
      if (request.params.runId && request.params.runId !== run) throw new ExplanationError('access', 403);
    };
    router.post('/api/explain/__e2e/fixtures', json({ limit: '64kb' }), (request, response) => {
      try {
        if (!isRecord(request.body) || request.body.fixture_type !== 'explanation' || !isRecord(request.body.record)) throw new Error();
        if (request.body.record.app_id !== appId) throw new Error();
        assertTestDataForRun(request.body.record, run);
        if (ledger) requireFixture();
        else {
          const now = Date.now();
          ledger = tagTestData(run, { entity: 'e2e_runs', app_id: appId, run_id: run, created_at_ms: now, expires_at_ms: now + E2E_MAX_AGE_MS });
        }
        response.json(state());
      } catch (error) { failed(response, error); }
    });
    for (const path of ['/api/explain/__e2e/status', '/api/explain/__e2e/runs/:runId']) {
      router.get(path, (request, response) => {
        try { selectedRun(request); response.json(state()); } catch (error) { failed(response, error); }
      });
    }
    router.delete('/api/explain/__e2e/runs/:runId', (request, response) => {
      try {
        selectedRun(request); client.clearRequests(); ledger = undefined; fixtureRequests = 0;
        response.json(state());
      } catch (error) { failed(response, error); }
    });
  }
  router.use('/api/explain', (_request, response) => response.status(404).json({ error: 'Explanation request was not found.' }));
  const invalidBody: ErrorRequestHandler = (error, _request, response, _next) => {
    response.status(error?.type === 'entity.too.large' ? 413 : 400).json({ error: 'Invalid explanation request.' });
  };
  router.use(invalidBody);
  const http = express();
  http.disable('x-powered-by');
  http.use(router);
  return { client, middleware: (request, response, next) => router(request as Request, response as Response, next as NextFunction),
    handle(request, response) {
      const path = (request.url ?? '').split('?', 1)[0];
      if (path !== '/api/explain' && !path.startsWith('/api/explain/')) return false;
      http(request, response);
      return true;
    },
    close() { client.close(); ledger = undefined; fixtureRequests = 0; } };
}
