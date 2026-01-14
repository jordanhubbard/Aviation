import cron from 'node-cron';
import { IngestionOrchestrator } from './ingest/orchestrator.js';
import { config } from './config.js';
import { logger } from './logger.js';

// Configurable cron schedule (default: every 6 hours)
const SCHEDULE = process.env.INGEST_CRON || '0 */6 * * *';

// Configurable window (default: last 40 days)
const WINDOW_DAYS = process.env.INGEST_WINDOW_DAYS 
  ? parseInt(process.env.INGEST_WINDOW_DAYS, 10) 
  : 40;

// Track last run for health checks
interface IngestionRun {
  started: string;
  finished?: string;
  success: boolean;
  eventsIngested?: number;
  eventsUpdated?: number;
  errors?: number;
  errorMessage?: string;
}

let lastRun: IngestionRun | null = null;
let scheduledTask: cron.ScheduledTask | null = null;
let isRunning = false;

/**
 * Start the scheduled ingestion cron job
 */
export function startScheduler(): void {
  if (scheduledTask) {
    logger.warn('Scheduler already running');
    return;
  }

  logger.info('Starting scheduled ingestion', {
    schedule: SCHEDULE,
    windowDays: WINDOW_DAYS,
    databasePath: config.databasePath
  });

  scheduledTask = cron.schedule(SCHEDULE, async () => {
    await runScheduledIngestion();
  });

  logger.info('Scheduler started successfully');
}

/**
 * Stop the scheduled ingestion (graceful shutdown)
 */
export function stopScheduler(): void {
  if (!scheduledTask) {
    logger.warn('Scheduler not running');
    return;
  }

  logger.info('Stopping scheduler...');
  
  if (isRunning) {
    logger.warn('Ingestion currently running, waiting for completion...');
    // Note: The current run will complete, then scheduler stops
  }

  scheduledTask.stop();
  scheduledTask = null;
  
  logger.info('Scheduler stopped');
}

/**
 * Run the scheduled ingestion task
 */
async function runScheduledIngestion(): Promise<void> {
  if (isRunning) {
    logger.warn('Ingestion already running, skipping this run');
    return;
  }

  isRunning = true;
  const started = new Date().toISOString();
  
  logger.info('Starting scheduled ingestion', {
    windowDays: WINDOW_DAYS,
    timestamp: started
  });

  try {
    const orchestrator = new IngestionOrchestrator(config.databasePath);
    const results = await orchestrator.ingest(undefined, WINDOW_DAYS);

    // Calculate totals
    const eventsIngested = results.reduce((sum, r) => sum + r.eventsIngested, 0);
    const eventsUpdated = results.reduce((sum, r) => sum + r.eventsUpdated, 0);
    const errors = results.reduce((sum, r) => sum + r.errors, 0);

    const finished = new Date().toISOString();
    const duration = new Date(finished).getTime() - new Date(started).getTime();

    lastRun = {
      started,
      finished,
      success: true,
      eventsIngested,
      eventsUpdated,
      errors
    };

    logger.info('Scheduled ingestion completed successfully', {
      duration: `${(duration / 1000).toFixed(2)}s`,
      eventsIngested,
      eventsUpdated,
      errors,
      sources: results.map(r => ({ name: r.source, ingested: r.eventsIngested }))
    });

  } catch (error) {
    const finished = new Date().toISOString();
    const errorMessage = error instanceof Error ? error.message : String(error);

    lastRun = {
      started,
      finished,
      success: false,
      errorMessage
    };

    logger.error('Scheduled ingestion failed', error as Error, {
      duration: `${(new Date(finished).getTime() - new Date(started).getTime()) / 1000}s`
    });
  } finally {
    isRunning = false;
  }
}

/**
 * Get the last ingestion run status (for health checks)
 */
export function getLastRun(): IngestionRun | null {
  return lastRun;
}

/**
 * Get scheduler status
 */
export function getSchedulerStatus(): {
  enabled: boolean;
  running: boolean;
  schedule: string;
  windowDays: number;
  lastRun: IngestionRun | null;
  currentlyIngesting: boolean;
} {
  return {
    enabled: scheduledTask !== null,
    running: scheduledTask !== null && isRunning === false,
    schedule: SCHEDULE,
    windowDays: WINDOW_DAYS,
    lastRun,
    currentlyIngesting: isRunning
  };
}

/**
 * Manually trigger an ingestion (for testing or manual runs)
 */
export async function triggerManualIngestion(): Promise<void> {
  logger.info('Manual ingestion triggered');
  await runScheduledIngestion();
}

// Graceful shutdown handler
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, stopping scheduler...');
  stopScheduler();
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, stopping scheduler...');
  stopScheduler();
});
