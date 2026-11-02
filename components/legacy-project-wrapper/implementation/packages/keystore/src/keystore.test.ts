import fsMutable from 'node:fs';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SecureKeyStore } from './keystore';

const tempDirs: string[] = [];

function createStorePath(): string {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aviation-keystore-'));
  tempDirs.push(tempDir);
  return path.join(tempDir, '.keystore');
}

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('SecureKeyStore', () => {
  it('persists encrypted secrets and lists service keys', () => {
    const storePath = createStorePath();
    const store = new SecureKeyStore({ storePath, encryptionKey: 'test-key' });

    store.setSecret('weather', 'API_KEY', 'not-a-real-secret');

    const stored = fs.readFileSync(storePath, 'utf8');
    expect(stored).not.toContain('not-a-real-secret');
    expect(fs.statSync(storePath).mode & 0o777).toBe(0o600);
    expect(store.listKeys('weather')).toEqual(['API_KEY']);
    expect(store.getSecret('unknown', 'API_KEY')).toBeUndefined();
    expect(store.getSecret('weather', 'UNKNOWN')).toBeUndefined();

    const reloaded = new SecureKeyStore({ storePath, encryptionKey: 'test-key' });
    expect(reloaded.getSecret('weather', 'API_KEY')).toBe('not-a-real-secret');
  });

  it('does not expose data when the key is wrong or the payload is corrupt', () => {
    const storePath = createStorePath();
    const store = new SecureKeyStore({ storePath, encryptionKey: 'correct-key' });
    store.setSecret('weather', 'API_KEY', 'not-a-real-secret');

    const error = console.error;
    console.error = () => undefined;
    try {
      const wrongKey = new SecureKeyStore({ storePath, encryptionKey: 'wrong-key' });
      expect(wrongKey.getSecret('weather', 'API_KEY')).toBeUndefined();

      fs.writeFileSync(storePath, 'corrupt-payload');
      const corrupt = new SecureKeyStore({ storePath, encryptionKey: 'correct-key' });
      expect(corrupt.getSecret('weather', 'API_KEY')).toBeUndefined();
    } finally {
      console.error = error;
    }
  });

  it('preserves disk and memory when writes follow a failed load', () => {
    const storePath = createStorePath();
    new SecureKeyStore({ storePath, encryptionKey: 'correct-key' }).setSecret('weather', 'API_KEY', 'original');
    const original = fs.readFileSync(storePath);
    const store = new SecureKeyStore({ storePath, encryptionKey: 'wrong-key' });
    expect(() => store.setSecret('weather', 'API_KEY', 'replacement')).toThrow('could not be loaded');
    expect(() => store.deleteSecret('weather', 'API_KEY')).toThrow('could not be loaded');
    expect(store.getSecret('weather', 'API_KEY')).toBeUndefined();
    expect(fs.readFileSync(storePath)).toEqual(original);
    expect(new SecureKeyStore({ storePath, encryptionKey: 'correct-key' }).getSecret('weather', 'API_KEY')).toBe('original');
  });

  it('tags isolated entries through the SDK and rejects foreign stores', () => {
    const storePath = createStorePath();
    const run = 'e2e_' + 'a'.repeat(32);
    const store = new SecureKeyStore({ storePath, encryptionKey: 'test-key', testRunId: run });
    store.setSecret('openweather', 'api_key', 'synthetic-only');
    expect(store.listEntries()).toEqual([expect.objectContaining({ service: 'openweather', key: 'api_key',
      is_test_data: true, test_run_id: run })]);
    expect(JSON.stringify(store.listEntries())).not.toContain('synthetic-only');
    const original = fs.readFileSync(storePath);
    const normal = new SecureKeyStore({ storePath, encryptionKey: 'test-key' });
    expect(normal.getSecret('openweather', 'api_key')).toBeUndefined();
    expect(() => normal.listEntries()).toThrow('could not be loaded');
    expect(() => normal.setSecret('openweather', 'api_key', 'normal')).toThrow();
    expect(fs.readFileSync(storePath)).toEqual(original);
    const foreign = new SecureKeyStore({ storePath, encryptionKey: 'test-key', testRunId: 'e2e_' + 'b'.repeat(32) });
    expect(() => foreign.listEntries()).toThrow('could not be loaded');
    expect(() => foreign.setSecret('openweather', 'api_key', 'foreign')).toThrow();
    expect(fs.readFileSync(storePath)).toEqual(original);
  });

  it('preserves unrelated writes from older instances', () => {
    const storePath = createStorePath();
    const options = { storePath, encryptionKey: 'test-key' };
    const first = new SecureKeyStore(options), second = new SecureKeyStore(options);
    first.setSecret('weather', 'API_KEY', 'first-fixture');
    second.setSecret('stream', 'API_KEY', 'second-fixture');
    expect(new SecureKeyStore(options).listEntries().map(entry => entry.service).sort()).toEqual(['stream', 'weather']);
    first.deleteSecret('weather', 'API_KEY');
    expect(new SecureKeyStore(options).getSecret('stream', 'API_KEY')).toBe('second-fixture');
  });

  it('keeps the prior file and memory when atomic publication fails', () => {
    const storePath = createStorePath();
    const store = new SecureKeyStore({ storePath, encryptionKey: 'test-key' });
    store.setSecret('weather', 'API_KEY', 'original-fixture');
    const before = fs.readFileSync(storePath);
    const publish = vi.spyOn(fsMutable, 'renameSync').mockImplementation(() => { throw new Error('synthetic publication failure'); });
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      expect(() => store.setSecret('weather', 'API_KEY', 'replacement-fixture')).toThrow();
      expect(store.getSecret('weather', 'API_KEY')).toBe('original-fixture');
      expect(fs.readFileSync(storePath)).toEqual(before);
      expect(fs.readdirSync(path.dirname(storePath))).toEqual(['.keystore']);
      expect(log).toHaveBeenCalled();
    } finally { publish.mockRestore(); log.mockRestore(); }
  });

  it('deletes existing secrets without creating files for missing secrets', () => {
    const storePath = createStorePath();
    const store = new SecureKeyStore({ storePath, encryptionKey: 'test-key' });

    expect(store.deleteSecret('weather', 'MISSING')).toBe(false);
    expect(fs.existsSync(storePath)).toBe(false);

    store.setSecret('weather', 'API_KEY', 'not-a-real-secret');
    expect(store.deleteSecret('weather', 'API_KEY')).toBe(true);
    expect(store.getSecret('weather', 'API_KEY')).toBeUndefined();
  });
});
