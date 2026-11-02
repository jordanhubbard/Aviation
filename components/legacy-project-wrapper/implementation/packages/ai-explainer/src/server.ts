import express from 'express';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import type { ExplainerClient } from './ExplainerClient.js';
import { explainerRoute, type ExplanationMiddleware } from './explainerRoute.js';

export type ExplanationServerOptions = { host?: string; port?: number; staticRoot?: string; middleware?: ExplanationMiddleware };
export type ExplanationServer = { url: string; close(): Promise<void> };

/** Own one broker per application, regardless of how many backend workers proxy to it. */
export async function startExplanationServer(client: ExplainerClient,
  options: ExplanationServerOptions = {}): Promise<ExplanationServer> {
  const host = options.host ?? '127.0.0.1';
  const port = options.port ?? 0;
  if (!['127.0.0.1', '::1', '0.0.0.0'].includes(host)
      || !Number.isSafeInteger(port) || port < 0 || port > 65_535) {
    throw new Error('Invalid explanation server binding');
  }
  const app = express();
  app.disable('x-powered-by');
  app.use(options.middleware ?? explainerRoute(client));
  if (options.staticRoot) {
    // Only an application-selected public directory is served; SDK state is never a static root.
    app.use(express.static(resolve(options.staticRoot), { dotfiles: 'deny' }));
  }
  const server = createServer({ maxHeaderSize: 16_384 }, app);
  server.requestTimeout = 30_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5_000;
  server.on('close', () => client.close());
  try {
    await new Promise<void>((ready, reject) => {
      server.once('error', reject);
      server.listen(port, host, () => { server.removeListener('error', reject); ready(); });
    });
  } catch (error) { client.close(); throw error; }
  const address = server.address();
  if (!address || typeof address === 'string') {
    client.close(); server.close(); throw new Error('Explanation server did not bind');
  }
  const reachable = host === '0.0.0.0' ? '127.0.0.1' : host === '::1' ? '[::1]' : host;
  let closing: Promise<void> | undefined;
  return { url: `http://${reachable}:${address.port}`, close() {
    if (!closing) {
      client.close();
      closing = new Promise<void>(done => {
        server.close(() => done());
        server.closeAllConnections();
      });
    }
    return closing;
  } };
}
