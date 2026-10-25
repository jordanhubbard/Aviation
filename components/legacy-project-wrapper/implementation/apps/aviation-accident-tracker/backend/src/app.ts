import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import { createRouter, createE2ERouter } from './api/routes.js';
import { getLastRun } from './scheduler.js';
import { logger } from './logger.js';
import { config } from './config.js';
import { EventRepository } from './db/repository.js';
import { ExplainerClient, explainerRoute } from '@aviation/ai-explainer';
import { AccidentE2EManager } from './e2e/manager.js';

const SERVICE_VERSION = '0.1.0';

export function createApp(repository: EventRepository, e2e?: AccidentE2EManager) {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Request logging
  app.use((req, _res, next) => {
    logger.info(`${req.method} ${req.path}`, { query: req.query, ip: req.ip });
    next();
  });

  // Test credentials must never fall through to production GraphQL or AI routes.
  app.use((req, res, next) => {
    const hasTestHeaders = Object.keys(req.headers).some(header => header.startsWith('x-aviation-test-'));
    const testApi = req.path.startsWith('/api/') || req.path.startsWith('/__e2e/');
    const staticPage = req.method === 'GET' && (req.path === '/' || req.path.startsWith('/assets/'));
    if (hasTestHeaders && !testApi && !staticPage) return res.status(403).json({ error: 'E2E route not supported' });
    return next();
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

  // AI decision explanation endpoint
  const explainer = new ExplainerClient({
    brainUrl: process.env['RCC_BRAIN_URL'] ?? 'http://146.190.134.110:8789/api/brain/request',
  });
  app.use(/* @ts-ignore Express 5 Router type issue */ explainerRoute(explainer) as any);

  // API routes
  app.use('/api', createRouter(repository, e2e));
  if (e2e) app.use('/__e2e', createE2ERouter(e2e));

  const frontendDistPath = path.resolve(process.cwd(), '..', 'frontend', 'dist');
  const frontendIndexPath = path.join(frontendDistPath, 'index.html');

  if (fs.existsSync(frontendIndexPath)) {
    app.use(express.static(frontendDistPath));

    // Express 5 (path-to-regexp v8) requires a named wildcard; bare '*' throws.
    // '/{*splat}' keeps the Express 4 behaviour of also matching '/'.
    app.get('/{*splat}', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      res.sendFile(frontendIndexPath);
    });
  }

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
