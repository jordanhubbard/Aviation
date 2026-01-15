import { createApp } from './app.js';
import { startScheduler } from './scheduler.js';
import { config } from './config.js';
import { EventRepository } from './db/repository.js';
import { logger } from './logger.js';
import { createServer } from 'http';

async function start() {
  try {
    // Initialize database
    logger.info('Initializing database...', { path: config.databasePath });
    const repo = new EventRepository(config.databasePath);
    await repo.initialize();
    await repo.close();
    logger.info('Database initialized');

    // Create Express app
    const app = await createApp();
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
      startScheduler();
    }
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

start();