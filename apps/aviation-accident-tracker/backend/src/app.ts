import express from 'express';
import cors from 'cors';
import router from './api/routes.js';
import { logger } from './logger.js';
import { config } from './config.js';
import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';

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
      env: config.env
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
  
  // Swagger/OpenAPI documentation
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const openapiPath = path.join(__dirname, 'openapi.yaml');
    
    if (fs.existsSync(openapiPath)) {
      const openapiContent = fs.readFileSync(openapiPath, 'utf-8');
      const openapiSpec = yaml.parse(openapiContent);
      
      app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec, {
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: 'Aviation Accident Tracker API Docs'
      }));
      
      // Also serve raw spec
      app.get('/openapi.yaml', (req, res) => {
        res.type('application/x-yaml').send(openapiContent);
      });
      
      app.get('/openapi.json', (req, res) => {
        res.json(openapiSpec);
      });
      
      logger.info('OpenAPI documentation available at /docs');
    } else {
      logger.warn('OpenAPI spec not found at ' + openapiPath);
    }
  } catch (error) {
    logger.error('Failed to load OpenAPI spec', error as Error);
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
