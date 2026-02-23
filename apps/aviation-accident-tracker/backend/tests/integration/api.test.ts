// apps/aviation-accident-tracker/backend/tests/integration/api.test.ts

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { EventRepository } from '../../src/db/repository.js';
import { seedDatabase } from '../../seed/seed.js';

describe('API Integration Tests', () => {
  let app: any;
  let repository: EventRepository;

  beforeAll(async () => {
    // Set up test database
    process.env.DATABASE_PATH = ':memory:';
    
    app = createApp();
    repository = new EventRepository();
    await repository.initialize();
    
    // Seed test data
    await seedDatabase();
  });

  afterAll(async () => {
    await repository.close();
  });

  describe('GET /api/events', () => {
    test('returns paginated events', async () => {
      const response = await request(app)
        .get('/api/events')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body).toHaveProperty('events');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page', 1);
      expect(response.body).toHaveProperty('limit', 10);
      expect(Array.isArray(response.body.events)).toBe(true);
      expect(response.body.events.length).toBeLessThanOrEqual(10);
    });

    test('supports sorting by date', async () => {
      const response = await request(app)
        .get('/api/events')
        .query({ sort: 'date_time', order: 'desc', limit: 5 })
        .expect(200);

      const dates = response.body.events.map((e: any) => 
        new Date(e.date_time).getTime()
      );
      
      // Check descending order
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i]).toBeLessThanOrEqual(dates[i - 1]);
      }
    });

    test('filters by category', async () => {
      const response = await request(app)
        .get('/api/events')
        .query({ category: 'Commercial' })
        .expect(200);

      response.body.events.forEach((event: any) => {
        expect(event.category).toBe('Commercial');
      });
    });

    test('filters by date range', async () => {
      const dateFrom = '2025-01-01';
      const dateTo = '2025-12-31';

      const response = await request(app)
        .get('/api/events')
        .query({ dateFrom, dateTo })
        .expect(200);

      response.body.events.forEach((event: any) => {
        const eventDate = new Date(event.date_time);
        expect(eventDate.getTime()).toBeGreaterThanOrEqual(
          new Date(dateFrom).getTime()
        );
        expect(eventDate.getTime()).toBeLessThanOrEqual(
          new Date(dateTo).getTime()
        );
      });
    });
  });

  describe('GET /api/events/:id', () => {
    test('returns event by ID', async () => {
      // Get first event
      const listResponse = await request(app)
        .get('/api/events')
        .query({ limit: 1 });

      const eventId = listResponse.body.events[0].id;

      const response = await request(app)
        .get(`/api/events/${eventId}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', eventId);
      expect(response.body).toHaveProperty('aircraft_type');
      expect(response.body).toHaveProperty('location');
    });

    test('returns 404 for non-existent event', async () => {
      await request(app)
        .get('/api/events/99999')
        .expect(404);
    });

    test('returns 400 for invalid ID', async () => {
      await request(app)
        .get('/api/events/invalid')
        .expect(400);
    });
  });

  describe('POST /api/ingest/run', () => {
    test('requires authentication', async () => {
      await request(app)
        .post('/api/ingest/run')
        .expect(401);
    });

    test('triggers ingestion with valid token', async () => {
      const response = await request(app)
        .post('/api/ingest/run')
        .set('Authorization', 'Bearer dev-token')
        .send({ daysBack: 7 })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('eventsIngested');
    });
  });

  describe('GET /health', () => {
    test('returns health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /version', () => {
    test('returns version info', async () => {
      const response = await request(app)
        .get('/version')
        .expect(200);

      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('name', 'aviation-accident-tracker');
    });
  });
});
