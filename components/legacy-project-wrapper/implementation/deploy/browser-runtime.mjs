import { spawn, spawnSync } from 'node:child_process';
import { dirname, delimiter, isAbsolute } from 'node:path';

export const supportedBrowserNode = version => /^v(?:22|24)\./.test(version);

// Browser workers use tested LTS runtimes. Node 26 stalled large Playwright trace
// archives in qualification; never silently run that path on an arbitrary Node.
export async function ensureBrowserRuntime() {
  if (supportedBrowserNode(process.version)) return;
  const candidates = process.env.AVIATION_E2E_NODE ? [process.env.AVIATION_E2E_NODE] : [
    'node24', 'node22', '/opt/homebrew/opt/node@24/bin/node',
    '/opt/homebrew/opt/node@22/bin/node', '/usr/local/opt/node@24/bin/node',
    '/usr/local/opt/node@22/bin/node',
  ];
  const executable = candidates.find(candidate => {
    const probe = spawnSync(candidate, ['--version'], { encoding: 'utf8', timeout: 3000 });
    return probe.status === 0 && supportedBrowserNode(probe.stdout.trim());
  });
  if (!executable) throw new Error('Browser qualification requires Node 22 or 24 LTS; set AVIATION_E2E_NODE to its executable');
  console.error(JSON.stringify({ schema: 'aviation/browser-lifecycle@1', phase: 'runtime',
    status: 'selected-lts', previous: process.version, executable }));
  const child = spawn(executable, [...process.execArgv, ...process.argv.slice(1)], {
    // Receive terminal signals through this forwarder once, rather than both
    // directly from the terminal's process group and again from the bootstrap.
    detached: process.platform !== 'win32', stdio: 'inherit', env: { ...process.env,
      PATH: isAbsolute(executable) ? dirname(executable) + delimiter + process.env.PATH : process.env.PATH },
  });
  const signals = { SIGINT: 130, SIGTERM: 143, SIGHUP: 129 };
  const handlers = Object.keys(signals).map(signal => {
    const handler = () => child.kill(signal);
    process.on(signal, handler);
    return [signal, handler];
  });
  child.once('error', error => { console.error(error.message); process.exitCode = 1; });
  child.once('close', (code, signal) => {
    for (const [name, handler] of handlers) process.removeListener(name, handler);
    process.exit(code ?? signals[signal] ?? 1);
  });
  // The delegated worker owns the complete operation; the bootstrap must never
  // proceed into the same fixtures, leases or browser assertions a second time.
  await new Promise(() => {});
}
