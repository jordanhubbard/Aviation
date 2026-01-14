import express from 'express';
<<<<<<< HEAD
import { EventRepository } from '../db/repository.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { IngestionOrchestrator } from '../ingest/orchestrator.js';
import type { ListEventsParams } from '../types.js';
=======
import { memoryRepo } from '../repo/memoryRepo.js';
import { ListEventsParams } from '../types.js';
import { runRecentIngest } from '../ingest/ingestService.js';
<<<<<<< HEAD
>>>>>>> 896e780 (feat(accident-tracker): add ingest scaffolding and geo lookup)
=======
import { searchAirports } from '../geo/airportLookup.js';
>>>>>>> 852e5c6 (feat(accident-tracker): cluster map, filters, modal; airport search + enriched seeds)

const router = express.Router();

// Lazy-init repository (shared across requests)
let repository: EventRepository | null = null;
let orchestrator: IngestionOrchestrator | null = null;

function getRepository(): EventRepository {
  if (!repository) {
    repository = new EventRepository(config.databasePath);
  }
  return repository;
}

function getOrchestrator(): IngestionOrchestrator {
  if (!orchestrator) {
    orchestrator = new IngestionOrchestrator(config.databasePath);
  }
  return orchestrator;
}

/**
 * GET /api/events
 * List events with filters and pagination
 */
router.get('/events', async (req, res, next) => {
  try {
    const params: ListEventsParams = {
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      category: (req.query.category as any) || 'all',
      airport: req.query.airport as string | undefined,
      country: req.query.country as string | undefined,
      region: req.query.region as string | undefined,
      search: req.query.search as string | undefined,
      limit: req.query.limit ? Number(req.query.limit) : 50,
      offset: req.query.offset ? Number(req.query.offset) : 0,
    };

    const repo = getRepository();
    const events = await repo.listEvents(params);
    const total = await repo.countEvents(params);

    res.json({
      events,
      total,
      limit: params.limit,
      offset: params.offset
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/events/:id
 * Get event detail with sources
 */
router.get('/events/:id', async (req, res, next) => {
  try {
    const repo = getRepository();
    const event = await repo.getEventWithSources(req.params.id);
    
    if (!event) {
      return res.status(404).json({ 
        error: 'Not found',
        message: `Event ${req.params.id} not found`
      });
    }

    res.json(event);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/ingest/run
 * Trigger manual ingestion (guarded by simple auth check)
 */
router.post('/ingest/run', async (req, res, next) => {
  try {
    // TODO: Add proper authentication/authorization
    // For now, simple bearer token check
    const authHeader = req.headers.authorization;
    const expectedToken = process.env.INGESTION_TOKEN || 'dev-token';
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Bearer token required'
      });
    }

    const token = authHeader.substring(7);
    if (token !== expectedToken) {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'Invalid token'
      });
    }

<<<<<<< HEAD
    const sourceName = req.body.source as string | undefined;
    const windowDays = req.body.windowDays ? Number(req.body.windowDays) : undefined;

    logger.info('Manual ingestion triggered', { 
      source: sourceName || 'all',
      windowDays: windowDays || config.ingestion.windowDays,
      triggeredBy: req.ip
    });

    const orch = getOrchestrator();
    const results = await orch.ingest(sourceName, windowDays);

    res.json({
      status: 'completed',
      results
    });
  } catch (error) {
    next(error);
  }
=======
router.post('/ingest/run', (_req, res) => {
  runRecentIngest()
    .then((result) => res.json({ status: 'ok', result }))
    .catch((err) => {
      console.error('[ingest] failed', err);
      res.status(500).json({ error: 'ingest_failed' });
    });
>>>>>>> 896e780 (feat(accident-tracker): add ingest scaffolding and geo lookup)
});

router.get('/airports', (req, res) => {
  const q = (req.query.search as string | undefined)?.trim() || '';
  if (!q) return res.json([]);
  const results = searchAirports(q, 20);
  res.json(results);
});

export default router;
