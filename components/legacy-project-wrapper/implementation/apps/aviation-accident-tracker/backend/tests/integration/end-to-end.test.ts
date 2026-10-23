// apps/aviation-accident-tracker/backend/tests/integration/end-to-end.test.ts

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { EventRepository } from '../../src/db/repository.js';
import { seedDatabase } from '../../seed/seed.js';


describe('End-to-End Integration Tests', () => {
  let app: any;
  let repository: EventRepository;

  beforeAll(async () => {
    process.env.DATABASE_PATH = ':memory:';
    app = createApp();
    repository = new EventRepository();
    await repository.initialize();
    await seedDatabase();
  });

  afterAll(async () => {
    await repository.close();
  });

  test('full workflow from ingestion to retrieval', async () => {
    // Trigger ingestion
    const ingestResponse = await request(app)
      .post('/api/ingest/run')
      .set('Authorization', 'Bearer dev-token')
      .send({ daysBack: 7 })
      .expect(200);

    expect(ingestResponse.body).toHaveProperty('success', true);

    // Retrieve events
    const eventsResponse = await request(app)
      .get('/api/events')
      .query({ limit: 10 })
      .expect(200);

    expect(eventsResponse.body).toHaveProperty('events');
    expect(Array.isArray(eventsResponse.body.events)).toBe(true);
    expect(eventsResponse.body.events.length).toBeGreaterThan(0);
  });
});
