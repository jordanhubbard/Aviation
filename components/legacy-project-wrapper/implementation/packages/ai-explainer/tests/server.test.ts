import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExplainerClient } from '../src/ExplainerClient.js';
import { startExplanationServer, type ExplanationServer } from '../src/server.js';

const handles: ExplanationServer[] = [];
const directories: string[] = [];
afterEach(async () => {
  for (const handle of handles.splice(0)) await handle.close();
  for (const directory of directories.splice(0)) await rm(directory, { recursive: true, force: true });
});
describe('application-local shared explanation broker', () => {
  it('serves the SDK API and closes its private registry and listener', async () => {
    const sdk = new ExplainerClient({ appId: 'flight-planner', publicBaseUrl: 'http://127.0.0.1',
      brainUrl: 'http://127.0.0.1/rcc', apiToken: 'synthetic-token',
      fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true, status: 'queued', requestId: 'rcc-1' }), { status: 202 })) });
    const broker = await startExplanationServer(sdk); handles.push(broker);
    const config = await fetch(broker.url + '/api/explain/config');
    expect(await config.json()).toEqual({ available: true });
    expect(config.headers.get('cache-control')).toBe('no-store');
    expect(config.headers.get('x-powered-by')).toBeNull();
    const accepted = await fetch(broker.url + '/api/explain', { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ context: 'Wind facts' }) });
    expect(accepted.status).toBe(202); await accepted.json();
    expect(sdk.activeRequests).toBe(1);
    await broker.close(); await broker.close();
    expect(sdk.activeRequests).toBe(0);
    await expect(fetch(broker.url + '/api/explain/config')).rejects.toThrow();
  });
  it('can serve a static application without exposing dot files or replacing API routes', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'aviation-ai-static-')); directories.push(directory);
    await writeFile(join(directory, 'index.html'), '<!doctype html><h1>Synthetic preflight app</h1>');
    await writeFile(join(directory, '.keystore'), 'synthetic-private-file');
    const sdk = new ExplainerClient();
    const broker = await startExplanationServer(sdk, { staticRoot: directory }); handles.push(broker);
    const page = await fetch(broker.url + '/'); expect(page.status).toBe(200);
    expect(await page.text()).toContain('Synthetic preflight app');
    const hidden = await fetch(broker.url + '/.keystore'); expect(hidden.status).toBe(404);
    expect(await hidden.text()).not.toContain('synthetic-private-file');
    expect(await (await fetch(broker.url + '/api/explain/config')).json()).toEqual({ available: false });
    expect((await fetch(broker.url + '/api/explain/unknown')).status).toBe(404);
  });
  it('rejects malformed bindings before creating a listener', async () => {
    const sdk = new ExplainerClient();
    await expect(startExplanationServer(sdk, { port: -1 })).rejects.toThrow('Invalid explanation server binding');
    await expect(startExplanationServer(sdk, { host: 'provider.invalid' })).rejects.toThrow('Invalid explanation server binding');
    sdk.close();
  });
});
