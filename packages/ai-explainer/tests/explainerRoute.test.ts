import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { explainerRoute } from '../src/explainerRoute.js';
import type { ExplainerClient } from '../src/ExplainerClient.js';

function makeApp(explain: (ctx: string, q?: string) => Promise<string>) {
  const mockClient = { explain } as unknown as ExplainerClient;
  const app = express();
  app.use(express.json());
  app.use(explainerRoute(mockClient));
  return app;
}

describe('explainerRoute', () => {
  it('POST /api/explain returns 200 with explanation', async () => {
    const app = makeApp(async () => 'Autopilot engaged due to crosswind.');
    const res = await request(app)
      .post('/api/explain')
      .send({ context: 'AP disengaged', question: 'Why?' });
    expect(res.status).toBe(200);
    expect(res.body.explanation).toBe('Autopilot engaged due to crosswind.');
  });

  it('POST /api/explain works without question field', async () => {
    const app = makeApp(async () => 'Decision explained.');
    const res = await request(app)
      .post('/api/explain')
      .send({ context: 'Route change' });
    expect(res.status).toBe(200);
    expect(res.body.explanation).toBe('Decision explained.');
  });

  it('POST /api/explain returns 400 when context is missing', async () => {
    const app = makeApp(async () => 'should not reach');
    const res = await request(app).post('/api/explain').send({ question: 'Why?' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/context/i);
  });

  it('POST /api/explain returns 400 when context is empty string', async () => {
    const app = makeApp(async () => 'should not reach');
    const res = await request(app).post('/api/explain').send({ context: '   ' });
    expect(res.status).toBe(400);
  });

  it('POST /api/explain returns 502 when explainer throws', async () => {
    const app = makeApp(async () => { throw new Error('RCC unavailable'); });
    const res = await request(app)
      .post('/api/explain')
      .send({ context: 'some context' });
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/RCC unavailable/);
  });
});
