import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import sqlite3 from 'sqlite3';
import { withE2ERun, seedRemoteFixture, signE2EHeaders, createE2ERunId,
  standardE2EFixtures } from '@aviation/shared-sdk/e2e';
import { createApp } from '../src/app.js';
import { EventRepository } from '../src/db/repository.js';
import { AccidentE2EManager } from '../src/e2e/manager.js';

const secret = 'accident-e2e-test-secret-at-least-32-characters';
const resources: Array<() => Promise<void>> = [];
afterEach(async () => { for (const close of resources.splice(0).reverse()) await close(); });

async function dbRow(path: string): Promise<{ is_test_data: number; test_run_id: string; run_tag: number;
  source_tag: number; source_run_id: string }> {
  const database = new sqlite3.Database(path);
  try {
    return await new Promise((resolve, reject) => database.get(
      `SELECT events.is_test_data, events.test_run_id,
       (SELECT is_test_data FROM e2e_runs WHERE run_id = events.test_run_id) AS run_tag,
       (SELECT is_test_data FROM sources WHERE event_id = events.id) AS source_tag,
       (SELECT test_run_id FROM sources WHERE event_id = events.id) AS source_run_id
       FROM events LIMIT 1`, (error, row) => error ? reject(error) : resolve(row as any)));
  } finally { await new Promise<void>((resolve, reject) => database.close(error => error ? reject(error) : resolve())); }
}

describe('Accident Tracker remote E2E isolation', () => {
  it('serves tagged fixtures from a separate database and deletes them after an assertion failure', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'aviation-e2e-'));
    resources.push(() => rm(directory, { recursive: true, force: true }));
    const production = new EventRepository(':memory:');
    await production.initialize();
    resources.push(() => production.close());
    await production.upsertEvent({ dateZ: '2026-10-01T00:00:00Z', registration: 'NPROD1',
      category: 'general' });
    const manager = new AccidentE2EManager(secret, directory);
    const server: Server = await new Promise(resolve => {
      const listening = createApp(production, manager).listen(0, '127.0.0.1', () => resolve(listening));
    });
    resources.push(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No test port');
    const baseUrl = `http://127.0.0.1:${address.port}`;
    let testRunId = '';
    await expect(withE2ERun(secret, async run => {
      testRunId = run.id;
      const value = standardE2EFixtures(run.id).accident;
      await seedRemoteFixture(run, { appId: 'aviation-accident-tracker', baseUrl, fetch }, 'accident', value);
      const testResponse = await fetch(`${baseUrl}/api/events`, { headers: run.headersFor('aviation-accident-tracker') });
      expect(testResponse.status).toBe(200);
      const testEvents = await testResponse.json() as { data: Array<{ id: string; registration: string }> };
      expect(testEvents.data.map(event => event.registration)).toEqual(['N123ET']);
      const detail = await fetch(`${baseUrl}/api/events/${testEvents.data[0].id}`,
        { headers: run.headersFor('aviation-accident-tracker') });
      expect((await detail.json() as { sources: Array<{ sourceName: string }> }).sources[0].sourceName)
        .toBe('e2e-fixture');
      const row = await dbRow(join(directory, `${run.id}.db`));
      expect(row).toEqual({ is_test_data: 1, test_run_id: run.id, run_tag: 1,
        source_tag: 1, source_run_id: run.id });
      const prodEvents = await production.listEvents({});
      expect(prodEvents.events.map(event => event.registration)).toEqual(['NPROD1']);
      const invalid = await fetch(`${baseUrl}/api/events`, {
        headers: signE2EHeaders('aviation-chat', run.id, secret),
      });
      expect(invalid.status).toBe(403);
      const sideEffect = await fetch(`${baseUrl}/api/mac/report`, {
        method: 'POST', headers: { ...run.headersFor('aviation-accident-tracker'),
          'content-type': 'application/json' }, body: JSON.stringify({ source: 'frontend', message: 'test' }),
      });
      expect(sideEffect.status).toBe(403);
      throw new Error('deliberate browser failure');
    })).rejects.toThrow('E2E run or cleanup failed');
    const residual = await fetch(`${baseUrl}/__e2e/runs/${testRunId}`, {
      headers: signE2EHeaders('aviation-accident-tracker', testRunId as any, secret),
    });
    expect((await residual.json() as { count: number }).count).toBe(0);
    expect((await production.listEvents({})).events.map(event => event.registration)).toEqual(['NPROD1']);
  });

  it('rejects a fixture tagged for another run', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'aviation-e2e-'));
    resources.push(() => rm(directory, { recursive: true, force: true }));
    const manager = new AccidentE2EManager(secret, directory);
    const runId = createE2ERunId();
    await expect(manager.seed(runId, 'accident', {
      dateZ: '2026-10-02T00:00:00Z', registration: 'NTEST1',
      is_test_data: true, test_run_id: createE2ERunId(),
    })).rejects.toThrow('not tagged for this E2E run');
    expect(await manager.count(runId)).toBe(0);
  });
});
