import express from "express";
import { memoryRepo } from "../repo/memoryRepo.js";
import { ListEventsParams } from "../types.js";
import { runRecentIngest } from "../ingest/ingestService.js";
import { searchAirports } from "../geo/airportLookup.js";
import { EventRepository } from "../db/repository.js";
import { config } from "../config.js";
import { macTaskCreator } from "../mac.js";
import { AccidentE2EManager } from '../e2e/manager.js';

type MacErrorReport = {
  source: "frontend" | "backend" | "log" | string;
  message: string;
  stack?: string | null;
  url?: string | null;
  user_agent?: string | null;
  context?: Record<string, unknown>;
};

export function createRouter(repository: EventRepository, e2e?: AccidentE2EManager) {
  const router = express.Router();
  const useMemoryRepo = config.env === "test";
  router.use(async (req, res, next) => {
    try {
      const runId = e2e?.authenticate(req.headers) ?? null;
      if (runId) {
        const readOnly = req.method === 'GET' && (
          req.path === '/events' || /^\/events\/[^/]+$/.test(req.path)
          || req.path === '/filters/options' || req.path === '/ingest/status'
          || req.path === '/airports' || req.path === '/health' || req.path === '/version');
        if (!readOnly) return res.status(403).json({ error: 'E2E API route not supported' });
        res.locals.e2eRepository = await e2e!.repository(runId);
      }
      else if (!e2e && Object.keys(req.headers).some(header => header.startsWith('x-aviation-test-'))) {
        return res.status(403).json({ error: 'E2E credentials are not configured' });
      }
      return next();
    } catch (_error) { return res.status(403).json({ error: 'Invalid E2E credentials' }); }
  });
  const activeRepository = (res: express.Response): EventRepository =>
    (res.locals.e2eRepository as EventRepository | undefined) ?? repository;

  router.get("/mac/enabled", (_req, res) => {
    res.json({ enabled: macTaskCreator.enabled(), created: false });
  });

  router.post("/mac/report", async (req, res) => {
    const enabled = macTaskCreator.enabled();
    if (!enabled) {
      return res.json({
        enabled: false,
        created: false,
        reason: "MAC autoreport disabled",
      });
    }

    const payload = req.body as MacErrorReport;
    const titlePrefix =
      payload.source === "frontend"
        ? "[frontend]"
        : payload.source === "backend"
          ? "[backend]"
          : payload.source === "log"
            ? "[log]"
            : "[error]";

    const firstLine = String(payload.message ?? "Error").split("\n")[0];
    const title = `${titlePrefix} ${firstLine.slice(0, 100)}`.trim();

    const context = {
      ...(payload.context ?? {}),
      client: req.ip,
      url: payload.url ?? undefined,
      user_agent: payload.user_agent ?? undefined,
    };

    let description = String(payload.message ?? "");
    if (Object.keys(context).length) {
      description +=
        "\n\nContext:\n" +
        Object.entries(context)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => `- ${k}: ${String(v)}`)
          .join("\n");
    }
    if (payload.stack) {
      description += `\n\nStack:\n${payload.stack}`;
    }

    const kind =
      payload.context && typeof payload.context === "object"
        ? (payload.context as any).kind
        : undefined;
    const autoFiledContext = `error report (source=${payload.source}, kind=${kind ?? "unknown"})`;

    const result = await macTaskCreator.createAutoFiledTask({
      title,
      description,
      taskType: "bug",
      priority: 1,
      autoFiledContext,
    });

    return res.json({
      enabled: true,
      created: result.created,
      task_id: result.taskId,
      reason: result.reason,
    });
  });

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
  router.get("/health", (_req, res) => {
    res.json({ status: "ok" });
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
  router.get("/version", (_req, res) => {
    res.json({ version: "0.1.0" });
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
  router.get("/events", async (req, res, next) => {
    const params: ListEventsParams = {
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      category: (req.query.category as any) || "all",
      airport: req.query.airport as string | undefined,
      country: req.query.country as string | undefined,
      region: req.query.region as string | undefined,
      search: req.query.search as string | undefined,
      cause: req.query.cause as string | undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      offset: req.query.offset ? Number(req.query.offset) : undefined,
    };

    try {
      if (useMemoryRepo && !res.locals.e2eRepository) {
        const result = memoryRepo.list(params);
        return res.json(result);
      }

      const result = await activeRepository(res).listEvents(params);
      return res.json({ total: result.total, data: result.events });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/ingest/status', async (_req, res, next) => {
    try {
      return res.json(await activeRepository(res).getIngestStatus());
    } catch (error) {
      return next(error);
    }
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
  router.get("/events/:id", async (req, res, next) => {
    try {
      if (useMemoryRepo && !res.locals.e2eRepository) {
        const item = memoryRepo.get(req.params.id);
        if (!item) return res.status(404).json({ error: "not_found" });
        return res.json(item);
      }

      const item = await activeRepository(res).getEventWithSources(req.params.id);
      if (!item) return res.status(404).json({ error: "not_found" });
      return res.json(item);
    } catch (error) {
      return next(error);
    }
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
  router.post("/ingest/run", (_req, res) => {
    if (res.locals.e2eRepository) return res.status(403).json({ error: 'Ingest is unavailable in E2E runs' });
    runRecentIngest(repository)
      .then((result) => res.json({ status: "ok", result }))
      .catch((err) => {
        console.error("[ingest] failed", err);
        res.status(500).json({ error: "ingest_failed" });
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
  router.get("/airports", (req, res) => {
    const q = (req.query.search as string | undefined)?.trim() || "";
    if (!q) return res.json([]);
    const results = searchAirports(q, 20);
    return res.json(results);
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
  router.get("/filters/options", async (_req, res, next) => {
    try {
      // Dynamic country/region lists derived from events in DB
      const [countryRows, regionRows] = await Promise.all([
        useMemoryRepo && !res.locals.e2eRepository
          ? Promise.resolve(
              [
                ...new Set(
                  memoryRepo
                    .list({})
                    .data.map((e: any) => e.country)
                    .filter(Boolean),
                ),
              ].sort(),
            )
          : activeRepository(res).getDistinctValues("country"),
        useMemoryRepo && !res.locals.e2eRepository
          ? Promise.resolve([])
          : activeRepository(res).getDistinctValues("region"),
      ]);

      return res.json({ countries: countryRows, regions: regionRows });
    } catch (err) {
      return next(err);
    }
  });

  return router;
}

export function createE2ERouter(manager: AccidentE2EManager) {
  const router = express.Router();
  router.use((req, res, next) => {
    try {
      const runId = manager.authenticate(req.headers);
      if (!runId) return res.status(404).json({ error: 'Not found' });
      res.locals.e2eRunId = runId;
      return next();
    } catch (_error) { return res.status(403).json({ error: 'Invalid E2E credentials' }); }
  });
  router.post('/fixtures', async (req, res) => {
    try {
      const result = await manager.seed(res.locals.e2eRunId, req.body?.fixture_type, req.body?.record);
      return res.status(201).json(result);
    } catch (error) { return res.status(400).json({ error: String(error) }); }
  });
  router.get('/runs/:runId', async (req, res) => {
    if (req.params.runId !== res.locals.e2eRunId) return res.status(403).json({ error: 'Wrong E2E run' });
    return res.json({ count: await manager.count(res.locals.e2eRunId) });
  });
  router.delete('/runs/:runId', async (req, res) => {
    if (req.params.runId !== res.locals.e2eRunId) return res.status(403).json({ error: 'Wrong E2E run' });
    await manager.delete(res.locals.e2eRunId);
    return res.json({ deleted: true });
  });
  return router;
}
