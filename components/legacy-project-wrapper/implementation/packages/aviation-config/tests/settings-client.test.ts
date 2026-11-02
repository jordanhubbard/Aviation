import { createServer, type Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { saveServiceSecret } from '../src/client';

const servers: Server[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeIdleConnections();
  })));
});

async function endpoint(status: number, body: unknown, observe?: (value: unknown, path: string, method?: string) => void) {
  const server = createServer(async (request, response) => {
    let payload = '';
    for await (const chunk of request) payload += chunk;
    observe?.(JSON.parse(payload), request.url!, request.method);
    response.writeHead(status, { 'content-type': 'application/json' });
    response.end(typeof body === 'string' ? body : JSON.stringify(body));
  });
  servers.push(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing fixture address');
  return `http://127.0.0.1:${address.port}`;
}

describe('shared settings save contract over real HTTP', () => {
  it('confirms the intended field and preserves the submitted value', async () => {
    let received: unknown;
    const origin = await endpoint(200, { success: true, service: 'openweather', key: 'api_key' },
      (body, path, method) => { received = body; expect(path).toBe('/api/settings/secrets'); expect(method).toBe('POST'); });
    await expect(saveServiceSecret(origin, 'openweather', 'api_key', '  synthetic\nvalue  ')).resolves.toBeUndefined();
    expect(received).toEqual({ service: 'openweather', key: 'api_key', value: '  synthetic\nvalue  ' });
  });

  it.each([{ success: false, error: 'synthetic-sensitive-value' }, {}, null, [],
    { success: 1 }, { success: true, service: 'another-service' }, { success: true, key: 'another-key' }, '<invalid-json>'].map(body => [body]))
  ('rejects unconfirmed success without exposing response or submitted secrets: %j', async body => {
    const origin = await endpoint(200, body);
    await expect(saveServiceSecret(origin, 'openweather', 'api_key', 'synthetic-sensitive-value'))
      .rejects.toThrow('Secret save was not confirmed');
  });

  it('does not expose HTTP failure response content', async () => {
    const origin = await endpoint(503, { error: 'synthetic-sensitive-value' });
    await expect(saveServiceSecret(origin, 'openweather', 'api_key', 'synthetic-sensitive-value'))
      .rejects.toThrow('Save failed (HTTP 503)');
  });
});
