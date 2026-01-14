import cron from 'node-cron';
import { runRecentIngest } from './ingest/ingestService.js';

const schedule = process.env.INGEST_CRON || '0 */6 * * *'; // every 6 hours
let lastRun: { started: string; finished?: string; error?: string } | null = null;

export function startScheduler() {
  console.log(`[scheduler] starting cron ${schedule}`);
  cron.schedule(schedule, async () => {
    const started = new Date().toISOString();
    lastRun = { started };
    try {
      const result = await runRecentIngest();
      lastRun.finished = new Date().toISOString();
      console.log(`[scheduler] ingest ok inserted=${result.inserted} updated=${result.updated}`);
    } catch (err: any) {
      lastRun.finished = new Date().toISOString();
      lastRun.error = String(err);
      console.error('[scheduler] ingest failed', err);
    }
  });
}

export function getLastRun() {
  return lastRun;
}

// Start immediately if run directly
if (process.env.NODE_ENV !== 'test') {
  startScheduler();
}
