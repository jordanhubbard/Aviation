import express from 'express';
import { createServer } from 'node:http';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { E2E_MAX_AGE_MS, assertTestDataForRun, parseE2ERunId, signE2EHeaders, tagTestData,
  seedE2EExplanation, withE2ERun } from '@aviation/shared-sdk/e2e';
import { startExplanationServer } from '../src/server.js';
import { ExplainerClient, type BrainRequest } from '../src/ExplainerClient.js';
import { createExplanationRuntime, type ExplanationRuntime } from '../src/runtime.js';

const APP = 'flight-planner'; const RUN = parseE2ERunId('e2e_' + 'a'.repeat(32));
const OTHER = parseE2ERunId('e2e_' + 'b'.repeat(32)); const SECRET = 'synthetic-e2e-secret-32-characters-long';
const TOKEN = 'synthetic-provider-token-never-read-in-e2e';
const instances: ExplanationRuntime[] = [];
afterEach(() => { for (const instance of instances.splice(0)) instance.close(); vi.restoreAllMocks(); });
const headers = () => signE2EHeaders(APP, RUN, SECRET);
const seed = () => ({ fixture_type: 'explanation', record: tagTestData(RUN, { app_id: APP }) });
function privateRuntime() {
  const configuration = vi.fn(() => ({ brainUrl: 'https://production.invalid/rcc', apiToken: TOKEN, publicBaseUrl: 'https://production.invalid' }));
  const fetch = vi.fn();
  const runtime = createExplanationRuntime(APP, { environment: { AVIATION_E2E_RUN_ID: RUN, AVIATION_E2E_SECRET: SECRET,
    RCC_API_TOKEN: TOKEN, RCC_BRAIN_URL: 'https://production.invalid/rcc', KEYSTORE_PATH: '/must-not-read-production', KEYSTORE_ENCRYPTION_KEY: TOKEN }, configuration, fetch });
  instances.push(runtime); const app = express(); app.use(runtime.middleware);
  return { runtime, app, configuration, fetch };
}
describe('normal and SDK-isolated explanation runtimes', () => {
  it('embeds the same guarded API in a plain Node HTTP service without consuming app routes', async () => {
    const { runtime } = privateRuntime();
    const server = createServer((request, response) => {
      if (runtime.handle(request, response)) return;
      response.end('Application route');
    });
    await new Promise<void>(ready => server.listen(0, '127.0.0.1', ready));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not bind');
    const base = `http://127.0.0.1:${address.port}`;
    try {
      expect(await (await fetch(base + '/api/explain-other')).text()).toBe('Application route');
      expect((await fetch(base + '/api/explain/config')).status).toBe(403);
      const config = await fetch(base + '/api/explain/config', { headers: headers() });
      expect(config.headers.get('X-Aviation-Application')).toBe(APP);
      expect(config.headers.has('X-Powered-By')).toBe(false);
      expect(await config.json()).toEqual({ available: true });
      expect((await fetch(base + '/api/explain/unknown', { headers: headers() })).status).toBe(404);
      const widget = await fetch(base + '/api/explain/widget.js');
      expect(widget.status).toBe(200);
      expect(widget.headers.get('Content-Type')).toContain('javascript');
    } finally {
      runtime.close();
      await new Promise<void>(done => { server.close(() => done()); server.closeAllConnections(); });
    }
  });
  it('the shared E2E fixture helper removes the actor ledger after browser failure', async () => {
    const { runtime } = privateRuntime();
    const server = await startExplanationServer(runtime.client, { middleware: runtime.middleware });
    try {
      await expect(withE2ERun(SECRET, async run => {
        await seedE2EExplanation(run, { appId: APP, baseUrl: server.url, fetch });
        await runtime.client.submit({ context: 'Synthetic decision before browser failure' });
        throw new Error('Injected browser failure');
      }, RUN)).rejects.toThrow('E2E run or cleanup failed');
      const residual = await fetch(server.url + '/api/explain/__e2e/runs/' + RUN, { headers: headers() });
      const state = await residual.json();
      assertTestDataForRun(state, RUN);
      expect(state).toMatchObject({ count: 0, records: 0, run_records: 0, fixture_requests: 0, entries: [] });
    } finally { await server.close(); }
  });
  it('requires signed app/run credentials and a fixture ledger before private submission', async () => {
    const { runtime, app, configuration, fetch } = privateRuntime();
    await request(app).get('/api/explain/config').expect(403);
    await request(app).get('/api/explain/config').set({ 'x-aviation-test-run': RUN }).expect(403);
    await request(app).get('/api/explain/config').set(signE2EHeaders('weather-briefing', RUN, SECRET)).expect(403);
    await request(app).get('/api/explain/config').set(signE2EHeaders(APP, OTHER, SECRET)).expect(403);
    await request(app).get('/api/explain/widget.js').expect(200);
    await request(app).post('/api/explain').set(headers()).send({ context: 'facts' }).expect(409);
    await expect(runtime.client.submit({ context: 'facts' })).rejects.toMatchObject({ status: 409 });
    expect(configuration).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });
  it('runs SDK-only explanations and follow-ups, then clears every tagged owned record', async () => {
    const { app, runtime, configuration, fetch } = privateRuntime();
    const initial = await request(app).post('/api/explain/__e2e/fixtures').set(headers()).send(seed()).expect(200);
    expect(initial.body).toMatchObject({ count: 1, run_records: 1, records: 0 });
    assertTestDataForRun(initial.body, RUN); for (const entry of initial.body.entries) assertTestDataForRun(entry, RUN);
    const first = await request(app).post('/api/explain').set(headers()).send({ context: 'Wind facts', question: 'Why ALPHA?' }).expect(202);
    const read = await request(app).get('/api/explain/requests/' + first.body.requestId).set(headers())
      .set('X-Aviation-Explain-Token', first.body.accessToken).expect(200);
    expect(read.body.explanation).toContain('SDK fixture explanation.');
    expect(read.body.explanation).toContain('Follow-up history: 0 messages.');
    const second = await request(app).post('/api/explain').set(headers()).send({ context: 'Wind facts', question: 'And BRAVO?',
      history: [{ role: 'user', content: 'Why ALPHA?' }, { role: 'assistant', content: read.body.explanation }] }).expect(202);
    const followup = await request(app).get('/api/explain/requests/' + second.body.requestId).set(headers())
      .set('X-Aviation-Explain-Token', second.body.accessToken).expect(200);
    expect(followup.body.explanation).toContain('Follow-up history: 2 messages.');
    const state = await request(app).get('/api/explain/__e2e/status').set(headers()).expect(200);
    expect(state.body).toMatchObject({ count: 3, run_records: 1, records: 2, fixture_requests: 2 });
    for (const entry of state.body.entries) assertTestDataForRun(entry, RUN);
    expect(state.text).not.toContain(TOKEN); expect(state.text).not.toContain(first.body.accessToken);
    await request(app).delete('/api/explain/__e2e/runs/' + OTHER).set(headers()).expect(403);
    expect(runtime.client.activeRequests).toBe(2);
    const cleaned = await request(app).delete('/api/explain/__e2e/runs/' + RUN).set(headers()).expect(200);
    expect(cleaned.body).toMatchObject({ count: 0, run_records: 0, records: 0, entries: [], fixture_requests: 0 });
    expect(runtime.client.activeRequests).toBe(0);
    await request(app).get('/api/explain/requests/' + first.body.requestId).set(headers()).set('X-Aviation-Explain-Token', first.body.accessToken).expect(404);
    expect(configuration).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
  });
  it('rejects foreign fixture tags and malformed bodies without creating state or reflecting values', async () => {
    const { app } = privateRuntime();
    await request(app).post('/api/explain/__e2e/fixtures').set(headers()).send({ fixture_type: 'explanation', record: tagTestData(OTHER, { app_id: APP }) }).expect(400);
    await request(app).post('/api/explain/__e2e/fixtures').set(headers()).send({ fixture_type: 'explanation', record: tagTestData(RUN, { app_id: 'weather-briefing' }) }).expect(400);
    const malformed = await request(app).post('/api/explain/__e2e/fixtures').set(headers()).set('Content-Type', 'application/json').send('{"private":"' + TOKEN).expect(400);
    expect(malformed.text).not.toContain(TOKEN);
    expect((await request(app).get('/api/explain/__e2e/status').set(headers())).body.count).toBe(0);
  });
  it('does not renew an expired fixture and still permits signed owned cleanup', async () => {
    const { app } = privateRuntime();
    await request(app).post('/api/explain/__e2e/fixtures').set(headers()).send(seed()).expect(200);
    const future = Date.now() + E2E_MAX_AGE_MS + 1; vi.spyOn(Date, 'now').mockReturnValue(future);
    await request(app).post('/api/explain').set(headers()).send({ context: 'facts' }).expect(409);
    await request(app).post('/api/explain/__e2e/fixtures').set(headers()).send(seed()).expect(409);
    expect((await request(app).delete('/api/explain/__e2e/runs/' + RUN).set(headers()).expect(200)).body.count).toBe(0);
  });
  it('requires private callback tags even for a known nonce', async () => {
    const received = vi.spyOn(ExplainerClient.prototype, 'receiveCallback');
    const { app } = privateRuntime();
    await request(app).post('/api/explain/__e2e/fixtures').set(headers()).send(seed()).expect(200);
    await request(app).post('/api/explain').set(headers()).send({ context: 'facts' }).expect(202);
    const payload = structuredClone(received.mock.calls[0][0]) as { metadata: Record<string, unknown> };
    payload.metadata.test_run_id = OTHER;
    await request(app).post('/api/explain/callback').send(payload).expect(404);
  });
  it('normal mode rejects test requests, test-tagged callbacks and private lifecycle routes', async () => {
    let queuedBody!: BrainRequest;
    const runtime = createExplanationRuntime(APP, { environment: { NODE_ENV: 'production', AVIATION_E2E_SECRET: SECRET },
      configuration: () => ({ brainUrl: 'http://127.0.0.1/rcc', apiToken: TOKEN, publicBaseUrl: 'https://flight-planner.example' }),
      fetch: async (_url, init) => { queuedBody = JSON.parse(String(init?.body)); return new Response(JSON.stringify({ ok: true, status: 'queued', requestId: 'rcc-1' }), { status: 202 }); } });
    instances.push(runtime); const app = express(); app.use(runtime.middleware);
    await request(app).get('/api/explain/config').set(headers()).expect(403);
    await request(app).get('/api/explain/__e2e/status').expect(404);
    await request(app).post('/api/explain').send({ context: 'facts' }).expect(202);
    const value = { requestId: 'rcc-1', result: 'Supplied facts explain this decision.', completedAt: new Date().toISOString(), metadata: queuedBody.metadata };
    await request(app).post('/api/explain/callback').send({ ...value, metadata: { ...value.metadata, is_test_data: true, test_run_id: RUN } }).expect(404);
    await request(app).post('/api/explain/callback').send(value).expect(200);
  });
  it('fails closed on malformed private configuration before falling back to normal settings', () => {
    expect(() => createExplanationRuntime(APP, { environment: { AVIATION_E2E_RUN_ID: '', RCC_API_TOKEN: TOKEN } })).toThrow();
    expect(() => createExplanationRuntime(APP, { environment: { AVIATION_E2E_RUN_ID: RUN } })).toThrow('not configured');
    expect(() => createExplanationRuntime('../foreign')).toThrow('not configured');
  });
});
