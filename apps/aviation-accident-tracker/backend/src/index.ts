import { createApp } from './app.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { EventRepository } from './db/repository.js';
import { startScheduler, stopScheduler } from './scheduler.js';

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
    const server = app.listen(config.port, () => {
      logger.info(`Server started`, {
        port: config.port,
        env: config.env,
        logLevel: config.logLevel
      });
    });

    // Start scheduled ingestion (if enabled)
    if (process.env.ENABLE_CRON !== 'false') {
      startScheduler();
    } else {
      logger.info('Scheduled ingestion disabled (ENABLE_CRON=false)');
    }

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('Shutting down gracefully...');
      
      // Stop accepting new connections
      server.close(() => {
        logger.info('HTTP server closed');
      });

      // Stop scheduler
      stopScheduler();

      // Give ongoing operations time to complete
      setTimeout(() => {
        logger.info('Shutdown complete');
        process.exit(0);
      }, 1000);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

  } catch (error) {
    logger.error('Failed to start server', error as Error);
    process.exit(1);
  }
}

start();
