import { createApp } from './app.js';
import { startScheduler } from './scheduler.js';
import { config } from './config.js';
import { EventRepository } from './db/repository.js';
import { logger } from './logger.js';
import { createServer } from 'http';
import { runRecentIngest } from './ingest/ingestService.js';

async function start() {
  try {
    // Initialize database
    logger.info('Initializing database...', { path: config.databasePath });
    const repository = new EventRepository(config.databasePath);
    await repository.initialize();
    logger.info('Database initialized');

    // Create Express app
    const app = createApp(repository);
    const port = config.port;
    const httpServer = createServer(app);

    // Start HTTP server
    httpServer.listen(port, () => {
      console.log(`✅ [accident-tracker] API listening on :${port}`);
      console.log(`   REST API: http://localhost:${port}/api`);
      console.log(`   GraphQL: http://localhost:${port}/graphql`);
      console.log(`   Health: http://localhost:${port}/health`);
    });

    // Start scheduler if enabled
    if (config.ingestion.enabled) {
      logger.info('Starting ingestion scheduler...');
      startScheduler(repository);
      runRecentIngest(repository).catch((error) => {
        logger.error('Initial ingest failed', error instanceof Error ? error : new Error(String(error)));
      });
    }

    const shutdown = async () => {
      try {
        await repository.close();
      } catch (error) {
        logger.error('Failed to close repository', error instanceof Error ? error : new Error(String(error)));
      }
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    logger.error('Failed to start server', error instanceof Error ? error : new Error(String(error)));
    process.exit(1);
  }
}

start();