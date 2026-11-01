#!/usr/bin/env node
/** Exercise the exact deployed KMLab tree through a throwaway remote process. */
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createE2ERunId, createE2ELease, e2eHostDeadlineCommand, E2E_MAX_AGE_MS } from '@aviation/shared-sdk/e2e';

const appId = process.argv[2];
if (appId !== 'flight-track-analyzer') throw new Error(`No native E2E runtime for ${appId || '(missing app)'}`);
const host = process.env.AVIATION_E2E_SSH_HOST;
const revision = process.env.AVIATION_E2E_REVISION;
if (!host || !/^[a-zA-Z0-9_.@-]+$/.test(host) || host.startsWith('-')) throw new Error('AVIATION_E2E_SSH_HOST is required');
if (!revision || !/^[0-9a-f]{40}$/.test(revision)) throw new Error('AVIATION_E2E_REVISION is required');

const runId = createE2ERunId();
const secret = randomBytes(32).toString('hex');
const lifetimeMs = process.env.AVIATION_E2E_LIFETIME_MS === undefined ? E2E_MAX_AGE_MS : Number(process.env.AVIATION_E2E_LIFETIME_MS);
createE2ELease(appId, runId, Date.now(), lifetimeMs);
const dedicatedSsh = ['-o', 'ControlPath=none', '-o', 'ControlMaster=no', '-o', 'ControlPersist=no'];
const ssh = (...args) => {
  const result = spawnSync('ssh', [...dedicatedSsh, '-o', 'BatchMode=yes', host, ...args], {
    encoding: 'utf8', timeout: 15000,
  });
  if (result.status !== 0) throw new Error(`Remote KMLab check failed: ${(result.stderr || '').slice(0, 500)}`);
  return result.stdout.trim();
};
const freeLocalPort = () => new Promise((resolve, reject) => {
  const server = createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    server.close(() => resolve(address.port));
  });
});
const remotePort = Number(ssh('python3 -c \'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()\''));
if (!Number.isInteger(remotePort) || remotePort < 1024 || remotePort > 65535) {
  throw new Error(`Invalid remote KMLab test port: ${remotePort}`);
}
const localPort = await freeLocalPort();
const remoteCommand = `/opt/kmlab/venv/bin/python /opt/kmlab/e2e_instance.py --run-id ${runId} --revision ${revision} --port ${remotePort}`;
const lease = createE2ELease(appId, runId, Date.now(), lifetimeMs);
const deadline = e2eHostDeadlineCommand(['ssh', ...dedicatedSsh, '-T', '-o', 'BatchMode=yes', '-o', 'ExitOnForwardFailure=yes',
  '-L', `127.0.0.1:${localPort}:127.0.0.1:${remotePort}`, host, remoteCommand], lifetimeMs, 2000, lease.expires_at_ms);
const child = spawn(deadline[0], deadline.slice(1),
{ stdio: ['pipe', 'pipe', 'pipe'] });
let childExited = false;
let childExitCode;
let remoteOutput = '';
child.once('exit', code => { childExited = true; childExitCode = code; });
child.stdout.on('data', chunk => { remoteOutput = (remoteOutput + chunk.toString()).slice(-4000); });
child.stderr.on('data', chunk => { remoteOutput = (remoteOutput + chunk.toString()).slice(-4000); });
child.stdin.on('error', () => { /* an early SSH exit is reported by waitForHttp */ });
child.stdin.write(`${secret}\n`);

let failed = false;
try {
  let ready = false;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (childExited) throw new Error(`KMLab isolated process exited: ${remoteOutput}`);
    try {
      const response = await fetch(`http://127.0.0.1:${localPort}/api/health`, {
        signal: AbortSignal.timeout(1000),
      });
      if (response.status === 200) { ready = true; break; }
    } catch { /* server may still be starting */ }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  if (!ready) throw new Error(`KMLab isolated process did not become ready: ${remoteOutput}`);
  const result = await new Promise(resolve => {
    const browserRun = spawn('node', ['deploy/remote-e2e.mjs', appId], {
      cwd: fileURLToPath(new URL('..', import.meta.url)), stdio: 'inherit',
      env: { ...process.env, AVIATION_E2E_SECRET: secret,
        AVIATION_E2E_BASE_URL: `http://127.0.0.1:${localPort}` },
    });
    const timeout = setTimeout(() => browserRun.kill(), 180000);
    browserRun.once('error', error => { clearTimeout(timeout); resolve({ status: null, error }); });
    browserRun.once('close', status => { clearTimeout(timeout); resolve({ status }); });
  });
  if (result.status !== 0) throw new Error(`KMLab browser run failed (${result.status}): ${result.error || ''}`);
} catch (error) {
  failed = true;
  console.error(error);
} finally {
  child.stdin.end();
  if (!childExited) await Promise.race([
    new Promise(resolve => child.once('exit', resolve)),
    new Promise(resolve => setTimeout(resolve, 12000)),
  ]);
  if (!childExited) child.kill();
  try {
    let remaining;
    for (let attempt = 0; attempt < 10; attempt++) {
      try { remaining = ssh(`test ! -e /tmp/aviation-e2e/${runId} && printf cleared`); }
      catch { await new Promise(resolve => setTimeout(resolve, 500)); }
      if (remaining === 'cleared') break;
    }
    if (remaining !== 'cleared') throw new Error('KMLab test data remains');
    if (childExitCode !== 0) throw new Error(`KMLab isolated process exited ${childExitCode}: ${remoteOutput}`);
    console.log(`Removed isolated KMLab test data for ${runId}`);
  } catch (error) { failed = true; console.error(error); }
}
if (failed) process.exitCode = 1;
