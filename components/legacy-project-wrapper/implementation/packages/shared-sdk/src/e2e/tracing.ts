/** Retain browser traces on E2E failure without making application code own files. */
import { mkdirSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

interface Trace {
  start(options: { screenshots: boolean; snapshots: boolean; sources: boolean }): Promise<void>;
  stop(options?: { path: string }): Promise<void>;
}

interface BrowserContext<Page> {
  newPage(): Promise<Page>;
  close(): Promise<void>;
  tracing: Trace;
}

interface Browser<Context extends BrowserContext<Page>, Page> {
  newContext(options?: object): Promise<Context>;
  close(): Promise<void>;
}

export function traceE2EBrowser<Context extends BrowserContext<Page>, Page>(
  browser: Browser<Context, Page>, appId: string, traceRoot = join(homedir(), '.cache', 'aviation-e2e', 'traces'),
): Browser<Context, Page> & { newPage(options?: object): Promise<Page> } {
  if (!/^[a-z0-9-]+$/.test(appId)) throw new Error('Invalid E2E app ID for traces');
  const directory = join(traceRoot, `${appId}-${Date.now()}-${randomUUID().slice(0, 8)}`);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  process.once('exit', code => {
    if (code === 0) rmSync(directory, { recursive: true, force: true });
    else process.stderr.write(`Retained E2E trace: ${directory}\n`);
  });
  let nextContext = 0;
  const phase = async (name: string, action: () => Promise<void>) => {
    const started = performance.now();
    const report = (status: string) => process.stderr.write(JSON.stringify({
      schema: 'aviation/browser-lifecycle@1', appId, phase: name, status,
      elapsedMs: Math.round(performance.now() - started),
    }) + '\n');
    report('started');
    try { await action(); report('completed'); }
    catch (error) { report('failed'); throw error; }
  };
  const contexts = new Set<Context>();
  const createContext = async (options?: object): Promise<Context> => {
    const context = await browser.newContext(options);
    const number = ++nextContext;
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    const originalClose = context.close.bind(context);
    let closing: Promise<void> | undefined;
    context.close = () => closing ||= (async () => {
      try { await phase(`context-${number}.trace.stop`, () => context.tracing.stop({ path: join(directory, `context-${number}.zip`) })); }
      finally { contexts.delete(context); await phase(`context-${number}.close`, originalClose); }
    })();
    contexts.add(context);
    return context;
  };
  return {
    newContext: createContext,
    newPage: async (options?: object) => (await createContext(options)).newPage(),
    close: async () => {
      const errors: unknown[] = [];
      for (const context of [...contexts]) {
        try { await context.close(); } catch (error) { errors.push(error); }
      }
      try { await phase('browser.close', () => browser.close()); }
      catch (error) { errors.push(error); }
      if (errors.length) throw Object.assign(new Error('E2E browser cleanup failed'), { errors });
    },
  };
}
