import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const owned: ChildProcess[] = [];
afterEach(async () => {
  for (const child of owned.splice(0)) {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
    await new Promise<void>(resolve => {
      if (child.exitCode !== null || child.signalCode !== null) return resolve();
      const timer = setTimeout(() => child.kill('SIGKILL'), 3000);
      child.once('exit', () => { clearTimeout(timer); resolve(); });
    });
  }
});
function launch(command: string[]) {
  const entry = fileURLToPath(new URL('../dist/run.js', import.meta.url));
  const environment = { ...process.env, NODE_ENV: 'test' };
  delete environment.AVIATION_E2E_RUN_ID; delete environment.AVIATION_E2E_SECRET;
  const child = spawn(process.execPath, [entry, '--app', 'flight-planner', '--', ...command], {
    env: environment, stdio: ['ignore', 'pipe', 'pipe'],
  });
  owned.push(child);
  let output = ''; let errors = '';
  child.stdout!.on('data', data => { output += data; });
  child.stderr!.on('data', data => { errors += data; });
  const closed = new Promise<number | null>(resolve => child.once('exit', code => resolve(code)));
  const ready = async () => {
    for (let attempt = 0; attempt < 150; attempt++) {
      const line = output.split('\n').find(value => value.startsWith('{"schema":"aviation/explanation-broker-ready@1"'));
      if (line) return JSON.parse(line) as { url: string; app_id: string };
      if (child.exitCode !== null) throw new Error(errors || 'Supervisor exited before readiness');
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    throw new Error('Supervisor did not report readiness');
  };
  return { child, closed, ready, output: () => output };
}
describe('shared broker application launcher', () => {
  it('passes its owned loopback address to the backend and shuts both down', async () => {
    const childCode = `console.log('backend-broker=' + process.env.AVIATION_EXPLAIN_BROKER_URL); process.on('SIGTERM',()=>process.exit(0)); setInterval(()=>{},1000);`;
    const handle = launch([process.execPath, '-e', childCode]);
    const ready = await handle.ready();
    expect(ready.app_id).toBe('flight-planner');
    expect(new URL(ready.url).hostname).toBe('127.0.0.1');
    expect(await (await fetch(ready.url + '/api/explain/config')).json()).toEqual({ available: false });
    for (let attempt = 0; attempt < 100 && !handle.output().includes('backend-broker='); attempt++) await new Promise(resolve => setTimeout(resolve, 10));
    expect(handle.output()).toContain('backend-broker=' + ready.url);
    handle.child.kill('SIGTERM'); expect(await handle.closed).toBe(0);
    await expect(fetch(ready.url + '/api/explain/config')).rejects.toThrow();
  });
  it('propagates an application failure and closes the broker', async () => {
    const handle = launch([process.execPath, '-e', 'process.exit(7)']);
    const ready = await handle.ready();
    expect(await handle.closed).toBe(7);
    await expect(fetch(ready.url + '/api/explain/config')).rejects.toThrow();
  });
  it('closes the broker when the application executable is missing', async () => {
    const handle = launch(['/not/an/aviation-executable']);
    const ready = await handle.ready();
    expect(await handle.closed).toBe(1);
    await expect(fetch(ready.url + '/api/explain/config')).rejects.toThrow();
  });
});
