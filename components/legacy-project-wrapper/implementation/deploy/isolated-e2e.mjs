#!/usr/bin/env node
/** Run an exact persistent-app image with a throwaway tagged store, then destroy it. */
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createE2ERunId, parseE2ERunId, createE2ELease, classifyE2ELease, e2eNamespaceDeadlineCommand, e2eHostDeadlineCommand, E2E_MAX_AGE_MS } from '@aviation/shared-sdk/e2e';

const appId = process.argv[2];
const runtimes = {
  'flight-tracker': { port: 3001 },
  'aviation-chat': { port: 31416, readyStatus: 200 },
  'aviation-accident-tracker': { port: 3002, readyStatus: 200,
    environment: runId => [`DATABASE_PATH=/tmp/aviation-e2e/${runId}/events.db`,
      'ENABLE_CRON=false', 'PORT=3002'] },
  flightschool: { port: 5000, command: `python -m scripts.seed_e2e && exec gunicorn --bind 0.0.0.0:5000 --workers 1 'app:create_app("e2e")'` },
  'flight-planner': { port: 8000, command: 'exec uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1' },
  'aviation-missions-app': { port: 3000, command: 'exec java -jar /app/aviation-missions.jar',
    environment: runId => ['ADMIN_USERNAME=E2E Admin', `ADMIN_PASSWORD=${runId}`,
      `ADMINS_FILE=/tmp/aviation-e2e/${runId}/admins.json`,
      `MISSIONS_JSON_PATH=/tmp/aviation-e2e/${runId}/missions.json`] },
};
const launch = Object.hasOwn(runtimes, appId) ? runtimes[appId] : undefined;
if (!launch) throw new Error(`No isolated E2E runtime for ${appId || '(missing app)'}`);
const image = process.env.AVIATION_E2E_IMAGE;
const revision = process.env.AVIATION_E2E_REVISION;
const sshHost = process.env.AVIATION_E2E_SSH_HOST;
if (!image || !/^[a-z0-9./:_-]+$/.test(image)) throw new Error('AVIATION_E2E_IMAGE is required');
if (sshHost && (!revision || !/^[0-9a-f]{40}$/.test(revision))) {
  throw new Error('Remote isolated E2E requires the exact Git revision');
}
if (sshHost && (!/^[a-zA-Z0-9_.@-]+$/.test(sshHost) || sshHost.startsWith('-'))) throw new Error('Invalid E2E SSH host');
const suppliedRun = process.env.AVIATION_E2E_RUN_ID;
const suppliedSecret = process.env.AVIATION_E2E_SECRET;
if (Boolean(suppliedRun) !== Boolean(suppliedSecret) || (suppliedSecret && suppliedSecret.length < 32)) {
  throw new Error('Caller-supplied E2E identity and secret must be provided together');
}
const runId = suppliedRun ? parseE2ERunId(suppliedRun) : createE2ERunId();
const secret = suppliedSecret || randomBytes(32).toString('hex');
const lifetimeMs = process.env.AVIATION_E2E_LIFETIME_MS === undefined ? E2E_MAX_AGE_MS : Number(process.env.AVIATION_E2E_LIFETIME_MS);
let lease = createE2ELease(appId, runId, Date.now(), lifetimeMs);
const hold = process.env.AVIATION_E2E_HOLD_AFTER_READY === '1';
if (hold && !suppliedRun) throw new Error('Holding a test instance requires caller-owned run credentials');
const ownerToken = randomBytes(16).toString('hex');
const name = `aviation-e2e-${appId}-${runId.slice(-12)}`;
const docker = (...args) => {
  const result = spawnSync('docker', [...(sshHost ? ['-H', `ssh://${sshHost}`] : []), ...args], {
    encoding: 'utf8', timeout: 120000,
  });
  if (result.status !== 0) throw new Error(`Docker ${args[0]} failed: ${(result.stderr || '').slice(0, 500)}`);
  return result.stdout.trim();
};
/** Labels alone do not authorize deletion: validate the complete lease, name and immutable ID. */
const sweepExpired = () => {
  const ids = docker('ps', '-a', '--no-trunc', '--filter', `label=aviation.e2e.app=${appId}`, '--format', '{{.ID}}').split('\n').filter(Boolean);
  for (const id of ids) {
    if (!/^[a-f0-9]{64}$/.test(id)) throw new Error('Unexpected E2E container identity');
    let info;
    try {
      info = JSON.parse(docker('inspect', id, '--format',
        '{"id":{{json .Id}},"name":{{json .Name}},"labels":{{json .Config.Labels}}}'));
    } catch (error) {
      if (!docker('ps', '-a', '--filter', `id=${id}`, '--format', '{{.ID}}')) continue;
      throw error;
    }
    const labels = info.labels || {};
    let candidate;
    try { candidate = JSON.parse(labels['aviation.e2e.lease']); } catch { continue; }
    if (info.id !== id || labels['aviation.e2e.app'] !== appId
      || classifyE2ELease(candidate, appId) !== 'expired'
      || labels['aviation.e2e.run'] !== candidate.test_run_id
      || info.name !== `/aviation-e2e-${appId}-${candidate.test_run_id.slice(-12)}`) continue;
    try { docker('rm', '-f', id); } catch (error) {
      if (docker('ps', '-a', '--filter', `id=${id}`, '--format', '{{.ID}}')) throw error;
    }
    console.log(JSON.stringify({ schema: 'aviation/e2e-expired-resource@1', app: appId,
      test_run_id: candidate.test_run_id, container_id: id, removed: true }));
  }
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
let containerId;
let failed = false;
try {
  const label = docker('image', 'inspect', image, '--format', '{{index .Config.Labels "org.opencontainers.image.revision"}}');
  if (revision && label !== revision) throw new Error(`Image revision ${label} does not match ${revision}`);
  sweepExpired();
  if (process.env.AVIATION_E2E_SWEEP_ONLY !== '1') {
    const imageCommand = JSON.parse(docker('image', 'inspect', image, '--format',
      '{"entrypoint":{{json .Config.Entrypoint}},"command":{{json .Config.Cmd}}}'));
    const command = [...(imageCommand.entrypoint || []),
      ...(launch.command ? ['sh', '-c', launch.command] : (imageCommand.command || []))];
    lease = createE2ELease(appId, runId, Date.now(), lifetimeMs);
    const deadline = e2eNamespaceDeadlineCommand(command, lifetimeMs, 2000, lease.expires_at_ms);
    attempted = true;
    containerId = docker('run', '--rm', '-d', '--name', name, '--label', `aviation.e2e.run=${runId}`,
      '--label', `aviation.e2e.owner=${ownerToken}`, '--label', `aviation.e2e.app=${appId}`, '--label', `aviation.e2e.lease=${JSON.stringify(lease)}`,
      '--entrypoint', deadline[0],
      '--tmpfs', '/tmp/aviation-e2e:rw,size=64m',
      '-p', `127.0.0.1::${launch.port}`,
      '-e', `AVIATION_E2E_RUN_ID=${runId}`,
      '-e', appId === 'flightschool'
        ? `AVIATION_E2E_DB=/tmp/aviation-e2e/${runId}.db`
        : `AVIATION_E2E_DATA_DIR=/tmp/aviation-e2e/${runId}`,
      '-e', `AVIATION_E2E_SECRET=${secret}`,
      ...(launch.environment?.(runId) ?? []).flatMap(value => ['-e', value]),
      image, ...deadline.slice(1));
    const published = docker('port', containerId, `${launch.port}/tcp`);
    const remotePort = Number(published.match(/^127\.0\.0\.1:(\d+)$/)?.[1]);
    if (!Number.isInteger(remotePort) || remotePort < 1 || remotePort > 65535) {
      throw new Error(`Unexpected E2E port mapping: ${published}`);
    }
    let localPort = remotePort;
    if (sshHost) {
      localPort = await freePort();
      const tunnelCommand = e2eHostDeadlineCommand(['ssh', '-N', '-o', 'BatchMode=yes', '-o', 'ControlPath=none',
        '-o', 'ControlMaster=no', '-o', 'ControlPersist=no', '-o', 'ExitOnForwardFailure=yes', '-L',
        `127.0.0.1:${localPort}:127.0.0.1:${remotePort}`, sshHost], lease.expires_at_ms - Date.now(), 2000, lease.expires_at_ms);
      tunnel = spawn(tunnelCommand[0], tunnelCommand.slice(1), { stdio: 'ignore' });
    }
    await waitForHttp(localPort);
    if (hold) {
      console.log(JSON.stringify({ schema: 'aviation/e2e-instance-ready@1', app: appId,
        test_run_id: runId, base_url: `http://127.0.0.1:${localPort}`, expires_at_ms: lease.expires_at_ms }));
      await new Promise(resolve => setTimeout(resolve, Math.max(1, lease.expires_at_ms - Date.now()) + 3000));
      throw new Error('Held E2E instance reached its lease deadline');
    }
    const result = spawnSync('node', ['deploy/remote-e2e.mjs', appId], {
      cwd: fileURLToPath(new URL('..', import.meta.url)), encoding: 'utf8', timeout: 180000,
      env: { ...process.env, AVIATION_E2E_SECRET: secret, AVIATION_E2E_RUN_ID: runId,
        AVIATION_E2E_BASE_URL: `http://127.0.0.1:${localPort}` },
    });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    if (result.status !== 0) throw new Error(`${appId} browser run failed (${result.status})`);
  }
} catch (error) {
  failed = true;
  console.error(error);
  if (attempted && containerId) {
    try {
      const log = spawnSync('docker', [...(sshHost ? ['-H', `ssh://${sshHost}`] : []),
        'logs', '--tail', '80', containerId], { encoding: 'utf8', timeout: 10000 });
      console.error(`${log.stdout || ''}${log.stderr || ''}`);
    } catch { /* Docker itself may be unavailable */ }
  }
} finally {
  if (tunnel && tunnel.exitCode === null) {
    tunnel.kill();
    const closed = await Promise.race([
      new Promise(resolve => tunnel.once('close', () => resolve(true))),
      new Promise(resolve => setTimeout(() => resolve(false), 5000)),
    ]);
    if (!closed) { failed = true; tunnel.kill('SIGKILL'); console.error('E2E tunnel did not close promptly; its independent deadline remains active'); }
  }
  if (attempted) {
    try {
      const target = docker('ps', '-a', '--no-trunc', '--filter', containerId ? `id=${containerId}` : `name=^/${name}$`, '--format', '{{.ID}}');
      if (target) {
        if (!/^[a-f0-9]{64}$/.test(target)) throw new Error('Unexpected E2E cleanup identity');
        const owner = docker('inspect', target, '--format', '{{index .Config.Labels "aviation.e2e.owner"}}');
        if (owner !== ownerToken) throw new Error(`E2E container ${name} has another controller owner`);
        docker('rm', '-f', target);
      }
      const remaining = docker('ps', '-a', '--filter', containerId ? `id=${containerId}` : `name=^/${name}$`, '--format', '{{.ID}}');
      if (remaining) throw new Error(`Isolated E2E container still exists: ${remaining}`);
      console.log(`Removed isolated ${appId} test instance and storage with container ${name}`);
    } catch (error) { failed = true; console.error(error); }
  }
}
if (failed) process.exitCode = 1;
