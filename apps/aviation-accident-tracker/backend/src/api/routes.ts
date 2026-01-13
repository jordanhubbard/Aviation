import express from 'express';
import { memoryRepo } from '../repo/memoryRepo.js';
import { ListEventsParams } from '../types.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

router.get('/version', (_req, res) => {
  res.json({ version: '0.1.0' });
});

router.get('/events', (req, res) => {
  const params: ListEventsParams = {
    from: req.query.from as string | undefined,
    to: req.query.to as string | undefined,
    category: (req.query.category as any) || 'all',
    airport: req.query.airport as string | undefined,
    country: req.query.country as string | undefined,
    region: req.query.region as string | undefined,
    search: req.query.search as string | undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    offset: req.query.offset ? Number(req.query.offset) : undefined,
  };
  const result = memoryRepo.list(params);
  res.json(result);
});

router.get('/events/:id', (req, res) => {
  const item = memoryRepo.get(req.params.id);
  if (!item) return res.status(404).json({ error: 'not_found' });
  res.json(item);
});

router.post('/ingest/run', (_req, res) => {
  // Placeholder ingestion: seed a sample record so UI has data.
  const now = new Date().toISOString();
  const sample = {
    id: uuidv4(),
    dateZ: now,
    registration: 'N123AB',
    aircraftType: 'B738',
    operator: 'Sample Air',
    category: 'commercial' as const,
    country: 'US',
    summary: 'Sample seeded event (placeholder)',
    narrative: 'This is placeholder data; real ingestion will populate actual records.',
    sources: [
      {
        sourceName: 'seed',
        url: 'https://example.com',
        fetchedAt: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
  memoryRepo.upsert(sample);
  res.json({ status: 'queued', seeded: true });
});

export default router;
