import express from 'express';
import { memoryRepo } from '../repo/memoryRepo.js';
import { ListEventsParams } from '../types.js';
import { runRecentIngest } from '../ingest/ingestService.js';
import { searchAirports } from '../geo/airportLookup.js';
import airportsData from '../data/airports.json' assert { type: 'json' };

const router = express.Router();

/**
 * @openapi
 * /api/health:
 *   get:
 *     summary: Health probe for the API router
 *     tags: [Meta]
 *     responses:
 *       200:
 *         description: Service is up
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 */
router.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

/**
 * @openapi
 * /api/version:
 *   get:
 *     summary: Return API version
 *     tags: [Meta]
 *     responses:
 *       200:
 *         description: Version info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 version:
 *                   type: string
 *                   example: 0.1.0
 */
router.get('/version', (_req, res) => {
  res.json({ version: '0.1.0' });
});

/**
 * @openapi
 * /api/events:
 *   get:
 *     summary: List events with filters
 *     tags: [Events]
 *     parameters:
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *         description: ISO date-time lower bound (UTC)
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *         description: ISO date-time upper bound (UTC)
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [general, commercial, unknown, all]
 *       - in: query
 *         name: airport
 *         schema:
 *           type: string
 *         description: ICAO or IATA code
 *       - in: query
 *         name: country
 *         schema:
 *           type: string
 *       - in: query
 *         name: region
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Full-text match over registration/operator/type/summary/narrative
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 200
 *         default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *         default: 0
 *     responses:
 *       200:
 *         description: Paginated events
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ListEventsResponse'
 */
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

/**
 * @openapi
 * /api/events/{id}:
 *   get:
 *     summary: Get event by ID
 *     tags: [Events]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Event found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/EventRecord'
 *       404:
 *         description: Event not found
 */
router.get('/events/:id', (req, res) => {
  const item = memoryRepo.get(req.params.id);
  if (!item) return res.status(404).json({ error: 'not_found' });
  res.json(item);
});

/**
 * @openapi
 * /api/ingest/run:
 *   post:
 *     summary: Manually trigger recent ingest
 *     tags: [Ingest]
 *     responses:
 *       200:
 *         description: Ingest executed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 result:
 *                   type: object
 *       500:
 *         description: Ingest failed
 */
router.post('/ingest/run', (_req, res) => {
  runRecentIngest()
    .then((result) => res.json({ status: 'ok', result }))
    .catch((err) => {
      console.error('[ingest] failed', err);
      res.status(500).json({ error: 'ingest_failed' });
    });
});

/**
 * @openapi
 * /api/airports:
 *   get:
 *     summary: Search airports by ICAO/IATA/name/country/region
 *     tags: [Geo]
 *     parameters:
 *       - in: query
 *         name: search
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Matching airports
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/AirportRecord'
 */
router.get('/airports', (req, res) => {
  const q = (req.query.search as string | undefined)?.trim() || '';
  if (!q) return res.json([]);
  const results = searchAirports(q, 20);
  res.json(results);
});

/**
 * @openapi
 * /api/filters/options:
 *   get:
 *     summary: Retrieve filter option lists for countries and regions
 *     tags: [Geo]
 *     responses:
 *       200:
 *         description: Filter values
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FiltersOptions'
 */
router.get('/filters/options', (_req, res) => {
  const countries = Array.from(new Set((airportsData as any[]).map((a) => a.country).filter(Boolean))).sort();
  const regions = Array.from(new Set((airportsData as any[]).map((a) => a.region).filter(Boolean))).sort();
  res.json({ countries, regions });
});

export default router;
