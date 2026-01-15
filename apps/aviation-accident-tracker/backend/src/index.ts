import { createApp } from './app.js';
import { startScheduler } from './scheduler.js';
import { config } from './config.js';

async function start() {
  try {
    // Initialize database
    logger.info('Initializing database...', { path: config.databasePath });
    const repo = new EventRepository(config.databasePath);
    await repo.initialize();
    await repo.close();
    logger.info('Database initialized');

app.listen(port, () => {
  console.log(`[accident-tracker] API listening on :${port}`);
});

if (config.ingestion.enabled) {
  startScheduler();
}
