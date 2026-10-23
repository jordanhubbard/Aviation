import { memoryRepo } from '../repo/memoryRepo.js';
import { fetchRecentAsn } from './adapters/asnAdapter.js';
import { fetchRecentAvHerald } from './adapters/avHeraldAdapter.js';
import { dedupe, fuzzyDedup } from './dedupe.js';
import { normalize } from './normalize.js';
import { IngestResult, NormalizedEvent } from './types.js';
import { EventRepository } from '../db/repository.js';
import { config } from '../config.js';
import { logger } from '../logger.js';

export async function runRecentIngest(repository?: EventRepository): Promise<IngestResult> {
  const raw = [
    ...(await fetchRecentAsn()),
    ...(await fetchRecentAvHerald()),
  ];

  const normalized: NormalizedEvent[] = raw.map(normalize);
  const deduped = fuzzyDedup(dedupe(normalized));

  const useMemoryRepo = config.env === 'test';
  let inserted = 0;
  let updated = 0;

  if (useMemoryRepo) {
    for (const ev of deduped) {
      const pre = memoryRepo.get(ev.id);
      memoryRepo.upsert(ev);
      if (pre) updated += 1;
      else inserted += 1;
    }
    return {
      inserted,
      updated,
      totalNormalized: normalized.length,
    };
  }

  const repo = repository ?? new EventRepository(config.databasePath);
  if (!repository) {
    await repo.initialize();
  }

  try {
    for (const ev of deduped) {
      const existingId = await repo.findEventId(ev.dateZ, ev.registration);
      const eventId = await repo.upsertEvent(ev);
      if (existingId) updated += 1;
      else inserted += 1;

      for (const source of ev.sources) {
        await repo.addSource(eventId, source);
      }
    }
  } catch (error) {
    logger.error('Ingest persistence failed', error instanceof Error ? error : new Error(String(error)));
    throw error;
  } finally {
    if (!repository) {
      await repo.close();
    }
  }

  return {
    inserted,
    updated,
    totalNormalized: normalized.length,
  };
}
