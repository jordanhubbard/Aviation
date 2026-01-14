import express from 'express';
import { memoryRepo } from '../repo/memoryRepo.js';
import { ListEventsParams } from '../types.js';
import { runRecentIngest } from '../ingest/ingestService.js';
import { searchAirports } from '../geo/airportLookup.js';
import airportsData from '../data/airports.json' assert { type: 'json' };

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
  runRecentIngest()
    .then((result) => res.json({ status: 'ok', result }))
    .catch((err) => {
      console.error('[ingest] failed', err);
      res.status(500).json({ error: 'ingest_failed' });
    });
});

router.get('/airports', (req, res) => {
  const q = (req.query.search as string | undefined)?.trim() || '';
  if (!q) return res.json([]);
  const results = searchAirports(q, 20);
  res.json(results);
});

router.get('/filters/options', (_req, res) => {
  const countries = Array.from(new Set((airportsData as any[]).map((a) => a.country).filter(Boolean))).sort();
  const regions = Array.from(new Set((airportsData as any[]).map((a) => a.region).filter(Boolean))).sort();
  res.json({ countries, regions });
});

export default router;
