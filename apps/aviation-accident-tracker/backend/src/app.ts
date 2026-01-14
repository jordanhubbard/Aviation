import express from 'express';
import cors from 'cors';
import router from './api/routes.js';
import { logger } from './logger.js';
import { config } from './config.js';
import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
import path from 'path';
import { getLastRun } from './scheduler.js';

export function createApp() {
  const app = express();
  
  // Middleware
  app.use(cors());
  app.use(express.json());
  
  // Request logging
  app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`, {
      query: req.query,
      ip: req.ip
    });
    next();
  });
  
  // Health check
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      env: config.env,
      ingest: getLastRun()
    });
  });
  
  // Version endpoint
  app.get('/version', (req, res) => {
    res.json({
      version: '0.1.0',
      service: 'accident-tracker'
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
  app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('Unhandled error', err, {
      path: req.path,
      method: req.method
    });
    
    res.status(500).json({
      error: 'Internal server error',
      message: config.env === 'development' ? err.message : undefined
    });
  });
  
  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not found',
      path: req.path
    });
  });
  
  return app;
}
