import test from 'node:test';
import { gzipSync, gunzipSync } from 'node:zlib';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { createGateway, contract, sendJson } from './gateway.mjs';
async function listen(t, handler) {
  const server = createServer(handler); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
  return `http://127.0.0.1:${server.address().port}`;
}
async function fixture(t, options = {}) {
  const calls = [];
  const origin = await listen(t, async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks); calls.push({ url: req.url, method: req.method, headers: req.headers, body });
    if (req.url === '/api/auth-html') { res.writeHead(401, { 'content-type': 'text/html' }); res.end('<html>Authentication required</html>'); return; }
    if (req.url === '/api/login-redirect') { res.writeHead(302, { 'content-type': 'text/html', location: '/login' }); res.end('<html>Sign in</html>'); return; }
    if (req.url === '/api/spa-miss') { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<html>launcher</html>'); return; }
    if (req.url === '/slow') { setTimeout(() => res.end('late'), 150).unref(); return; }
    if (req.url === '/compressed') { res.writeHead(200, { 'content-type': 'application/json', 'content-encoding': 'gzip' }); res.end(gzipSync(JSON.stringify({ value: 42 }))); return; }
    if (req.url === '/legacy-text') { res.writeHead(200, { 'content-type': 'text/plain; charset=iso-8859-1' }); res.end(Buffer.from([0xe9])); return; }
    if (req.url === '/binary') { res.writeHead(200, { 'content-type': 'application/octet-stream' }); res.end(body.length ? body : Buffer.from([0, 255, 17])); return; }
    if (req.url === '/redirect') { res.writeHead(302, { location: '/api/items?x=1' }); res.end(); return; }
    if (req.url === '/cookie') { res.writeHead(200, { 'set-cookie': ['session=private; Domain=upstream.invalid; Path=/; Secure; HttpOnly'] }); res.end(); return; }
    if (req.url === '/stream') { res.writeHead(200, { 'content-type': 'text/event-stream' }); res.write('data: first\n\n'); setTimeout(() => res.end('data: last\n\n'), 30); return; }
    if (req.url === '/protected' && req.headers.authorization !== 'Bearer child') { sendJson(res, 401, { error: 'unauthorized' }); return; }
    if (req.url === '/large') { res.writeHead(200); res.end(Buffer.alloc(4 * 1024 * 1024 + 1)); return; }
    if (req.url === '/new/v2/items') { sendJson(res, 200, { renamed: req.method === 'POST' ? JSON.parse(body).newField : 42 }); return; }
    sendJson(res, 200, { path: req.url, method: req.method, body: body.toString(), auth: req.headers.authorization || null, cookie: req.headers.cookie || null });
  });
  const gateway = createGateway({ bindings: { planning: { origin }, weather: { origin } }, ...options });
  t.after(() => gateway.close());
  const edge = await listen(t, async (req, res) => {
    if (!(await gateway.handle(req, res))) sendJson(res, 404, { error: { code: 'unknown_api_route' } });
  });
  return { origin, edge, calls, gateway };
}
test('HTTP discovery owns versioned namespaces and structured API misses', async t => {
  const { edge } = await fixture(t);
  assert.deepEqual(await (await fetch(edge + '/api/v1/services')).json(), contract);
  const api = await (await fetch(edge + '/api/v1/openapi.json')).json();
  assert.deepEqual(api.components.schemas.ServiceRequest, contract.requestSchema);
  assert.equal(Object.keys(api.paths).length, 11);
  for (const path of ['/api/v2/planning/api/plan', '/api/v1/missing/api/items']) {
    const response = await fetch(edge + path); assert.equal(response.status, 404); assert.match(response.headers.get('content-type'), /json/);
  }
});
test('HTTP retains verbs, query, JSON, binary, upstream status and streaming', async t => {
  const { edge, calls } = await fixture(t);
  const nativeHtml = await fetch(edge + '/api/v1/planning/api/spa-miss'); assert.equal(nativeHtml.status, 200); assert.match(await nativeHtml.text(), /launcher/);
  assert.equal((await fetch(edge + '/api/v1/planning/api/auth-html')).status, 401);
  const login = await fetch(edge + '/api/v1/planning/api/login-redirect', { redirect: 'manual' }); assert.equal(login.status, 302); assert.equal(login.headers.get('location'), '/api/v1/planning/login');
  const response = await fetch(edge + '/api/v1/planning/api/items?a=1&a=2', { method: 'PATCH', headers: { 'content-type': 'application/json', authorization: 'Bearer child', 'x-forwarded-for': 'spoof' }, body: '{"x":1}' });
  assert.deepEqual(await response.json(), { path: '/api/items?a=1&a=2', method: 'PATCH', body: '{"x":1}', auth: 'Bearer child', cookie: null });
  assert.equal(calls.at(-1).headers['x-forwarded-for'], undefined);
  const bytes = Buffer.from([0, 255, 17]);
  const binary = await fetch(edge + '/api/v1/planning/binary', { method: 'POST', body: bytes });
  assert.deepEqual(Buffer.from(await binary.arrayBuffer()), bytes);
  assert.equal((await fetch(edge + '/api/v1/planning/protected')).status, 401);
  const stream = await fetch(edge + '/api/v1/planning/stream');
  const reader = stream.body.getReader(); const first = await reader.read();
  assert.match(Buffer.from(first.value).toString(), /first/); assert.doesNotMatch(Buffer.from(first.value).toString(), /last/);
  let tail = ''; for (;;) { const next = await reader.read(); if (next.done) break; tail += Buffer.from(next.value); } assert.match(tail, /last/);
});
test('gateway isolates cookies and rewrites redirects without following them', async t => {
  const { edge, calls } = await fixture(t);
  const cookie = (await fetch(edge + '/api/v1/planning/cookie')).headers.get('set-cookie');
  assert.match(cookie, /^aviation_planning_session=private/); assert.match(cookie, /Path=\/api\/v1\/planning/); assert.doesNotMatch(cookie, /Domain=/i); assert.match(cookie, /HttpOnly/);
  const response = await fetch(edge + '/api/v1/planning/echo', { headers: { cookie: 'meta=secret; aviation_weather_session=other; aviation_planning_session=private' } });
  assert.equal((await response.json()).cookie, 'session=private');
  const redirect = await fetch(edge + '/api/v1/planning/redirect', { redirect: 'manual' });
  assert.equal(redirect.status, 302); assert.equal(redirect.headers.get('location'), '/api/v1/planning/api/items?x=1'); assert.equal(calls.length, 3);
});
test('unsafe paths and destinations fail before any upstream request; timeouts bounded', async t => {
  const { edge, calls, gateway } = await fixture(t, { timeoutMs: 40 });
  for (const path of ['//evil.test', '/%2e%2e/secret', '/%252e%252e/secret', '/%5csecret', '/a/../secret']) {
    assert.equal((await gateway.invoke('planning', { path })).status, 400);
  }
  assert.equal(calls.length, 0);
  assert.throws(() => createGateway({ bindings: { planning: { origin: 'https://user:password@example.com' } } }));
  assert.throws(() => createGateway({ bindings: { missing: {} } }));
  assert.throws(() => createGateway({ bindings: { planning: { adapter: 'unknown' } } }));
  assert.equal((await fetch(edge + '/api/v1/planning/slow')).status, 504);
  const oversized = await gateway.invoke('planning', { path: '/large' }); assert.equal(oversized.status, 502); assert.match(oversized.body, /response_too_large/);
});
test('public v1 stays stable across relocated/versioned upstream and response adaptation', async t => {
  const oldOrigin = await listen(t, async (req, res) => {
    assert.equal(req.url, '/api/items');
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    sendJson(res, 200, { value: req.method === 'POST' ? JSON.parse(Buffer.concat(chunks)).value : 42 });
  });
  const oldGateway = createGateway({ bindings: { planning: { origin: oldOrigin } } }); t.after(() => oldGateway.close());
  const oldEdge = await listen(t, (req, res) => oldGateway.handle(req, res));
  const baselineGet = await (await fetch(oldEdge + '/api/v1/planning/api/items')).json();
  const baselinePost = await (await fetch(oldEdge + '/api/v1/planning/api/items', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ value: 81 }) })).json();
  const { origin } = await fixture(t);
  assert.notEqual(origin, oldOrigin);
  const gateway = createGateway({ bindings: { planning: { origin, basePath: '/new', adapter: 'provider-v2' } }, adapters: {
    'provider-v2': { request: async request => {
      let body = request.body;
      if (request.method === 'POST') {
        if (body?.pipe) { const chunks = []; for await (const chunk of body) chunks.push(chunk); body = Buffer.concat(chunks); }
        body = JSON.stringify({ newField: JSON.parse(body).value });
      }
      return { ...request, body, path: request.path.replace('/api/', '/v2/') };
    }, response: bytes => JSON.stringify({ value: JSON.parse(bytes).renamed }) },
  } }); t.after(() => gateway.close());
  const edge = await listen(t, async (req, res) => gateway.handle(req, res));
  const response = await fetch(edge + '/api/v1/planning/api/items'); assert.deepEqual(await response.json(), baselineGet);
  const post = await fetch(edge + '/api/v1/planning/api/items', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ value: 81 }) }); assert.deepEqual(await post.json(), baselinePost);
  const client = new Client({ name: 'adapter-conformance', version: '1.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(edge + '/mcp'))); t.after(() => client.close());
  const tool = await client.callTool({ name: 'v1.planning.request', arguments: { path: '/api/items', method: 'POST', body: JSON.stringify({ value: 42 }), headers: { 'content-type': 'application/json' } } }); assert.equal(tool.structuredContent.status, 200); assert.deepEqual(JSON.parse(tool.structuredContent.body), { value: 42 });
});
test('real MCP client discovers matching schemas/resources and invokes same service without inheriting transport auth', async t => {
  const { edge, calls } = await fixture(t);
  const client = new Client({ name: 'gateway-conformance', version: '1.0.0' });
  await client.connect(new StreamableHTTPClientTransport(new URL(edge + '/mcp'), { requestInit: { headers: { authorization: 'Bearer gateway-only', cookie: 'meta=private' } } }));
  t.after(() => client.close());
  const { tools } = await client.listTools(); assert.equal(tools.length, 11);
  const tool = tools.find(x => x.name === 'v1.planning.request'); assert.deepEqual(tool.inputSchema, contract.requestSchema);
  const resources = await client.listResources(); assert.equal(resources.resources.length, 2);
  const catalog = await client.readResource({ uri: 'aviation://v1/services' }); assert.deepEqual(JSON.parse(catalog.contents[0].text), contract);
  const result = await client.callTool({ name: tool.name, arguments: { path: '/protected' } });
  assert.equal(result.isError, true); assert.equal(result.structuredContent.status, 401); assert.equal(calls.at(-1).headers.authorization, undefined);
  const authorized = await client.callTool({ name: tool.name, arguments: { path: '/protected', headers: { authorization: 'Bearer child', cookie: 'session=explicit-child' } } });
  assert.equal(calls.at(-1).headers.cookie, 'session=explicit-child');
  assert.equal(authorized.isError, false); assert.equal(authorized.structuredContent.status, 200);
  const htmlError = await client.callTool({ name: tool.name, arguments: { path: '/api/auth-html' } });
  assert.equal(htmlError.isError, true); assert.equal(htmlError.structuredContent.status, 401); assert.match(htmlError.structuredContent.body, /Authentication required/);
  const htmlRedirect = await client.callTool({ name: tool.name, arguments: { path: '/api/login-redirect' } });
  assert.equal(htmlRedirect.structuredContent.status, 302); assert.equal(htmlRedirect.structuredContent.headers.location, '/api/v1/planning/login');
  const count = calls.length;
  try { const invalid = await client.callTool({ name: tool.name, arguments: { path: '/echo', method: 'INVALID' } }); assert.equal(invalid.isError, true); } catch (error) { assert.match(error.message, /valid|schema|method|enum/i); }
  assert.equal(calls.length, count);
  const binary = await client.callTool({ name: tool.name, arguments: { path: '/binary' } });
  assert.equal(binary.structuredContent.bodyEncoding, 'base64'); assert.deepEqual(Buffer.from(binary.structuredContent.body, 'base64'), Buffer.from([0, 255, 17]));
  const compressed = await client.callTool({ name: tool.name, arguments: { path: '/compressed', headers: { 'accept-encoding': 'gzip' } } });
  assert.equal(compressed.structuredContent.bodyEncoding, 'base64'); assert.deepEqual(JSON.parse(gunzipSync(Buffer.from(compressed.structuredContent.body, 'base64'))), { value: 42 });
  const legacyText = await client.callTool({ name: tool.name, arguments: { path: '/legacy-text' } });
  assert.equal(legacyText.structuredContent.bodyEncoding, 'base64'); assert.deepEqual(Buffer.from(legacyText.structuredContent.body, 'base64'), Buffer.from([0xe9]));
  assert.equal((await fetch(edge + '/mcp', { method: 'POST', headers: { origin: 'https://attacker.invalid' }, body: '{}' })).status, 403);
});


