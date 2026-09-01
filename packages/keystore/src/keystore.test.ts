import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
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
