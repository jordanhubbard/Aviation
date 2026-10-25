import { existsSync } from 'node:fs';
import { mkdir, readdir, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { assertTestDataForRun, parseE2ERunId, verifyE2EHeaders,
  type E2ERunId, type HeaderSource } from '@aviation/shared-sdk/e2e';
import { EventRepository } from '../db/repository.js';

/** Each authenticated run has its own SQLite file; production uses a different repository. */
export class AccidentE2EManager {
  private readonly repositories = new Map<E2ERunId, Promise<EventRepository>>();

  constructor(private readonly secret: string | undefined, private readonly directory: string) {}

  authenticate(headers: HeaderSource): E2ERunId | null {
    return verifyE2EHeaders('aviation-accident-tracker', headers, this.secret);
  }

  private path(runId: E2ERunId): string {
    return join(this.directory, `${parseE2ERunId(runId)}.db`);
  }

  async repository(runId: E2ERunId): Promise<EventRepository> {
    let pending = this.repositories.get(runId);
    if (!pending) {
      pending = (async () => {
        await mkdir(this.directory, { recursive: true, mode: 0o700 });
        const repository = new EventRepository(this.path(runId));
        await repository.initialize();
        return repository;
      })();
      this.repositories.set(runId, pending);
      pending.catch(() => this.repositories.delete(runId));
    }
    return pending;
  }

  async seed(runId: E2ERunId, fixtureType: string, value: unknown): Promise<{ id: string }> {
    if (fixtureType !== 'accident') throw new Error('Unsupported E2E fixture type');
    assertTestDataForRun(value, runId);
    const repository = await this.repository(runId);
    return { id: await repository.seedTestEvent(runId, value) };
  }

  async count(runId: E2ERunId): Promise<number> {
    if (!this.repositories.has(runId) && !existsSync(this.path(runId))) return 0;
    return (await this.repository(runId)).countTestEvents(runId);
  }

  async delete(runId: E2ERunId): Promise<void> {
    const pending = this.repositories.get(runId);
    this.repositories.delete(runId);
    if (pending) await (await pending).close();
    for (const suffix of ['', '-journal', '-wal', '-shm']) {
      try { await unlink(this.path(runId) + suffix); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
  }

  /** Recover test files left by a terminated runner without touching active runs. */
  async sweepExpired(maxAgeMs = 24 * 60 * 60 * 1000, now = Date.now()): Promise<number> {
    if (!existsSync(this.directory)) return 0;
    let removed = 0;
    for (const name of await readdir(this.directory)) {
      if (!/^e2e_[0-9a-f]{32}\.db$/.test(name)) continue;
      const runId = parseE2ERunId(name.slice(0, -3));
      if (this.repositories.has(runId)) continue;
      const file = this.path(runId);
      try {
        if ((await stat(file)).mtimeMs <= now - maxAgeMs) {
          await this.delete(runId);
          removed += 1;
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
    return removed;
  }
}