test('real Meta App handler keeps HTML separate from unknown APIs', async t => {
  const dist = await mkdtemp(join(tmpdir(), 'aviation-meta-html-'));
  await writeFile(join(dist, 'index.html'), '<!doctype html><div id="root"></div>');
  t.after(() => rm(dist, { recursive: true, force: true }));
  process.env.META_APP_DIST = dist;
  const { handler } = await import('./server.mjs');
  const edge = await listen(t, handler);
  for (const path of ['/api/v99/services', '/api/unknown', '/mcp/missing']) {
    const response = await fetch(edge + path); assert.equal(response.status, 404); assert.equal((await response.json()).error.code, 'unknown_api_route');
  }
  const response = await fetch(edge + '/'); assert.equal(response.status, 200); assert.match(response.headers.get('content-type'), /text\/html/);
  assert.match(await response.text(), /<div id="root">/);
});

test('client cancellation closes the upstream response stream', async t => {
  let closed;
  const upstreamClosed = new Promise(resolve => { closed = resolve; });
  const origin = await listen(t, (req, res) => {
    res.writeHead(200, { 'content-type': 'text/event-stream' }); res.write('data: ready\n\n');
    res.once('close', closed);
  });
  const gateway = createGateway({ bindings: { planning: { origin } }, timeoutMs: 2000 }); t.after(() => gateway.close());
  const edge = await listen(t, (req, res) => gateway.handle(req, res));
  const controller = new AbortController();
  const response = await fetch(edge + '/api/v1/planning/stream', { signal: controller.signal });
  await response.body.getReader().read(); controller.abort();
  let timer;
  try { await Promise.race([upstreamClosed, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Upstream stream was not cancelled')), 1000); })]); }
  finally { clearTimeout(timer); }
});
