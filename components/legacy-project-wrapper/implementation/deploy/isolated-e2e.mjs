#!/usr/bin/env node
/** Run an exact persistent-app image with a throwaway tagged store, then destroy it. */
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createE2ERunId } from '@aviation/shared-sdk/e2e';

const appId = process.argv[2];
const launch = {
  'aviation-chat': { port: 31416, readyStatus: 200 },
  'aviation-accident-tracker': { port: 3002, readyStatus: 200,
    environment: runId => [`DATABASE_PATH=/tmp/aviation-e2e/${runId}/events.db`,
      'ENABLE_CRON=false', 'PORT=3002'] },
  flightschool: { port: 5000, command: `python -m scripts.seed_e2e && exec gunicorn --bind 0.0.0.0:5000 --workers 1 'app:create_app("e2e")'` },
  'flight-planner': { port: 8000, command: 'exec uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1' },
  'aviation-missions-app': { port: 3000, command: 'exec java -jar /app/aviation-missions.jar' },
}[appId];
if (!launch) throw new Error(`No isolated E2E runtime for ${appId || '(missing app)'}`);
const image = process.env.AVIATION_E2E_IMAGE;
const revision = process.env.AVIATION_E2E_REVISION;
const sshHost = process.env.AVIATION_E2E_SSH_HOST;
if (!image || !/^[a-z0-9./:_-]+$/.test(image)) throw new Error('AVIATION_E2E_IMAGE is required');
if (sshHost && (!revision || !/^[0-9a-f]{40}$/.test(revision))) {
  throw new Error('Remote isolated E2E requires the exact Git revision');
}
const runId = createE2ERunId();
const secret = randomBytes(32).toString('hex');
const name = `aviation-e2e-${appId}-${runId.slice(-12)}`;
const docker = (...args) => {
  const result = spawnSync('docker', [...(sshHost ? ['-H', `ssh://${sshHost}`] : []), ...args], {
    encoding: 'utf8', timeout: 120000,
  });
  if (result.status !== 0) throw new Error(`Docker ${args[0]} failed: ${(result.stderr || '').slice(0, 500)}`);
  return result.stdout.trim();
};
const freePort = async () => {
  for (let port = 18880; port < 19000; port++) {
    const available = await new Promise(resolve => {
      const server = createServer();
      server.once('error', () => resolve(false));
      server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)));
    });
    if (available) return port;
  }
  throw new Error('No free local E2E port in 18880-18999');
};
const waitForHttp = async port => {
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`, {
        signal: AbortSignal.timeout(1000),
      });
      // The isolated instance requires signed headers. Its 403 proves the
      // application worker has booted, unlike Docker's early TCP listener.
      if (response.status === (launch.readyStatus ?? 403)) return;
    } catch { /* the image may still be seeding its database */ }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error('Isolated E2E application did not become ready');
};

let tunnel;
let attempted = false;
let failed = false;
try {
  const label = docker('image', 'inspect', image, '--format', '{{index .Config.Labels "org.opencontainers.image.revision"}}');
  if (revision && label !== revision) throw new Error(`Image revision ${label} does not match ${revision}`);
  attempted = true;
  docker('run', '-d', '--name', name, '--label', `aviation.e2e.run=${runId}`,
    '--tmpfs', '/tmp/aviation-e2e:rw,size=64m',
    '-p', `127.0.0.1::${launch.port}`,
    '-e', `AVIATION_E2E_RUN_ID=${runId}`,
    '-e', appId === 'flightschool'
      ? `AVIATION_E2E_DB=/tmp/aviation-e2e/${runId}.db`
      : `AVIATION_E2E_DATA_DIR=/tmp/aviation-e2e/${runId}`,
    '-e', `AVIATION_E2E_SECRET=${secret}`,
    ...(launch.environment?.(runId) ?? []).flatMap(value => ['-e', value]),
    image, ...(launch.command ? ['sh', '-c', launch.command] : []));
  const published = docker('port', name, `${launch.port}/tcp`);
  const remotePort = Number(published.match(/^127\.0\.0\.1:(\d+)$/)?.[1]);
  if (!Number.isInteger(remotePort) || remotePort < 1 || remotePort > 65535) {
    throw new Error(`Unexpected E2E port mapping: ${published}`);
  }
  let localPort = remotePort;
  if (sshHost) {
    localPort = await freePort();
    tunnel = spawn('ssh', ['-N', '-o', 'ExitOnForwardFailure=yes', '-L',
      `127.0.0.1:${localPort}:127.0.0.1:${remotePort}`, sshHost], { stdio: 'ignore' });
  }
  await waitForHttp(localPort);
  const result = spawnSync('node', ['deploy/remote-e2e.mjs', appId], {
    cwd: fileURLToPath(new URL('..', import.meta.url)), encoding: 'utf8', timeout: 180000,
    env: { ...process.env, AVIATION_E2E_SECRET: secret, AVIATION_E2E_RUN_ID: runId,
      AVIATION_E2E_BASE_URL: `http://127.0.0.1:${localPort}` },
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) throw new Error(`${appId} browser run failed (${result.status})`);
} catch (error) {
  failed = true;
  console.error(error);
  if (attempted) {
    try {
      const log = spawnSync('docker', [...(sshHost ? ['-H', `ssh://${sshHost}`] : []),
        'logs', '--tail', '80', name], { encoding: 'utf8', timeout: 10000 });
      console.error(`${log.stdout || ''}${log.stderr || ''}`);
    } catch { /* Docker itself may be unavailable */ }
  }
} finally {
  if (tunnel) tunnel.kill();
  if (attempted) {
    try {
      if (docker('ps', '-a', '--filter', `name=^/${name}$`, '--format', '{{.ID}}')) {
        const owner = docker('inspect', name, '--format', '{{index .Config.Labels "aviation.e2e.run"}}');
        if (owner !== runId) throw new Error(`E2E container ${name} has another owner`);
        docker('rm', '-f', name);
      }
      const remaining = docker('ps', '-a', '--filter', `name=^/${name}$`, '--format', '{{.ID}}');
      if (remaining) throw new Error(`Isolated E2E container still exists: ${remaining}`);
      console.log(`Removed isolated ${appId} test instance and storage with container ${name}`);
    } catch (error) { failed = true; console.error(error); }
  }
}
if (failed) process.exitCode = 1;
