import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import router from './api/routes.js';
import { getLastRun } from './scheduler.js';
import { logger } from './logger.js';
import { config } from './config.js';

const SERVICE_VERSION = '0.1.0';

export function createApp() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Request logging
  app.use((req, _res, next) => {
    logger.info(`${req.method} ${req.path}`, { query: req.query, ip: req.ip });
    next();
  });

  // Health check (include scheduler last run)
  app.get('/health', (_req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      env: config.env,
       ingestSchedule: config.ingestion.cron,
       ingestEnabled: config.ingestion.enabled,
      ingest: getLastRun(),
    });
  });

  // Version endpoint
  app.get('/version', (_req, res) => {
    res.json({
      version: SERVICE_VERSION,
      service: 'accident-tracker',
    });
  });

  // API routes
  app.use('/api', router);

  // Swagger UI if spec exists
  const specPath = path.resolve(path.dirname(new URL(import.meta.url).pathname), './dist/openapi.json');
  if (fs.existsSync(specPath)) {
    const spec = JSON.parse(fs.readFileSync(specPath, 'utf-8'));
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec));
  }

  // Error handler
  app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error('Unhandled error', err, {
      path: req.path,
      method: req.method,
    });

    res.status(500).json({
      error: 'Internal server error',
      message: config.env === 'development' ? err.message : undefined,
    });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not found',
      path: req.path,
    });
  });

  return app;
}
