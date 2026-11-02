#!/usr/bin/env node
/** Managed application entrypoint: one shared broker beside any backend worker pool. */
import { spawn, type ChildProcess } from 'node:child_process';
import { parseArgs } from 'node:util';
import { createExplanationRuntime } from './runtime.js';
import { startExplanationServer } from './server.js';

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    app: { type: 'string' }, port: { type: 'string', default: '0' },
    host: { type: 'string', default: '127.0.0.1' }, 'static-root': { type: 'string' },
  } });
  const appId = values.app ?? process.env.AVIATION_APP_ID;
  if (!appId) throw new Error('Application identity is required');
  const runtime = createExplanationRuntime(appId);
  const broker = await startExplanationServer(runtime.client, { host: values.host,
    port: Number(values.port), staticRoot: values['static-root'], middleware: runtime.middleware });
  let child: ChildProcess | undefined;
  let stopping = false;
  let finished = false;
  let escalation: ReturnType<typeof setTimeout> | undefined;
  const grouped = process.platform !== 'win32';
  const signalChild = (signal: NodeJS.Signals) => {
    if (!child?.pid) return;
    try { if (grouped) process.kill(-child.pid, signal); else child.kill(signal); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
  };
  const groupAlive = () => {
    if (!grouped || !child?.pid) return false;
    try { process.kill(-child.pid, 0); return true; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false; throw error; }
  };
  const removeSignals = () => {
    process.removeListener('SIGTERM', stop);
    process.removeListener('SIGINT', stop);
  };
  const finish = async (code: number) => {
    if (finished) return;
    finished = true;
    runtime.close(); await broker.close();
    if (groupAlive()) {
      signalChild('SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 1000));
      if (groupAlive()) signalChild('SIGKILL');
    }
    if (escalation) clearTimeout(escalation);
    removeSignals(); process.exitCode = stopping ? 0 : code;
  };
  function stop() {
    if (stopping) return;
    stopping = true;
    runtime.close();
    void broker.close();
    if (child?.pid) {
      signalChild('SIGTERM');
      escalation = setTimeout(() => signalChild('SIGKILL'), 1000);
    } else void finish(0);
  }
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
  if (positionals.length) {
    child = spawn(positionals[0], positionals.slice(1), {
      stdio: 'inherit', detached: grouped, windowsHide: true,
      env: { ...process.env, AVIATION_APP_ID: appId, AVIATION_EXPLAIN_BROKER_URL: broker.url },
    });
    child.once('error', () => { console.error('The application process could not start.'); void finish(1); });
    child.once('exit', (code, signal) => { void finish(code ?? (signal ? 1 : 0)); });
  }
  console.log(JSON.stringify({ schema: 'aviation/explanation-broker-ready@1', app_id: appId, url: broker.url }));
}

if (require.main === module) {
  main().catch(() => { console.error('The shared explanation runtime could not start.'); process.exitCode = 1; });
}
