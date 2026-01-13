import express from 'express';
import cors from 'cors';
import router from './api/routes.js';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/api', router);
  return app;
}
