import { readFileSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { createMcpHandler, McpServer, fromJsonSchema } from '@modelcontextprotocol/server';
import { toNodeHandler } from '@modelcontextprotocol/node';

export const contract = JSON.parse(readFileSync(new URL('./gateway-contract.json', import.meta.url)));
const methods = contract.requestSchema.properties.method.enum;
const MAX_MCP_BYTES = 4 * 1024 * 1024;
const hop = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'proxy-connection', 'te', 'trailer', 'transfer-encoding', 'upgrade', 'host']);
export class GatewayError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}
export function sendJson(res, status, data) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'x-content-type-options': 'nosniff' });
  res.end(JSON.stringify(data));
}
function safePath(path) {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') || /[\\\x00-\x20#]/.test(path)) throw new GatewayError(400, 'invalid_path');
  let decoded = path.split('?')[0];
  for (let i = 0; i < 5; i++) {
    if (decoded.split('/').some(part => part === '.' || part === '..') || /[\\\x00-\x20?#]/.test(decoded) || decoded.startsWith('//')) throw new GatewayError(400, 'invalid_path');
    let next;
    try { next = decodeURIComponent(decoded); } catch { throw new GatewayError(400, 'invalid_path'); }
    if (next === decoded) return path;
    decoded = next;
  }
  throw new GatewayError(400, 'invalid_path');
}
function cleanHeaders(headers) {
  const excluded = new Set([...hop, ...String(headers.connection || '').toLowerCase().split(',').map(x => x.trim())]);
  return Object.fromEntries(Object.entries(headers).filter(([name]) => !excluded.has(name.toLowerCase()) && !name.toLowerCase().startsWith('x-forwarded-') && name.toLowerCase() !== 'forwarded'));
}
function cookiePrefix(ns) { return `aviation_${ns}_`; }
function inboundCookies(value, ns) {
  return String(value || '').split(';').map(x => x.trim()).filter(x => x.startsWith(cookiePrefix(ns))).map(x => x.slice(cookiePrefix(ns).length)).join('; ');
}
function outboundCookie(value, ns, binding) {
  const parts = value.split(';');
  parts[0] = cookiePrefix(ns) + parts[0].trim();
  let path = parts.find(x => /^\s*path=/i.test(x))?.split('=').slice(1).join('=').trim() || '/';
  if (binding.basePath && path.startsWith(binding.basePath + '/')) path = path.slice(binding.basePath.length);
  path = binding.adapter.location?.(path) || path;
  if (!path.startsWith('/')) path = '/';
  return [...parts.filter((x, i) => i === 0 || !/^\s*(domain|path)=/i.test(x)), ` Path=/api/v1/${ns}${path}`].join(';');
}
export function openapi() {
  return { openapi: '3.1.0', info: { title: 'Aviation edge gateway', version: contract.version, description: contract.compatibility },
    paths: Object.fromEntries(contract.services.map(service => [`${service.http}/{path}`, Object.fromEntries(methods.filter(x => x !== 'HEAD' && x !== 'OPTIONS').map(method => [method.toLowerCase(), {
      operationId: `${service.namespace}_${method.toLowerCase()}`, description: 'Service-relative path includes its native API prefix. See service discovery for direct APIs. HTTP response bytes and status are preserved.',
      ...( ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) ? { requestBody: { required: false, content: { 'application/json': { schema: {} }, 'application/octet-stream': { schema: { type: 'string', format: 'binary' } }, 'multipart/form-data': { schema: { type: 'object', additionalProperties: true } } } } } : {}),
      'x-aviation-catch-all': true,
      parameters: [{ name: 'path', in: 'path', required: true, schema: { type: 'string' }, description: 'Catch-all service path, including slash-separated segments and its API prefix.' }],
      responses: { default: { description: 'Upstream status, headers and body, or a JSON gateway error.' } },
    }]))])), components: { schemas: { ServiceRequest: contract.requestSchema, ServiceResponse: contract.responseSchema } } };
}
export function createGateway({ bindings = JSON.parse(process.env.AVIATION_GATEWAY_BINDINGS || '{}'), adapters = {}, timeoutMs = 180000, allowedHosts = ['meta-app.jordanhubbard.net', 'localhost', '127.0.0.1', '[::1]'] } = {}) {
  const registry = new Map();
  for (const key of Object.keys(bindings)) if (!contract.services.some(s => s.namespace === key)) throw new Error(`Unknown gateway namespace: ${key}`);
  for (const service of contract.services) {
    const binding = bindings[service.namespace] || {};
    const origin = new URL(binding.origin || service.direct);
    if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/') throw new Error('Gateway origins must be plain HTTP(S) origins');
    const basePath = binding.basePath || '';
    if (basePath && (safePath(basePath) !== basePath || basePath.includes('?') || basePath.endsWith('/'))) throw new Error('Invalid gateway basePath');
    const adapterId = binding.adapter || 'identity';
    const adapter = adapterId === 'identity' ? {} : adapters[adapterId];
    if (!adapter) throw new Error(`Unknown gateway adapter: ${adapterId}`);
    registry.set(service.namespace, { service, origin, basePath, adapter });
  }
  async function route(ns, path, method, headers = {}, body, scopedCookies = true) {
    const binding = registry.get(ns);
    if (!binding) throw new GatewayError(404, 'unknown_namespace');
    safePath(path);
    if (!methods.includes(method)) throw new GatewayError(405, 'unsupported_method');
    const changed = await binding.adapter.request?.({ path, method, headers, body }) || { path, method, headers, body };
    safePath(changed.path);
    const target = new URL(binding.origin.origin + binding.basePath + changed.path);
    const outgoing = cleanHeaders(changed.headers);
    if (scopedCookies) {
      const cookie = inboundCookies(outgoing.cookie, ns);
      delete outgoing.cookie;
      if (cookie) outgoing.cookie = cookie;
    }
    // Adapters can change the body; derive framing again rather than forwarding stale length.
    if (changed.body !== body) delete outgoing['content-length'];
    return { binding, target, method: changed.method, headers: outgoing, body: changed.body };
  }
  function responseHeaders(ns, binding, upstream, scopedCookies, target) {
    const headers = cleanHeaders(upstream.headers);
    if (scopedCookies && headers['set-cookie']) headers['set-cookie'] = headers['set-cookie'].map(value => outboundCookie(value, ns, binding));
    if (headers.location) {
      const location = new URL(headers.location, target);
      if (location.origin === binding.origin.origin && (!binding.basePath || location.pathname.startsWith(binding.basePath + '/'))) {
        const path = location.pathname.slice(binding.basePath.length) + location.search + location.hash;
        headers.location = `/api/v1/${ns}${binding.adapter.location?.(path) || path}`;
      }
    }
    return headers;
  }
  async function exchange(ns, path, method, headers, body, signal, scopedCookies = true) {
    const routed = await route(ns, path, method, headers, body, scopedCookies);
    return new Promise((resolve, reject) => {
      const { binding, target } = routed;
      const request = (target.protocol === 'https:' ? httpsRequest : httpRequest)(target, { method: routed.method, headers: routed.headers, signal }, upstream => {
        if (path.split('?')[0].startsWith('/api/') && /text\/html/i.test(upstream.headers['content-type'] || '')) {
          upstream.resume(); reject(new GatewayError(502, 'upstream_contract_error')); return;
        }
        try { resolve({ upstream, headers: responseHeaders(ns, binding, upstream, scopedCookies, target), adapter: binding.adapter, request }); }
        catch { upstream.resume(); reject(new GatewayError(502, 'invalid_upstream_headers')); }
      });
      // Whole exchange deadline, including an upstream that trickles forever.
      const timer = setTimeout(() => request.destroy(new GatewayError(504, 'upstream_timeout')), timeoutMs);
      request.once('close', () => clearTimeout(timer));
      request.once('error', reject);
      if (routed.body?.pipe) { routed.body.once('error', error => request.destroy(error)); routed.body.pipe(request); } else request.end(routed.body);
    });
  }
  async function invoke(ns, args, signal) {
    try {
      const headers = Object.fromEntries(Object.entries(args.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
      if (args.body !== undefined && args.body_base64 !== undefined) throw new GatewayError(400, 'ambiguous_body');
      delete headers['content-length'];
      const body = args.body_base64 !== undefined ? Buffer.from(args.body_base64, 'base64') : args.body;
      if (body !== undefined && Buffer.byteLength(body) > MAX_MCP_BYTES) throw new GatewayError(413, 'body_too_large');
      const result = await exchange(ns, args.path, args.method || 'GET', headers, body, signal, false);
      let size = 0;
      const chunks = [];
      for await (const chunk of result.upstream) {
        size += chunk.length;
        if (size > MAX_MCP_BYTES) { result.request.destroy(); throw new GatewayError(502, 'response_too_large'); }
        chunks.push(chunk);
      }
      let bytes = Buffer.concat(chunks);
      if (result.adapter.response) {
        bytes = Buffer.from(await result.adapter.response(bytes, result.headers));
        delete result.headers['content-length']; delete result.headers['content-encoding'];
      }
      if (bytes.length > MAX_MCP_BYTES) throw new GatewayError(502, 'response_too_large');
      const text = /json|text\/|xml|javascript/.test(result.headers['content-type'] || '');
      return { status: result.upstream.statusCode, headers: Object.fromEntries(Object.entries(result.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join('\n') : String(v)])), body: bytes.toString(text ? 'utf8' : 'base64'), bodyEncoding: text ? 'utf8' : 'base64' };
    } catch (error) {
      return { status: error.status || 502, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: { code: error instanceof GatewayError ? error.code : 'upstream_unavailable' } }), bodyEncoding: 'utf8' };
    }
  }
  const mcp = createMcpHandler(() => {
    const server = new McpServer({ name: 'aviation-edge', version: contract.version });
    for (const service of contract.services) server.registerTool(service.mcpTool, {
      description: `Call the stable v1 ${service.namespace} service API. ${service.description} Explicit service credentials required where the upstream requires authentication. Response status/headers/body are preserved; use HTTP for streaming or responses above 4 MiB.`,
      inputSchema: fromJsonSchema(contract.requestSchema), outputSchema: fromJsonSchema(contract.responseSchema),
    }, async (args, ctx) => {
      const value = await invoke(service.namespace, args, ctx.signal);
      return { content: [{ type: 'text', text: JSON.stringify(value) }], structuredContent: value, isError: value.status >= 400 };
    });
    server.registerResource('services', 'aviation://v1/services', { mimeType: 'application/json', description: 'Versioned service catalog and compatibility policy' }, async uri => ({ contents: [{ uri: String(uri), mimeType: 'application/json', text: JSON.stringify(contract) }] }));
    server.registerResource('openapi', 'aviation://v1/openapi', { mimeType: 'application/json' }, async uri => ({ contents: [{ uri: String(uri), mimeType: 'application/json', text: JSON.stringify(openapi()) }] }));
    return server;
  });
  const nodeMcp = toNodeHandler(mcp);
  async function handle(req, res) {
    const pathname = req.url.split('?')[0];
    if (pathname === '/mcp') {
      let host, origin;
      try { host = new URL(`http://${req.headers.host}`).hostname; origin = req.headers.origin && new URL(req.headers.origin); } catch { sendJson(res, 403, { error: { code: 'invalid_origin' } }); return true; }
      if (!allowedHosts.includes(host) || (origin && !contract.services.some(s => s.direct === origin.origin) && !['https://meta-app.jordanhubbard.net', 'http://localhost', 'http://127.0.0.1'].includes(origin.origin))) { sendJson(res, 403, { error: { code: 'origin_not_allowed' } }); return true; }
      await nodeMcp(req, res); return true;
    }
    if (pathname === '/api/v1/services' || pathname === '/api/v1/openapi.json') {
      if (!['GET', 'HEAD'].includes(req.method)) sendJson(res, 405, { error: { code: 'method_not_allowed' } });
      else if (req.method === 'HEAD') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(); }
      else sendJson(res, 200, pathname.endsWith('services') ? contract : openapi());
      return true;
    }
    const match = /^\/api\/v1\/([^/]+)(\/.*)?$/.exec(pathname);
    if (match) match[2] = (match[2] || '/') + (req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '');
    if (!match) return false;
    const controller = new AbortController();
    const abort = () => { if (!res.writableFinished) controller.abort(); };
    res.once('close', abort);
    try {
      const result = await exchange(match[1], match[2] || '/', req.method, req.headers, req, controller.signal);
      if (result.adapter.response) {
        let size = 0; const chunks = [];
        for await (const chunk of result.upstream) { size += chunk.length; if (size > MAX_MCP_BYTES) throw new GatewayError(502, 'response_too_large'); chunks.push(chunk); }
        const bytes = Buffer.from(await result.adapter.response(Buffer.concat(chunks), result.headers));
        delete result.headers['content-length']; delete result.headers['content-encoding'];
        res.writeHead(result.upstream.statusCode, result.headers); res.end(bytes);
      } else {
        res.writeHead(result.upstream.statusCode, result.headers);
        result.upstream.once('error', () => res.destroy());
        result.upstream.pipe(res);
      }
    } catch (error) {
      if (!res.headersSent) sendJson(res, error.status || 502, { error: { code: error instanceof GatewayError ? error.code : 'upstream_unavailable' } });
      else res.destroy();
    }
    return true;
  }
  return { handle, invoke, close: () => mcp.close() };
}
