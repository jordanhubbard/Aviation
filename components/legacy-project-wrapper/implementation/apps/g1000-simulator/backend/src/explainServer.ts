/**
 * explainServer.ts — Lightweight HTTP companion for G1000 Simulator.
 *
 * Exposes POST /api/explain so the G1000 UI can ask the RCC brain to
 * explain flight-deck decisions (e.g. "Why did the autopilot disengage?").
 *
 * Runs on G1000_EXPLAIN_PORT (default 9011), separate from the WS port (9010).
 */

import express from 'express';
import cors from 'cors';
import { createExplanationRuntime } from '@aviation/ai-explainer';

export function startExplainServer(port = 9011): void {
  const app = express();
  app.use(cors());
  const explanation = createExplanationRuntime('g1000-simulator');
  app.use(explanation.middleware);
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'g1000-simulator-explain' });
  });

  const server = app.listen(port, () => {
    console.log(`G1000 explain HTTP server listening on port ${port}`);
  });
  server.once('close', () => explanation.close());
}
