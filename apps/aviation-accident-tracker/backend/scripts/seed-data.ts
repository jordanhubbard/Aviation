import fs from 'fs';
import path from 'path';
import { memoryRepo } from '../src/repo/memoryRepo.js';
import { EventRecord } from '../src/types.js';

const dataPath = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../data/seeds.json');

function loadSeeds(): EventRecord[] {
  const raw = fs.readFileSync(dataPath, 'utf-8');
  const data = JSON.parse(raw) as EventRecord[];
  return data;
}

function run() {
  const seeds = loadSeeds();
  let inserted = 0;
  let updated = 0;
  for (const ev of seeds) {
    const pre = memoryRepo.list({}).data.find((r) => r.registration === ev.registration && r.dateZ === ev.dateZ);
    memoryRepo.upsert(ev);
    if (pre) updated += 1;
    else inserted += 1;
  }
  console.log(`[seed] loaded ${seeds.length} events; inserted=${inserted} updated=${updated}`);
}

run();
