import { createApp } from './app.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { EventRepository } from './db/repository.js';
import { startScheduler } from './scheduler.js';

async function start() {
  try {
    // Initialize database
    logger.info('Initializing database...', { path: config.databasePath });
    const repo = new EventRepository(config.databasePath);
    await repo.initialize();
    await repo.close();
    logger.info('Database initialized');

    // Start server
    const app = createApp();
    app.listen(config.port, () => {
      logger.info(`Server started`, {
        port: config.port,
        env: config.env,
        logLevel: config.logLevel
      });
    });
    
    // Start scheduler if enabled
    if (process.env.ENABLE_CRON !== 'false') {
      startScheduler();
      logger.info('Scheduler started');
    }
  } catch (error) {
    logger.error('Failed to start server', error as Error);
    process.exit(1);
  }
}

start();
