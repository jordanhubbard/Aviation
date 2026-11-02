import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { SecureKeyStore } from '@aviation/keystore';
import { providerConfigurationReader } from '../src/configuration.js';

const directories: string[] = [];
const MASTER = 'synthetic-configuration-master-key-32-characters';
afterEach(() => { for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true }); });
describe('canonical RCC configuration', () => {
  it('uses only explicit normal environment fields when no store is selected', () => {
    const read = providerConfigurationReader({ NODE_ENV: 'production', RCC_BRAIN_URL: 'http://127.0.0.1/request',
      RCC_API_TOKEN: 'synthetic-env-token', AVIATION_EXPLAIN_PUBLIC_URL: 'https://flight-planner.example' });
    expect(read()).toEqual({ brainUrl: 'http://127.0.0.1/request', apiToken: 'synthetic-env-token', publicBaseUrl: 'https://flight-planner.example' });
  });
  it('reads encrypted canonical fields first and refreshes after atomic writes and deletion', () => {
    const directory = mkdtempSync(join(tmpdir(), 'aviation-rcc-config-')); directories.push(directory);
    const path = join(directory, 'credentials.keystore');
    const env = { NODE_ENV: 'production', KEYSTORE_PATH: path, KEYSTORE_ENCRYPTION_KEY: MASTER,
      RCC_BRAIN_URL: 'http://127.0.0.1/env', RCC_API_TOKEN: 'synthetic-env-token', AVIATION_EXPLAIN_PUBLIC_URL: 'https://flight-planner.example' };
    const read = providerConfigurationReader(env);
    expect(read()?.apiToken).toBe('synthetic-env-token');
    const store = new SecureKeyStore({ storePath: path, encryptionKey: MASTER });
    store.setSecret('rcc', 'request_url', 'http://127.0.0.1/canonical');
    store.setSecret('rcc', 'api_token', 'synthetic-canonical-token');
    expect(read()).toMatchObject({ brainUrl: 'http://127.0.0.1/canonical', apiToken: 'synthetic-canonical-token' });
    expect(readFileSync(path, 'utf8')).not.toContain('synthetic-canonical-token');
    store.setSecret('rcc', 'api_token', 'synthetic-updated-token');
    expect(read()?.apiToken).toBe('synthetic-updated-token');
    store.deleteSecret('rcc', 'api_token');
    expect(read()?.apiToken).toBe('synthetic-env-token');
  });
  it('does not discover workstation credentials during unit-test imports', () => {
    const read = providerConfigurationReader({ NODE_ENV: 'test', KEYSTORE_PATH: '/not-a-selected-test-store',
      KEYSTORE_ENCRYPTION_KEY: MASTER, RCC_API_TOKEN: 'synthetic-unused-token' });
    expect(read()).toBeUndefined();
  });
});
