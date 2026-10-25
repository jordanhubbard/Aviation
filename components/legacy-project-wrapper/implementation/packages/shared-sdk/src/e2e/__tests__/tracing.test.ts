import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { traceE2EBrowser } from '../tracing.js';

describe('remote E2E trace capture', () => {
  it('records and closes a context created through newPage', async () => {
    const root = mkdtempSync(join(tmpdir(), 'aviation-e2e-trace-'));
    const events: string[] = [];
    const context = {
      tracing: {
        start: async () => { events.push('start'); },
        stop: async ({ path }: { path: string }) => { writeFileSync(path, 'trace'); events.push('stop'); },
      },
      newPage: async () => ({ title: 'sample' }),
      close: async () => { events.push('close-context'); },
    };
    const browser = {
      newContext: async () => context,
      close: async () => { events.push('close-browser'); },
    };
    try {
      const traced = traceE2EBrowser(browser, 'flight-planner', root);
      expect(await traced.newPage()).toEqual({ title: 'sample' });
      await traced.close();
      expect(events).toEqual(['start', 'stop', 'close-context', 'close-browser']);
      const directory = join(root, readdirSync(root)[0]);
      expect(readFileSync(join(directory, 'context-1.zip'), 'utf8')).toBe('trace');
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
