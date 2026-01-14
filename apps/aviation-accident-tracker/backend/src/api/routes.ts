import express from 'express';
import { EventRepository } from '../db/repository.js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { IngestionOrchestrator } from '../ingest/orchestrator.js';
import type { ListEventsParams } from '../types.js';
import { searchAirports } from '../geo/airportLookup.js';
import airportsData from '../data/airports.json' assert { type: 'json' };

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
 * @swagger
 * /api/events:
 *   get:
 *     summary: List aviation events
 *     description: Retrieve a paginated list of aviation accidents and incidents with optional filters
 *     tags: [Events]
 *     parameters:
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter events from this date (YYYY-MM-DD)
 *         example: '2024-01-01'
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter events to this date (YYYY-MM-DD)
 *         example: '2024-12-31'
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [GA, Commercial, all]
 *         description: Filter by flight category
 *         example: 'GA'
 *       - in: query
 *         name: airport
 *         schema:
 *           type: string
 *         description: Filter by airport ICAO code
 *         example: 'KSFO'
 *       - in: query
 *         name: country
 *         schema:
 *           type: string
 *         description: Filter by country code
 *         example: 'US'
 *       - in: query
 *         name: region
 *         schema:
 *           type: string
 *         description: Filter by region
 *         example: 'North America'
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Full-text search in narrative
 *         example: 'engine failure'
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Number of results per page
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Pagination offset
 *     responses:
 *       200:
 *         description: List of events
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EventList'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 * @swagger
 * /api/events/{id}:
 *   get:
 *     summary: Get event details
 *     description: Retrieve detailed information about a specific event including provenance sources
 *     tags: [Events]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Event ID
 *         example: 'ASN_2024-01-15_N12345'
 *     responses:
 *       200:
 *         description: Event details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EventWithSources'
 *       404:
 *         description: Event not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 * @swagger
 * /api/ingest/run:
 *   post:
 *     summary: Trigger manual ingestion
 *     description: Manually trigger data ingestion from aviation accident sources (requires authentication)
 *     tags: [Ingestion]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/IngestionRequest'
 *     responses:
 *       200:
 *         description: Ingestion completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/IngestionResult'
 *       401:
 *         description: Unauthorized - Bearer token required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Invalid token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
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
 * @swagger
 * /api/airports:
 *   get:
 *     summary: Search airports
 *     description: Search for airports by ICAO code, IATA code, or name
 *     tags: [Airports]
 *     parameters:
 *       - in: query
 *         name: search
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query (ICAO, IATA, or name)
 *         example: 'SFO'
 *     responses:
 *       200:
 *         description: List of matching airports (max 20 results)
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Airport'
 */
router.get('/airports', (req, res) => {
  const q = (req.query.search as string | undefined)?.trim() || '';
  if (!q) return res.json([]);
  const results = searchAirports(q, 20);
  res.json(results);
});

/**
 * @swagger
 * /api/filters/options:
 *   get:
 *     summary: Get filter options
 *     description: Retrieve available filter options (countries and regions) for event filtering
 *     tags: [Filters]
 *     responses:
 *       200:
 *         description: Available filter options
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FilterOptions'
 */
router.get('/filters/options', (_req, res) => {
  const countries = Array.from(new Set((airportsData as any[]).map((a) => a.country).filter(Boolean))).sort();
  const regions = Array.from(new Set((airportsData as any[]).map((a) => a.region).filter(Boolean))).sort();
  res.json({ countries, regions });
});

export default router;
