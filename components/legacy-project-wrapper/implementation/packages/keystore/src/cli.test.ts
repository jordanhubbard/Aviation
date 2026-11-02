import { execFileSync, spawn, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';

const tempDirs: string[] = [];
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const cli = path.join(repoRoot, 'scripts', 'keystore-cli.ts');
const tsNode = path.join(repoRoot, 'node_modules', '.bin', 'ts-node');

function createEnvironment(): NodeJS.ProcessEnv {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aviation-keystore-cli-'));
  tempDirs.push(tempDir);
  return {
    ...process.env,
    KEYSTORE_PATH: path.join(tempDir, '.keystore'),
    KEYSTORE_ENCRYPTION_KEY: 'cli-test-key',
  };
}

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('keystore CLI', () => {
  it('initializes an empty encrypted store', () => {
    const env = createEnvironment();
    const result = execFileSync(tsNode, [cli, 'init'], { env, encoding: 'utf8' });
    expect(result).toContain('Keystore initialized');
    expect(fs.existsSync(env.KEYSTORE_PATH!)).toBe(true);
  });

  it('sets, gets, lists, and deletes secrets', () => {
    const env = createEnvironment();

    execFileSync(tsNode, [cli, 'set', 'weather', 'API_KEY', 'not-a-real-secret'], { env });
    expect(execFileSync(tsNode, [cli, 'get', 'weather', 'API_KEY'], { env, encoding: 'utf8' }))
      .toContain('not-a-real-secret');
    expect(execFileSync(tsNode, [cli, 'list', 'weather'], { env, encoding: 'utf8' }))
      .toContain('API_KEY');
    expect(execFileSync(tsNode, [cli, 'services'], { env, encoding: 'utf8' }))
      .toContain('weather (1 secrets)');
    execFileSync(tsNode, [cli, 'delete', 'weather', 'API_KEY'], { env });

    const missing = spawnSync(tsNode, [cli, 'get', 'weather', 'API_KEY'], {
      env,
      encoding: 'utf8',
    });
    expect(missing.status).toBe(1);
    expect(missing.stdout).toContain('Secret not found');
  }, 15000);
});


// Exercise the distributed JavaScript artifact, not a TypeScript development runner.
const bridge = path.join(repoRoot, 'packages/keystore/dist/bridge.js');
function bridgeCall(env: NodeJS.ProcessEnv, request: object) {
  return spawnSync(process.execPath, [bridge], { env, input: JSON.stringify({
    schema: 'aviation/keystore-request@1', ...request,
  }), encoding: 'utf8' });
}

describe('compiled keystore bridge', () => {
  it('round trips exact secret text through stdin without npm or ts-node', () => {
    const env = createEnvironment();
    const value = '  synthetic\nsecret 🔐  ';
    expect(bridgeCall(env, { operation: 'set', service: 'weather', key: 'API_KEY', value }).status).toBe(0);
    expect(fs.readFileSync(env.KEYSTORE_PATH!, 'utf8')).not.toContain(value);
    const got = JSON.parse(bridgeCall(env, { operation: 'get', service: 'weather', key: 'API_KEY' }).stdout);
    expect(got).toMatchObject({ schema: 'aviation/keystore-response@1', ok: true, operation: 'get', data: { value } });
    expect(JSON.parse(bridgeCall(env, { operation: 'entries' }).stdout).data.entries[0]).not.toHaveProperty('value');
    expect(JSON.parse(bridgeCall(env, { operation: 'delete', service: 'weather', key: 'API_KEY' }).stdout).data.deleted).toBe(true);
    expect(JSON.parse(bridgeCall(env, { operation: 'get', service: 'weather', key: 'API_KEY' }).stdout).data.value).toBeNull();
  });

  it('preserves concurrent process writes and never exposes a partial file to readers', async () => {
    const env = createEnvironment();
    expect(bridgeCall(env, { operation: 'set', service: 'weather', key: 'BASE', value: 'stable-fixture' }).status).toBe(0);
    const asyncCall = (request: object) => new Promise<any>((resolve, reject) => {
      const child = spawn(process.execPath, [bridge], { env, stdio: ['pipe', 'pipe', 'pipe'] });
      let stdout = '';
      child.stdout.on('data', chunk => { stdout += chunk; });
      child.once('error', reject);
      child.once('close', code => code === 0 ? resolve(JSON.parse(stdout)) : reject(new Error('Bridge process failed')));
      child.stdin.end(JSON.stringify({ schema: 'aviation/keystore-request@1', ...request }));
    });
    const writes = Array.from({ length: 6 }, (_, index) => asyncCall({ operation: 'set', service: 'weather',
      key: `KEY_${index}`, value: `fixture-${index}` }));
    const reads = Array.from({ length: 6 }, () => asyncCall({ operation: 'get', service: 'weather', key: 'BASE' }));
    const results = await Promise.all([...writes, ...reads]);
    expect(results.slice(6).map(result => result.data.value)).toEqual(Array(6).fill('stable-fixture'));
    expect(JSON.parse(bridgeCall(env, { operation: 'keys', service: 'weather' }).stdout).data.keys)
      .toEqual(['BASE', 'KEY_0', 'KEY_1', 'KEY_2', 'KEY_3', 'KEY_4', 'KEY_5']);
  }, 15000);

  it('rejects invalid or excessive requests before creating a store', () => {
    const env = createEnvironment();
    for (const request of [{ operation: 'set', service: 'weather', key: 'API_KEY', value: '' },
      { operation: 'set', service: '../escape', key: 'API_KEY', value: 'synthetic' },
      { operation: 'set', service: 'weather', key: 'API_KEY', value: 'x'.repeat(65537) },
      { operation: 'constructor' }]) {
      const result = bridgeCall(env, request);
      expect(result.status).toBe(1);
      expect(JSON.parse(result.stdout)).toMatchObject({ ok: false });
      expect(fs.existsSync(env.KEYSTORE_PATH!)).toBe(false);
    }
  });

  it('reports failed decryption without destroying the file or echoing secrets', () => {
    const env = createEnvironment();
    expect(bridgeCall(env, { operation: 'set', service: 'weather', key: 'API_KEY', value: 'original-private-fixture' }).status).toBe(0);
    const original = fs.readFileSync(env.KEYSTORE_PATH!);
    const result = bridgeCall({ ...env, KEYSTORE_ENCRYPTION_KEY: 'wrong' },
      { operation: 'set', service: 'weather', key: 'API_KEY', value: 'replacement-private-fixture' });
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).not.toMatch(/original-private-fixture|replacement-private-fixture/);
    expect(fs.readFileSync(env.KEYSTORE_PATH!)).toEqual(original);
  });
});
