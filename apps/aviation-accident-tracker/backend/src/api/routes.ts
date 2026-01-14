import express from 'express';
import { EventRepository } from '../db/repository.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { IngestionOrchestrator } from '../ingest/orchestrator.js';
import type { ListEventsParams } from '../types.js';
import { getAirport, searchAirports, searchAirportsAdvanced } from '@aviation/shared-sdk';

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
});

/**
 * GET /api/airports/search
 * Search airports by text query
 * Query params: q (query), limit (max results, default 20)
 * MUST come before /:code route!
 */
router.get('/airports/search', async (req, res, next) => {
  try {
    const query = req.query.q as string;
    const limit = req.query.limit ? Number(req.query.limit) : 20;

    if (!query) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Query parameter "q" is required'
      });
    }

    const results = await searchAirports(query, limit);
    
    res.json({
      query,
      limit,
      count: results.length,
      results
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/airports/nearby
 * Find airports near coordinates
 * Query params: lat, lon, radius (nm), limit (default 20)
 * MUST come before /:code route!
 */
router.get('/airports/nearby', async (req, res, next) => {
  try {
    const lat = req.query.lat ? Number(req.query.lat) : undefined;
    const lon = req.query.lon ? Number(req.query.lon) : undefined;
    const radius_nm = req.query.radius ? Number(req.query.radius) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 20;

    if (lat === undefined || lon === undefined) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Query parameters "lat" and "lon" are required'
      });
    }

    const results = await searchAirportsAdvanced({
      lat,
      lon,
      radius_nm,
      limit
    });

    res.json({
      lat,
      lon,
      radius_nm: radius_nm || 'unlimited',
      limit,
      count: results.length,
      results
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/airports/:code
 * Look up airport by ICAO or IATA code
 * MUST come AFTER specific routes like /search and /nearby!
 */
router.get('/airports/:code', async (req, res, next) => {
  try {
    const airport = await getAirport(req.params.code);
    
    if (!airport) {
      return res.status(404).json({
        error: 'Not found',
        message: `Airport ${req.params.code} not found`
      });
    }

    res.json(airport);
  } catch (error) {
    next(error);
  }
});

export default router;
