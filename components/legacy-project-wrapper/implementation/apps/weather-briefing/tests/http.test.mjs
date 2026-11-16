import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { createGateway, sendJson } from '../../meta-app/gateway.mjs';
const require = createRequire(import.meta.url);
const metaRequire = createRequire(new URL('../../meta-app/package.json', import.meta.url));
const { Client, StreamableHTTPClientTransport } = await import(metaRequire.resolve('@modelcontextprotocol/client'));
const { WeatherBriefingService } = require('../dist/service.js');
const { handleWeatherApi } = require('../dist/api.js');
let provider, server, edge, gateway, origin, publicOrigin, client;
const providerHeaders = [];
const report = (name, code) => ({ status: 'available', reports: [{ icaoId: code,
  ...(name === 'metar' ? { rawOb: `${code} 160000Z 27005KT 10SM FEW020 18/12 A2992`, reportTime: '2026-11-16T00:00:00Z' } :
    { rawTAF: `TAF ${code} 160000Z 1600/1700 P6SM\n FM160600 BKN030`, issueTime: '2026-11-16T00:00:00Z', validTimeFrom: 1794787200, validTimeTo: 1794873600 }) }],
  source: { provider: 'Synthetic NOAA adapter', url: 'https://example.invalid/' + name, retrieved_at_utc: '2026-11-16T00:01:00Z' } });
async function listen(s) { s.listen(0, '127.0.0.1'); await once(s, 'listening'); return `http://127.0.0.1:${s.address().port}`; }
async function close(s) { s.closeAllConnections(); await new Promise(r => s.close(r)); }
before(async () => {
  provider = createServer((req, res) => {
    providerHeaders.push(req.headers);
    const url = new URL(req.url, 'http://provider'); const name = url.pathname.slice(1), code = url.searchParams.get('airport');
    if (code === 'KOAK' && name === 'taf') { res.writeHead(503); res.end(); return; }
    const data = report(name, code);
    if ((code === 'KSJC' && name === 'taf') || (code === 'KSEA' && name === 'metar')) { data.status = 'no_reports'; data.reports = []; }
    if (code === 'KJFK') data.source = null;
    sendJson(res, 200, data);
  });
  process.env.AVIATION_WEATHER_API_BASE_URL = await listen(provider);
  const service = new WeatherBriefingService({ autoStart: false, notamClient: { fetchByIcao: async () => [] } });
  server = createServer(async (req,res) => { if (!await handleWeatherApi(req,res,service)) sendJson(res,404,{}); });
  origin = await listen(server);
  gateway = createGateway({ bindings: { weather: { origin } } });
  edge = createServer(async (req,res) => { if (!await gateway.handle(req,res)) sendJson(res,404,{}); });
  publicOrigin = await listen(edge);
  client = new Client({ name: 'legacy-weather-contract', version: '1' });
  await client.connect(new StreamableHTTPClientTransport(new URL(publicOrigin+'/mcp')));
});
after(async () => { await client?.close(); await gateway?.close(); for (const s of [edge,server,provider]) if (s) await close(s); delete process.env.AVIATION_WEATHER_API_BASE_URL; });
test('real station/list handlers preserve complete weather payloads through HTTP and MCP', async () => {
  const path = '/station?code=ksfo';
  const direct = await (await fetch(origin+path)).json();
  const http = await (await fetch(publicOrigin+'/api/v1/weather'+path, { headers: { authorization: 'Bearer client-only', cookie: 'private=client' } })).json();
  assert.deepEqual(http, direct);
  const mcp = await client.callTool({ name: 'v1.weather.request', arguments: { path } });
  assert.equal(mcp.isError, false); assert.deepEqual(JSON.parse(mcp.structuredContent.body), direct);
  assert.match(http.station.metar, /^KSFO/); assert.match(http.station.taf.reports[0].rawTAF, /\n FM/);
  assert.equal(http.station.taf.source.provider, 'Synthetic NOAA adapter');
  assert.ok(Number.isFinite(http.station.latitude));
  const list = await (await fetch(publicOrigin+'/api/v1/weather/stations?region=us-west')).json();
  assert.deepEqual(list.stations.find(s=>s.code==='KSFO'), direct.station);
  const mcpList = await client.callTool({ name: 'v1.weather.request', arguments: { path: '/stations?region=us-west' } });
  assert.deepEqual(JSON.parse(mcpList.structuredContent.body), list);
  assert.ok(providerHeaders.every(h => !h.authorization && !h.cookie));
});
test('partial failures, no TAF, TAF without METAR and invalid provider schemas remain distinct', async () => {
  const one = async code => (await (await fetch(publicOrigin+'/api/v1/weather/station?code='+code)).json()).station;
  assert.equal((await one('KOAK')).taf.status, 'unavailable'); assert.ok((await one('KOAK')).metar);
  assert.equal((await one('KSJC')).taf.status, 'no_reports'); assert.equal((await one('KSJC')).partial, false);
  assert.equal((await one('KSEA')).metar, null); assert.equal((await one('KSEA')).taf.status, 'available');
  assert.equal((await one('KJFK')).metar_reports.status, 'unavailable'); assert.equal((await one('KJFK')).partial, true);
});
test('text briefing is unmodified through HTTP and MCP and contains both source time domains', async () => {
  const path='/briefing?station=KSFO&days=7';
  const direct = await (await fetch(origin+path)).text();
  const proxied = await (await fetch(publicOrigin+'/api/v1/weather'+path)).text();
  const mcp = await client.callTool({ name: 'v1.weather.request', arguments: { path } });
  assert.equal(proxied,direct); assert.equal(mcp.structuredContent.body,direct);
  assert.match(direct,/METAR observation:/); assert.match(direct,/TAF forecast:/);
  assert.match(direct,/Valid 2026-11-16T00:00:00.000Z → 2026-11-17T00:00:00.000Z/);
  assert.match(direct,/does not extend published TAF validity/);
});
test('invalid stations and unsupported methods are rejected through the gateway', async () => {
  assert.equal((await fetch(publicOrigin+'/api/v1/weather/station?code=bad-value')).status,400);
  assert.equal((await fetch(publicOrigin+'/api/v1/weather/station?code=KSFO',{method:'POST'})).status,405);
});
