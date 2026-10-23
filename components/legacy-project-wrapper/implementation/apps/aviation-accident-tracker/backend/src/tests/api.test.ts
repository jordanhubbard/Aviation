import request from 'supertest';
import { createApp } from '../app.js';
import { memoryRepo } from '../repo/memoryRepo.js';
import { EventRecord } from '../types.js';

const app = createApp();

const sample: EventRecord = {
  id: 'test-1',
  dateZ: '2025-12-01T00:00:00Z',
  registration: 'N123AB',
  category: 'commercial',
  sources: [],
  createdAt: '2025-12-01T00:00:00Z',
  updatedAt: '2025-12-01T00:00:00Z',
};

beforeAll(() => {
  memoryRepo.upsert(sample);
});

describe('API', () => {
  it('returns events list', async () => {
    const res = await request(app).get('/api/events?limit=10');
    expect(res.status).toBe(200);
    expect(res.body.total).toBeDefined();
  });

  it('returns event by id', async () => {
    const res = await request(app).get(`/api/events/${sample.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(sample.id);
  });

  it('returns 404 for missing event', async () => {
    const res = await request(app).get(`/api/events/not-found`);
    expect(res.status).toBe(404);
  });

  it('ingest run responds ok', async () => {
    const res = await request(app).post('/api/ingest/run');
    expect(res.status).toBe(200);
  });
});
