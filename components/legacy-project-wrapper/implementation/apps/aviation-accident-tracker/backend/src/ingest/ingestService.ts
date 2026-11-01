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
import { fetchMediaArticles, mediaCitations, mediaCauses, searchPublisherArticles } from './mediaFeeds.js';

export async function runRecentIngest(repository?: EventRepository): Promise<IngestResult> {
  if (repository && config.env !== 'test') await repository.recordIngestStart();
  try {
    return await ingest(repository);
  } catch (error) {
    if (repository && config.env !== 'test') {
      await repository.recordIngestResult({ inserted: 0, updated: 0 }, String(error));
    }
    throw error;
  }
}

async function ingest(repository?: EventRepository): Promise<IngestResult> {
  const [asn, herald, ntsb, media] = await Promise.all([
    fetchRecentAsn(), fetchRecentAvHerald(), fetchRecentNtsb(), fetchMediaArticles(),
  ]);
  const raw = [...asn, ...herald, ...ntsb];

  const normalized: NormalizedEvent[] = raw.map(normalize);
  const deduped = fuzzyDedup(dedupe(normalized));
  for (const event of deduped) {
    const citations = mediaCitations(event, media);
    event.sources.push(...citations);
    event.causes.push(...mediaCauses(citations, media));
  }

  const useMemoryRepo = config.env === 'test' && !repository;
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
    await repo.recordIngestStart();
  }

  try {
    for (const ev of deduped) {
      const primarySource = ev.sources[0];
      const existingId = await repo.findEventId(ev.dateZ, ev.registration)
        ?? (primarySource ? await repo.findEventIdBySource(primarySource, ev.registration) : null)
        ?? await repo.findFuzzyEvent(ev.dateZ, ev.country, ev.aircraftType, ev.registration, primarySource);
      const eventId = await repo.upsertEvent(ev, existingId ?? undefined);
      if (existingId) updated += 1;
      else inserted += 1;

      for (const source of ev.sources) {
        await repo.addSource(eventId, source);
      }
      for (const cause of ev.causes) {
        await repo.addCause(eventId, cause);
      }
    }

    // Search publisher archives for newly discovered cases and bounded backfill.
    // The cursor survives restarts; later reports are checked again after a week.
    const needingSearch = await repo.listEventsNeedingMediaSearch(24);
    for (let start = 0; start < needingSearch.length; start += 3) {
      await Promise.all(needingSearch.slice(start, start + 3).map(async event => {
        const articles = await searchPublisherArticles(event.registration.toUpperCase().trim());
        const citations = mediaCitations(event, articles);
        for (const source of citations) {
          await repo.addSource(event.id, source);
        }
        for (const cause of mediaCauses(citations, articles)) {
          await repo.addCause(event.id, cause);
        }
        await repo.markMediaSearched(event.id);
      }));
    }
    await repo.recordIngestResult({ inserted, updated });
  } catch (error) {
    await repo.recordIngestResult({ inserted, updated }, String(error));
    logger.error('Ingest persistence failed', error instanceof Error ? error : new Error(String(error)));
    throw error;
  } finally {
    if (!repository) {
      await repo.close();
    }
  }

  const result = {
    inserted,
    updated,
    totalNormalized: normalized.length,
  };
  return result;
}
