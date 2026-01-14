import cron from 'node-cron';
import { runRecentIngest } from './ingest/ingestService.js';
import { config } from './config.js';
import { logger } from './logger.js';

interface RunSummary {
  started: string;
  finished?: string;
  error?: string;
  inserted?: number;
  updated?: number;
}

let lastRun: RunSummary | null = null;
let started = false;

export function startScheduler() {
  if (!config.ingestion.enabled) {
    logger.info('[scheduler] disabled via ENABLE_CRON=false');
    return;
  }
  if (started) {
    logger.warn('[scheduler] already started');
    return;
  }

  if (!cron.validate(config.ingestion.cron)) {
    logger.error(`[scheduler] invalid cron expression: ${config.ingestion.cron}`);
    return;
  }

  logger.info(`[scheduler] starting cron ${config.ingestion.cron}`);
  cron.schedule(config.ingestion.cron, async () => {
    const startedAt = new Date().toISOString();
    lastRun = { started: startedAt };
    try {
      const result = await runRecentIngest();
      lastRun.finished = new Date().toISOString();
      lastRun.inserted = result.inserted;
      lastRun.updated = result.updated;
      logger.info(`[scheduler] ingest ok inserted=${result.inserted} updated=${result.updated}`);
    } catch (err: any) {
      lastRun.finished = new Date().toISOString();
      lastRun.error = String(err);
      logger.error('[scheduler] ingest failed', err);
    }
  });

  started = true;
}

export function getLastRun() {
  return lastRun;
}
