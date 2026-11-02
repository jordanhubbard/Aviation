import { createServer, type Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExplainerClient, type BrainRequest, type ProviderConfiguration } from '../src/ExplainerClient.js';

const TOKEN = 'synthetic-rcc-token-never-sent-in-messages';
const clients: ExplainerClient[] = [];
const servers: Server[] = [];
afterEach(async () => {
  for (const sdk of clients.splice(0)) sdk.close();
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
  vi.restoreAllMocks(); vi.unstubAllEnvs();
});
async function listen(server: Server): Promise<string> {
  servers.push(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${(server.address() as { port: number }).port}`;
}
function client(options: ConstructorParameters<typeof ExplainerClient>[0] = {}): ExplainerClient {
  const sdk = new ExplainerClient({ appId: 'flight-planner', brainUrl: 'http://127.0.0.1/provider',
    publicBaseUrl: 'http://127.0.0.1/app', apiToken: TOKEN, ...options });
  clients.push(sdk); return sdk;
}
const queued = () => new Response(JSON.stringify({ ok: true, status: 'queued', requestId: 'rcc-1' }), { status: 202 });
function callback(body: BrainRequest, id = 'rcc-1') {
  return { requestId: id, result: 'The supplied wind explains this heading.',
    completedAt: '2026-11-02T00:00:00.000Z', model: 'provider-owned-fallback', metadata: body.metadata };
}
function capturingClient(options: ConstructorParameters<typeof ExplainerClient>[0] = {}) {
  const requests: BrainRequest[] = [];
  const fetch = vi.fn().mockImplementation((_url, init) => {
    requests.push(JSON.parse(init.body)); return Promise.resolve(queued());
  });
  const sdk = client({ fetch, ...options });
  return { sdk, fetch, requests };
}

describe('queued RCC explanation lifecycle', () => {
  for (const early of [false, true]) it(`uses real HTTP submission and ${early ? 'early' : 'normal'} callback completion`, async () => {
    let sdk!: ExplainerClient; let body!: BrainRequest; let callbackState = '';
    const app = await listen(createServer(async (request, response) => {
      let raw = ''; for await (const chunk of request) raw += chunk;
      expect(request.url).toBe('/api/explain/callback');
      callbackState = sdk.receiveCallback(JSON.parse(raw));
      response.writeHead(200).end('{}');
    }));
    const complete = async () => {
      const response = await fetch(body.callbackUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(callback(body)) });
      expect(response.status).toBe(200); await response.text();
    };
    const provider = await listen(createServer(async (request, response) => {
      let raw = ''; for await (const chunk of request) raw += chunk;
      body = JSON.parse(raw);
      expect(request.url).toBe('/api/brain/request');
      expect(request.headers.authorization).toBe(`Bearer ${TOKEN}`);
      expect(JSON.stringify(body)).not.toContain(TOKEN);
      expect(body).not.toHaveProperty('model');
      expect(body.callbackUrl).not.toContain(body.metadata.aviation_callback_nonce as string);
      if (early) await complete();
      response.writeHead(202, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ ok: true, status: 'queued', requestId: 'rcc-1' }));
    }));
    sdk = client({ brainUrl: provider + '/api/brain/request', publicBaseUrl: app });
    const ticket = await sdk.submit({ context: 'Wind 270/12; heading 090.', question: 'Why this correction?' });
    expect(body.messages.slice(1)).toEqual([{ role: 'user', content: 'Wind 270/12; heading 090.' }, { role: 'user', content: 'Why this correction?' }]);
    expect(body.maxTokens).toBe(768); expect(body.priority).toBe('normal');
    expect(ticket.accessToken).not.toBe(body.metadata.aviation_callback_nonce);
    if (!early) {
      expect(sdk.getRequest(ticket.requestId, ticket.accessToken).status).toBe('queued');
      await complete();
    }
    expect(callbackState).toBe(early ? 'buffered' : 'completed');
    const state = sdk.getRequest(ticket.requestId, ticket.accessToken);
    expect(state).toMatchObject({ status: 'completed', explanation: callback(body).result });
    expect(JSON.stringify(state)).not.toContain(ticket.accessToken);
    expect(JSON.stringify(state)).not.toContain(body.metadata.aviation_callback_nonce as string);
    sdk.deleteRequest(ticket.requestId, ticket.accessToken);
    expect(sdk.activeRequests).toBe(0);
    expect(() => sdk.receiveCallback(callback(body))).toThrow('not found');
  });
  it('preserves ordered follow-up history and only one system instruction', async () => {
    const { sdk, requests } = capturingClient();
    const history = [{ role: 'user', content: 'Why ALPHA?' }, { role: 'assistant', content: 'The restrictions exclude BRAVO.' }];
    await sdk.submit({ context: 'Route facts', question: 'What about crosswind?', history });
    expect(requests[0].messages.slice(1)).toEqual([{ role: 'user', content: 'Route facts' }, ...history, { role: 'user', content: 'What about crosswind?' }]);
  });
  it('does not implicitly read production environment or guessed URLs', async () => {
    vi.stubEnv('RCC_BRAIN_URL', 'http://production.invalid/api/brain/request'); vi.stubEnv('RCC_API_TOKEN', TOKEN);
    const fetch = vi.fn(); const sdk = new ExplainerClient({ fetch }); clients.push(sdk);
    expect(sdk.isConfigured()).toBe(false);
    await expect(sdk.submit({ context: 'facts' })).rejects.toMatchObject({ status: 503 });
    expect(fetch).not.toHaveBeenCalled(); expect(sdk.activeRequests).toBe(0);
  });
  it('rejects invalid input before a provider request', async () => {
    const { sdk, fetch } = capturingClient();
    await expect(sdk.submit({ context: ' ' })).rejects.toMatchObject({ status: 400 });
    expect(fetch).not.toHaveBeenCalled(); expect(sdk.activeRequests).toBe(0);
  });
  for (const [status, body] of [[200, { explanation: TOKEN }], [202, { ok: false, status: 'queued', requestId: 'rcc-1' }], [401, { error: TOKEN }]] as const) {
    it(`rejects an invalid queue response ${status} without leaking it`, async () => {
      const sdk = client({ fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })) });
      await expect(sdk.submit({ context: 'facts' })).rejects.toMatchObject({ status: 502, message: 'The AI provider could not accept this request.' });
      expect(sdk.activeRequests).toBe(0);
    });
  }
  it('bounds provider response memory and hides transport exceptions', async () => {
    const sdk = client({ fetch: vi.fn().mockResolvedValue(new Response('x'.repeat(65_537), { status: 202 })) });
    await expect(sdk.submit({ context: 'facts' })).rejects.toMatchObject({ status: 502 }); expect(sdk.activeRequests).toBe(0);
    const broken = client({ fetch: vi.fn().mockRejectedValue(new Error(TOKEN)) });
    await expect(broken.submit({ context: 'facts' })).rejects.toMatchObject({ status: 502, message: 'The AI provider could not accept this request.' });
    expect(broken.activeRequests).toBe(0);
  });
  it('bounds reservations and protects reads and deletion with independent credentials', async () => {
    const { sdk, fetch } = capturingClient({ maxPending: 1 });
    const ticket = await sdk.submit({ context: 'facts' });
    for (const wrong of [undefined, 'b'.repeat(64), '✈'.repeat(64)]) {
      expect(() => sdk.getRequest(ticket.requestId, wrong)).toThrow('not found');
      expect(() => sdk.deleteRequest(ticket.requestId, wrong)).toThrow('not found');
    }
    await expect(sdk.submit({ context: 'more facts' })).rejects.toMatchObject({ status: 429 }); expect(fetch).toHaveBeenCalledTimes(1);
    sdk.deleteRequest(ticket.requestId, ticket.accessToken); expect(sdk.activeRequests).toBe(0);
    await sdk.submit({ context: 'new facts' }); expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('rejects foreign and duplicate callbacks without replacing a completed result', async () => {
    const { sdk, requests } = capturingClient(); const ticket = await sdk.submit({ context: 'facts' }); const value = callback(requests[0]);
    expect(() => sdk.receiveCallback({ ...value, requestId: 'foreign' })).toThrow('not found');
    expect(() => sdk.receiveCallback({ ...value, metadata: { ...value.metadata, aviation_app_id: 'weather-briefing' } })).toThrow('not found');
    expect(() => sdk.receiveCallback({ ...value, metadata: { ...value.metadata, aviation_callback_nonce: 'f'.repeat(64) } })).toThrow('not found');
    expect(sdk.getRequest(ticket.requestId, ticket.accessToken).status).toBe('queued');
    expect(sdk.receiveCallback(value)).toBe('completed');
    expect(() => sdk.receiveCallback({ ...value, result: 'Replacement' })).toThrow('already complete');
    expect(sdk.getRequest(ticket.requestId, ticket.accessToken).explanation).toBe(value.result);
  });
  it('discards an early callback whose provider request ID does not match acceptance', async () => {
    let sdk!: ExplainerClient; let body!: BrainRequest;
    sdk = client({ fetch: vi.fn().mockImplementation((_url, init) => {
      body = JSON.parse(init.body); expect(sdk.receiveCallback(callback(body, 'foreign'))).toBe('buffered'); return Promise.resolve(queued());
    }) });
    const ticket = await sdk.submit({ context: 'facts' }); expect(sdk.getRequest(ticket.requestId, ticket.accessToken).status).toBe('queued');
    expect(sdk.receiveCallback(callback(body))).toBe('completed');
  });
  it('expires local state without accepting late callbacks or renewing it', async () => {
    let now = 1_800_000_000_000; const { sdk, requests } = capturingClient({ now: () => now });
    const ticket = await sdk.submit({ context: 'facts' }); now += 120_000;
    expect(sdk.activeRequests).toBe(0); expect(() => sdk.receiveCallback(callback(requests[0]))).toThrow('not found');
    expect(() => sdk.getRequest(ticket.requestId, ticket.accessToken)).toThrow('not found');
  });
  it('aborts a stalled submission and releases its reservation', async () => {
    let aborted = false;
    const sdk = client({ submissionTimeoutMs: 20, fetch: vi.fn().mockImplementation((_url, init) =>
      new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => { aborted = true; reject(new Error('aborted')); }))) });
    await expect(sdk.submit({ context: 'facts' })).rejects.toMatchObject({ status: 504 });
    expect(aborted).toBe(true); expect(sdk.activeRequests).toBe(0);
  });
  it('enforces submission deadlines even when a custom transport ignores abort', async () => {
    const sdk = client({ submissionTimeoutMs: 20, fetch: vi.fn().mockImplementation(() => new Promise(() => undefined)) });
    await expect(sdk.submit({ context: 'facts' })).rejects.toMatchObject({ status: 504 });
    expect(sdk.activeRequests).toBe(0);
  });
  it('bounds a stalled queue response body', async () => {
    let cancelled = false;
    const stream = new ReadableStream({ cancel() { cancelled = true; } });
    const sdk = client({ submissionTimeoutMs: 20, fetch: vi.fn().mockResolvedValue(new Response(stream, { status: 202 })) });
    await expect(sdk.submit({ context: 'facts' })).rejects.toMatchObject({ status: 504 });
    expect(cancelled).toBe(true); expect(sdk.activeRequests).toBe(0);
  });
  it('releases in-flight state when its caller aborts or the broker shuts down', async () => {
    const fetch = vi.fn().mockImplementation(() => new Promise(() => undefined));
    const sdk = client({ fetch });
    const controller = new AbortController();
    const pending = sdk.submit({ context: 'facts' }, controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ status: 504 });
    expect(sdk.activeRequests).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
    const second = sdk.submit({ context: 'facts' }); sdk.close();
    await expect(second).rejects.toMatchObject({ status: 504 });
    expect(sdk.activeRequests).toBe(0);
  });
  it('removes state and rejects new requests after shutdown', async () => {
    const { sdk } = capturingClient(); const ticket = await sdk.submit({ context: 'facts' }); sdk.close();
    expect(sdk.activeRequests).toBe(0); expect(() => sdk.getRequest(ticket.requestId, ticket.accessToken)).toThrow('not found');
    await expect(sdk.submit({ context: 'facts' })).rejects.toMatchObject({ status: 503 });
  });
  it('uses a fresh configuration snapshot for new submissions without discarding existing tickets', async () => {
    let configuration: ProviderConfiguration | undefined;
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(queued()));
    const sdk = client({ configuration: () => configuration, fetch });
    expect(sdk.isConfigured()).toBe(false);
    configuration = { brainUrl: 'http://127.0.0.1/one', publicBaseUrl: 'https://flight-planner.example', apiToken: 'synthetic-one' };
    const first = await sdk.submit({ context: 'facts' });
    configuration = { ...configuration, brainUrl: 'http://127.0.0.1/two', apiToken: 'synthetic-two' };
    await sdk.submit({ context: 'more facts' });
    expect(fetch.mock.calls[0][0]).toBe('http://127.0.0.1/one');
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer synthetic-one');
    expect(fetch.mock.calls[1][0]).toBe('http://127.0.0.1/two');
    expect(fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer synthetic-two');
    expect(sdk.getRequest(first.requestId, first.accessToken).status).toBe('queued');
  });
  it('bounds provider request rate even when callers delete their completed tickets', async () => {
    let now = 1_800_000_000_000;
    const { sdk, fetch } = capturingClient({ maxRequestsPerMinute: 1, now: () => now });
    const first = await sdk.submit({ context: 'facts' }); sdk.deleteRequest(first.requestId, first.accessToken);
    await expect(sdk.submit({ context: 'more facts' })).rejects.toMatchObject({ status: 429 });
    expect(fetch).toHaveBeenCalledTimes(1); expect(sdk.activeRequests).toBe(0);
    now += 60_000;
    await sdk.submit({ context: 'new window facts' }); expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('fails closed without exposing configuration or lifecycle hook errors', async () => {
    const fetch = vi.fn();
    const broken = client({ configuration: () => { throw new Error(TOKEN); }, fetch });
    expect(broken.isConfigured()).toBe(false);
    await expect(broken.submit({ context: 'facts' })).rejects.toMatchObject({ status: 503, message: 'AI explanations are not configured for this application.' });
    const guarded = client({ beforeSubmit: () => { throw new Error(TOKEN); }, fetch });
    await expect(guarded.submit({ context: 'facts' })).rejects.toMatchObject({ status: 503, message: 'AI explanations are unavailable.' });
    expect(fetch).not.toHaveBeenCalled();
  });
});
