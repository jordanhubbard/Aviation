import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { contract, createGateway, sendJson } from './gateway.mjs';
import { startCockpitGateway } from './cockpit-gateway.mjs';

test('local cockpit profile isolates discovery and preserves explicit HTTP/MCP authentication', async () => {
  const original = JSON.stringify(contract);
  let seenHost;
  const schema = { openapi: '3.1.0', info: { title: 'Bridge fixture', version: '1' },
    paths: { '/api/cockpit/status': { get: { responses: { 200: { description: 'Typed status' } } } } } };
  const provider = createServer((req, res) => {
    seenHost = req.headers.host;
    if (req.url === '/api/openapi.json') return sendJson(res, 200, schema);
    if (req.headers.authorization !== 'Bearer explicit-operator') return sendJson(res, 401, { detail: 'unauthorized' });
    sendJson(res, 200, { source: 'local-udp-gdl90', listening: false });
  });
  provider.listen(0, '127.0.0.1'); await once(provider, 'listening');
  const origin = `http://127.0.0.1:${provider.address().port}`;
  const local = await startCockpitGateway({ port: 0, origin });
  const edge = `http://127.0.0.1:${local.server.address().port}`;
  const client = new Client({ name: 'cockpit-profile-conformance', version: '1' });
  const hosted = createGateway();
  try {
    const catalog = await (await fetch(edge + '/api/v1/services')).json();
    assert.deepEqual(catalog.services.map(s => s.namespace), ['cockpit']);
    assert.equal(catalog.services[0].direct, origin);
    const openapi = await (await fetch(edge + '/api/v1/openapi.json')).json();
    assert.deepEqual(Object.keys(openapi.paths), ['/api/v1/cockpit/{path}']);
    const absent = await hosted.invoke('cockpit', { path: '/api/cockpit/status' });
    assert.equal(absent.status, 404);
    assert.equal(JSON.stringify(contract), original);
    const path = '/api/v1/cockpit/api/cockpit/status';
    assert.equal((await fetch(edge + path)).status, 401);
    const headers = { Authorization: 'Bearer explicit-operator' };
    const direct = await (await fetch(origin + '/api/cockpit/status', { headers })).json();
    assert.deepEqual(await (await fetch(edge + path, { headers })).json(), direct);
    assert.equal(seenHost, new URL(origin).host);
    await client.connect(new StreamableHTTPClientTransport(new URL(edge + '/mcp')));
    const tools = (await client.listTools()).tools.map(t => t.name);
    assert.ok(tools.includes('v1.cockpit.request') && tools.includes('v1.cockpit.describe'));
    assert.ok(!tools.includes('v1.planning.request'));
    const described = await client.callTool({ name: 'v1.cockpit.describe', arguments: {} });
    assert.deepEqual(JSON.parse(described.content[0].text), schema);
    const denied = await client.callTool({ name: 'v1.cockpit.request', arguments: { path: '/api/cockpit/status' } });
    assert.equal(denied.structuredContent.status, 401);
    const result = await client.callTool({ name: 'v1.cockpit.request', arguments: { path: '/api/cockpit/status', headers } });
    assert.equal(result.structuredContent.status, 200);
    assert.deepEqual(JSON.parse(result.structuredContent.body), direct);
    assert.ok(!JSON.stringify(catalog).includes('explicit-operator'));
  } finally {
    await client.close(); await local.close(); await local.close(); await hosted.close();
    provider.closeAllConnections(); await new Promise(done => provider.close(done));
  }
});

test('local gateway listener releases its port and rejects invalid binding configuration', async () => {
  await assert.rejects(startCockpitGateway({ host: 'not-an-ip' }), /IP bind/);
  const local = await startCockpitGateway({ port: 0 });
  const port = local.server.address().port;
  await assert.rejects(startCockpitGateway({ port }), { code: 'EADDRINUSE' });
  await local.close();
  const replacement = await startCockpitGateway({ port });
  await replacement.close();
});
