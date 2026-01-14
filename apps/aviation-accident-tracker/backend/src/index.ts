import { createApp } from './app.js';
<<<<<<< HEAD
import { config } from './config.js';
import { logger } from './logger.js';
import { EventRepository } from './db/repository.js';
=======
import { startScheduler } from './scheduler.js';
>>>>>>> 2d3ab0e (chore(accident-tracker): scheduler, openapi script, fuzzy dedup, api tests)

async function start() {
  try {
    // Initialize database
    logger.info('Initializing database...', { path: config.databasePath });
    const repo = new EventRepository(config.databasePath);
    await repo.initialize();
    await repo.close();
    logger.info('Database initialized');

<<<<<<< HEAD
    // Start server
    const app = createApp();
    app.listen(config.port, () => {
      logger.info(`Server started`, {
        port: config.port,
        env: config.env,
        logLevel: config.logLevel
      });
    });
  } catch (error) {
    logger.error('Failed to start server', error as Error);
    process.exit(1);
  }
}

start();
=======
app.listen(port, () => {
  console.log(`[accident-tracker] API listening on :${port}`);
});

if (process.env.ENABLE_CRON !== 'false') {
  startScheduler();
}
>>>>>>> 2d3ab0e (chore(accident-tracker): scheduler, openapi script, fuzzy dedup, api tests)
