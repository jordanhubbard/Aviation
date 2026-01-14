import express from 'express';
import cors from 'cors';
import router from './api/routes.js';
import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
import path from 'path';
import { getLastRun } from './scheduler.js';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api', router);

  // Swagger UI if spec exists
  const specPath = path.resolve(path.dirname(new URL(import.meta.url).pathname), './dist/openapi.json');
  if (fs.existsSync(specPath)) {
    const spec = JSON.parse(fs.readFileSync(specPath, 'utf-8'));
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec));
  }

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', ingest: getLastRun() });
  });
  return app;
}
