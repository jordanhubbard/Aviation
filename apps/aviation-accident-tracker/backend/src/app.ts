import express from 'express';
import cors from 'cors';
import router from './api/routes.js';
import { logger } from './logger.js';
import { config } from './config.js';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './api/swagger.js';
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
  
  /**
   * @swagger
   * /health:
   *   get:
   *     summary: Health check
   *     description: Check service health and get last ingestion run info
   *     tags: [Health]
   *     responses:
   *       200:
   *         description: Service health status
   *         content:
   *           application/json:
   *             schema:
   *               allOf:
   *                 - $ref: '#/components/schemas/Health'
   *                 - type: object
   *                   properties:
   *                     env:
   *                       type: string
   *                       example: 'development'
   *                     ingest:
   *                       type: object
   *                       nullable: true
   *                       properties:
   *                         lastRun:
   *                           type: string
   *                           format: date-time
   *                         eventsIngested:
   *                           type: integer
   */
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      env: config.env,
      ingest: getLastRun()
    });
  });
  
  /**
   * @swagger
   * /version:
   *   get:
   *     summary: Get service version
   *     description: Retrieve the service version and name
   *     tags: [Health]
   *     responses:
   *       200:
   *         description: Service version information
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 version:
   *                   type: string
   *                   example: '0.1.0'
   *                 service:
   *                   type: string
   *                   example: 'accident-tracker'
   */
  app.get('/version', (req, res) => {
    res.json({
      version: '0.1.0',
      service: 'accident-tracker'
    });
  });
  
  // API routes
  app.use('/api', router);
  
  // Swagger UI for API documentation
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Aviation Accident Tracker API Documentation',
  }));
  
  // OpenAPI spec JSON
  app.get('/openapi.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
  
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
