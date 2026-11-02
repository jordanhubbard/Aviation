import express from 'express';
import { createServer } from 'node:http';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExplainerClient, type BrainRequest } from '../src/ExplainerClient.js';
import { explainerRoute } from '../src/explainerRoute.js';

const TOKEN = 'synthetic-provider-credential-do-not-echo';
const clients: ExplainerClient[] = [];
afterEach(() => { for (const sdk of clients.splice(0)) sdk.close(); });
function fixture(configured = true) {
  const bodies: BrainRequest[] = [];
  const fetch = vi.fn().mockImplementation((_url, init) => {
    bodies.push(JSON.parse(init.body));
    return Promise.resolve(new Response(JSON.stringify({ ok: true, status: 'queued', requestId: 'rcc-1' }), { status: 202 }));
  });
  const sdk = new ExplainerClient(configured ? { appId: 'flight-planner', brainUrl: 'http://127.0.0.1/rcc',
    publicBaseUrl: 'http://127.0.0.1/app', apiToken: TOKEN, fetch } : { fetch });
  clients.push(sdk);
  const app = express(); app.use(explainerRoute(sdk));
  return { sdk, app, fetch, bodies };
}
function result(body: BrainRequest) {
  return { requestId: 'rcc-1', result: 'The supplied wind explains the correction.',
    completedAt: '2026-11-02T00:00:00.000Z', metadata: body.metadata };
}

describe('common queued explanation HTTP adapter', () => {
  it('submits, polls, completes and deletes using a separate result credential', async () => {
    const { sdk, app, bodies } = fixture();
    expect((await request(app).get('/api/explain/config')).body).toEqual({ available: true });
    const submitted = await request(app).post('/api/explain').send({ context: 'Wind 270/12', question: 'Why this heading?' }).expect(202);
    const ticket = submitted.body;
    expect(ticket).toMatchObject({ status: 'queued', pollAfterMs: 500 });
    expect(submitted.text).not.toContain(TOKEN);
    expect(submitted.text).not.toContain(bodies[0].metadata.aviation_callback_nonce);
    const path = '/api/explain/requests/' + ticket.requestId;
    await request(app).get(path).expect(404);
    await request(app).get(path).set('X-Aviation-Explain-Token', 'f'.repeat(64)).expect(404);
    expect((await request(app).get(path).set('X-Aviation-Explain-Token', ticket.accessToken)).body.status).toBe('queued');
    await request(app).post('/api/explain/callback').send(result(bodies[0])).expect(200);
    const completed = await request(app).get(path).set('X-Aviation-Explain-Token', ticket.accessToken).expect(200);
    expect(completed.body).toMatchObject({ status: 'completed', explanation: result(bodies[0]).result });
    expect(completed.text).not.toContain(ticket.accessToken);
    await request(app).delete(path).set('X-Aviation-Explain-Token', ticket.accessToken).expect(200, { deleted: true });
    expect(sdk.activeRequests).toBe(0);
    await request(app).get(path).set('X-Aviation-Explain-Token', ticket.accessToken).expect(404);
    await request(app).post('/api/explain/callback').send(result(bodies[0])).expect(404);
  });
  it('accepts an early callback through a separate HTTP request without blocking it', async () => {
    const { app, fetch, sdk } = fixture();
    fetch.mockImplementationOnce(async (_url, init) => {
      const body = JSON.parse(init.body);
      const callback = await request(app).post('/api/explain/callback').send(result(body)).expect(200);
      expect(callback.body.status).toBe('buffered');
      return new Response(JSON.stringify({ ok: true, status: 'queued', requestId: 'rcc-1' }), { status: 202 });
    });
    const { body: ticket } = await request(app).post('/api/explain').send({ context: 'facts' }).expect(202);
    expect(sdk.getRequest(ticket.requestId, ticket.accessToken).status).toBe('completed');
  });
  it('validates follow-up roles and never sends a request for invalid input', async () => {
    const { app, fetch, bodies } = fixture();
    for (const body of [null, [], {}, { context: ' ' }, { context: 'facts', history: [{ role: 'system', content: TOKEN }] }]) {
      const response = await request(app).post('/api/explain').send(body).expect(400);
      expect(response.text).not.toContain(TOKEN);
    }
    expect(fetch).not.toHaveBeenCalled();
    await request(app).post('/api/explain').send({ context: 'facts', question: 'What about BRAVO?',
      history: [{ role: 'user', content: 'Why ALPHA?' }, { role: 'assistant', content: 'Supplied restriction facts.' }] }).expect(202);
    expect(bodies[0].messages.slice(1)).toEqual([{ role: 'user', content: 'facts' }, { role: 'user', content: 'Why ALPHA?' },
      { role: 'assistant', content: 'Supplied restriction facts.' }, { role: 'user', content: 'What about BRAVO?' }]);
  });
  it('reports unconfigured state without contacting any provider', async () => {
    const { app, fetch } = fixture(false);
    await request(app).get('/api/explain/config').expect(200, { available: false });
    await request(app).post('/api/explain').send({ context: 'facts' }).expect(503);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('hides provider errors and clears reserved state', async () => {
    const { app, fetch, sdk } = fixture();
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({ error: TOKEN }), { status: 401 }));
    const response = await request(app).post('/api/explain').send({ context: 'facts' }).expect(502);
    expect(response.body).toEqual({ error: 'The AI provider could not accept this request.' });
    expect(response.text).not.toContain(TOKEN); expect(sdk.activeRequests).toBe(0);
  });
  it('rejects malformed and oversized bodies without reflecting their contents', async () => {
    const { app, fetch } = fixture();
    const malformed = await request(app).post('/api/explain').set('Content-Type', 'application/json').send('{"context":"' + TOKEN).expect(400);
    expect(malformed.text).not.toContain(TOKEN);
    await request(app).post('/api/explain').send({ context: 'x'.repeat(262_145) }).expect(413);
    await request(app).post('/api/explain/callback').send({ result: 'x'.repeat(524_289) }).expect(413);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('rejects foreign callbacks and replay without changing the accepted result', async () => {
    const { app, bodies } = fixture();
    const { body: ticket } = await request(app).post('/api/explain').send({ context: 'facts' }).expect(202);
    const callback = result(bodies[0]);
    await request(app).post('/api/explain/callback').send({ ...callback, requestId: 'foreign' }).expect(404);
    await request(app).post('/api/explain/callback').send(callback).expect(200);
    await request(app).post('/api/explain/callback').send({ ...callback, result: 'Replacement' }).expect(409);
    const response = await request(app).get('/api/explain/requests/' + ticket.requestId).set('X-Aviation-Explain-Token', ticket.accessToken).expect(200);
    expect(response.body.explanation).toBe(callback.result);
  });
  it('releases an in-flight reservation when the HTTP caller disconnects', async () => {
    const { app, fetch: providerFetch, sdk } = fixture();
    let started!: () => void;
    const providerStarted = new Promise<void>(resolve => { started = resolve; });
    let aborted = false;
    providerFetch.mockImplementationOnce((_url, init) => {
      init.signal.addEventListener('abort', () => { aborted = true; });
      started();
      return new Promise(() => undefined);
    });
    const server = createServer(app);
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const controller = new AbortController();
    try {
      const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/explain`;
      const pending = globalThis.fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: 'facts' }), signal: controller.signal }).catch(() => undefined);
      await providerStarted;
      expect(sdk.activeRequests).toBe(1);
      controller.abort(); await pending;
      await vi.waitFor(() => { expect(aborted).toBe(true); expect(sdk.activeRequests).toBe(0); }, { interval: 5 });
    } finally {
      controller.abort(); server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });
});
