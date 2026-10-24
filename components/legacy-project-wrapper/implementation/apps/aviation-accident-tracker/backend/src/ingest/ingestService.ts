import { memoryRepo } from '../repo/memoryRepo.js';
import { fetchRecentAsn } from './adapters/asnAdapter.js';
import { fetchRecentAvHerald } from './adapters/avHeraldAdapter.js';
import { fetchRecentNtsb } from './adapters/ntsbAdapter.js';
import { dedupe, fuzzyDedup } from './dedupe.js';
import { normalize } from './normalize.js';
import { IngestResult, NormalizedEvent } from './types.js';
import { EventRepository } from '../db/repository.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { fetchMediaArticles, mediaCitations, searchPublisherArticles } from './mediaFeeds.js';

export async function runRecentIngest(repository?: EventRepository): Promise<IngestResult> {
  const [asn, herald, ntsb, media] = await Promise.all([
    fetchRecentAsn(), fetchRecentAvHerald(), fetchRecentNtsb(), fetchMediaArticles(),
  ]);
  const raw = [...asn, ...herald, ...ntsb];

  const normalized: NormalizedEvent[] = raw.map(normalize);
  const deduped = fuzzyDedup(dedupe(normalized));
  for (const event of deduped) {
    event.sources.push(...mediaCitations(event, media));
  }

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

    // Search publisher archives for newly discovered cases and bounded backfill.
    // The cursor survives restarts; later reports are checked again after a week.
    const needingSearch = await repo.listEventsNeedingMediaSearch(24);
    for (let start = 0; start < needingSearch.length; start += 3) {
      await Promise.all(needingSearch.slice(start, start + 3).map(async event => {
        const articles = await searchPublisherArticles(event.registration.toUpperCase().trim());
        for (const source of mediaCitations(event, articles)) {
          await repo.addSource(event.id, source);
        }
        await repo.markMediaSearched(event.id);
      }));
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
