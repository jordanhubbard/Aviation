import { createServer, type RequestListener, type Server } from 'node:http';

// Supertest constructs an IPv4 URL even when it auto-binds an IPv6 wildcard.
// Own the matching listener explicitly; macOS permits distinct listeners at one port.
export async function startLoopback(application: RequestListener): Promise<Server> {
  const server = createServer(application);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  return server;
}

export function closeLoopback(server: Server): Promise<void> {
  server.closeAllConnections();
  return new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
}
