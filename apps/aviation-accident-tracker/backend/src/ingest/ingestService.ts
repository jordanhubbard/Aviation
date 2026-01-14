import { memoryRepo } from '../repo/memoryRepo.js';
import { fetchRecentAsn } from './adapters/asnAdapter.js';
import { fetchRecentAvHerald } from './adapters/avHeraldAdapter.js';
import { dedupe, fuzzyDedup } from './dedupe.js';
import { normalize } from './normalize.js';
import { IngestResult, NormalizedEvent } from './types.js';

export async function runRecentIngest(): Promise<IngestResult> {
  const raw = [
    ...(await fetchRecentAsn()),
    ...(await fetchRecentAvHerald()),
  ];

  const normalized: NormalizedEvent[] = raw.map(normalize);
  const deduped = fuzzyDedup(dedupe(normalized));

  let inserted = 0;
  let updated = 0;
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
