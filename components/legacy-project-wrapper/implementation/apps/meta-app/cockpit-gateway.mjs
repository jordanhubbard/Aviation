/** Explicit local cockpit profile; importing it starts no listeners. */
import { createServer } from 'node:http';
import { isIP } from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGateway } from './gateway.mjs';

export const cockpitService = {
  namespace: 'cockpit', app: 'local-cockpit-bridge', http: '/api/v1/cockpit',
  mcpTool: 'v1.cockpit.request', direct: 'http://127.0.0.1:18190',
  description: 'Operator-started local GDL90 receiver status, source-separated telemetry and listener lifecycle. Explicit bridge bearer credentials are required; receiver reports are advisory and weather decoding capability must be checked.',
  healthPath: '/api/cockpit/status',
  openapi: { path: '/api/openapi.json', http: '/api/v1/cockpit/api/openapi.json',
    resource: 'aviation://v1/cockpit/openapi', describeTool: 'v1.cockpit.describe' },
};

export async function startCockpitGateway({ host = '127.0.0.1', port = 18191, origin = cockpitService.direct } = {}) {
  if (!isIP(host) || !Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Configure an IP bind address and port from 0 to 65535');
  const gateway = createGateway({ services: [{ ...cockpitService, direct: origin }],
    bindings: { cockpit: { origin } }, appHosts: false,
    allowedHosts: ['localhost', '127.0.0.1', '[::1]', host],
  });
  const server = createServer(async (req, res) => {
    try {
      if (!await gateway.handle(req, res)) { res.writeHead(404); res.end(); }
    } catch {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    }
  });
  try {
    await new Promise((done, reject) => {
      server.once('error', reject);
      server.listen(port, host, done);
    });
  } catch (error) {
    await gateway.close();
    throw error;
  }
  let closing;
  return { server, gateway, close: () => {
    if (!closing) closing = (async () => {
      const closed = new Promise((done, reject) => server.close(error => error ? reject(error) : done()));
      server.closeAllConnections();
      await gateway.close();
      await closed;
    })();
    return closing;
  } };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const listener = await startCockpitGateway({
    host: process.env.AVIATION_COCKPIT_GATEWAY_BIND || '127.0.0.1',
    port: Number(process.env.AVIATION_COCKPIT_GATEWAY_PORT || '18191'),
    origin: process.env.AVIATION_COCKPIT_BRIDGE_ORIGIN || cockpitService.direct,
  });
  const stop = () => { listener.close().catch(() => { process.exitCode = 1; }); };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  console.log(`Local cockpit HTTP/MCP gateway listening on port ${listener.server.address().port}`);
}
