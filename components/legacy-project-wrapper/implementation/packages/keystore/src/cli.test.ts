import { execFileSync, spawnSync } from 'child_process';
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
