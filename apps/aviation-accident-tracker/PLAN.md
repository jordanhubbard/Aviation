# Aviation Accident Tracker — Epic Plan

Scope: New monorepo app to ingest, de-duplicate, classify, and serve aviation accidents/incidents (>= year 2000) with provenance, GA vs Commercial classification, map + filters UI.

## Epic: Planning (epic-plan)
- Finalize scope/MVP and non-goals.
- Choose stack (Node/TS, Postgres/SQLite fallback, Vite/React, Leaflet/MapLibre).
- Pick initial sources (ASN, AVHerald) and add source expansion backlog (Kathryn’s Report, AeroInside).
- Define data model and uniqueness rule: (date_z, registration) primary; fuzzy secondary (date_z±1d, country, type).
- Define provenance model (URL, fetched_at, source_name, checksum/version).
- Define GA/Commercial heuristic (operator, type, seats if available).
- Define Zulu/UTC normalization rules and time parsing.
- Define retention window: only >= 2000; backfill strategy.
- Define performance targets: ingestion cadence, query latencies, map load, table pagination.
- Align on security (no secrets in code; keystore for DB/proxies).

## Epic: Database (epic-database)
- Create schema + migrations:
  - events (id, date_z, registration, aircraft_type, operator, category enum, airport_icao/iata, lat/lon, country, region, fatalities, injuries, summary, narrative, status, created_at, updated_at).
  - sources (event_id FK, source_name, url, fetched_at, checksum, raw_fragment, created_at).
  - indexes: date_z DESC, (registration, date_z), geo (lat/lon), airport_icao, category.
- Implement DB bootstrap, migrate, seed sample.
- Add retention/constraint: reject < 2000.
- Add upsert helpers keyed on (date_z, registration) with merge rules.

## Epic: Data Sources (epic-data-sources)
- Implement source adapters:
  - ASN recent occurrences (HTML/JSON if available).
  - AVHerald recent feed.
- Normalization:
  - Time parsing to UTC/Z; capture original timezone.
  - Map severity/status (prelim/final if present).
  - GA/Commercial classification heuristic.
  - Country/airport lookup for geocoding.
- Dedupe/merge:
  - Exact key (date_z, registration); fuzzy fallback (date_z±1d, country, type).
  - Merge fields without losing provenance; append source entries.
- Scheduling:
  - Recent window crawl (e.g., last 40 days).
  - Manual trigger endpoint with rate-limit guard.
- Error handling & observability:
  - Retries/backoff; partial failure logging.
  - Metrics/log shape for ingestions.
- Backfill plan (post-MVP): controlled batches for >= 2000.

## Epic: Geo (epic-geo)
- Airport lookup service (ICAO/IATA to lat/lon/country/region).
- Reverse geo fallback when no airport is given.
- Tile/cluster prep for map (server-side clustering optional; client cluster otherwise).
- Cache layer for airport/geo lookups.

## Epic: Backend Service (epic-backend)
- Service scaffold (Node/TS): config, logging, error model.
- Ingestion orchestrator: runs adapters, applies dedupe/merge, writes DB.
- Classification helper (GA/Commercial/Unknown).
- Pagination & filtering helpers (date range, category, airport, country/region).
- Health and readiness endpoints.

## Epic: API (epic-api)
- `GET /events` with filters: from/to (date), category (general/commercial/all), airport, country/region, search (summary/operator/registration), pagination, sort by date desc.
- `GET /events/:id` detail with sources.
- `POST /ingest/run` (guarded) to trigger a pull.
- `GET /health` / `GET /version`.
- Response shaping for map (lightweight list with lat/lon/date/reg/category) vs table (full rows).
- OpenAPI spec; response validation.

## Epic: Frontend (epic-frontend)
- Vite + React + MUI + Leaflet (or MapLibre).
- Layout:
  - Top: Mercator map, clustered pins; tooltip with date/reg/operator/summary; click for detail.
  - Middle: Filters: date range, airport/region selector, category dropdown (GA/Commercial/All), text search.
  - Bottom: Table sorted by date desc; columns: date (Z), reg, operator, type, airport/region, category, fatalities/injuries, source badge; link to detail modal.
- Detail modal: narrative, status, sources with outbound links.
- State mgmt: lightweight (React Query or SWR) with caching.
- Accessibility: keyboard nav, focus, color contrast.

## Epic: Docs (epic-docs)
- App README (setup, run, build, ingest, filters).
- API docs (OpenAPI reference + examples).
- Data model docs (fields, enums, provenance).
- Ingestion guide (sources, cadence, backfill policy).
- Ops/runbook (logs, retries, rate limits).

## Epic: Tests (epic-tests)
- Unit: parsers, classifiers, dedupe/merge, time normalization.
- Integration: API against test DB; ingestion happy-path + dedupe cases.
- Contract/fixture tests for source adapters (sample pages/feeds checked into tests/fixtures).
- Frontend: component tests for filters/table/map interactions; smoke/E2E happy path (load map, filter, see rows).
- Performance sanity: pagination and map feed size (not strict perf, just guardrails).

## Non-goals (for now)
- Full-text search indexing (can add later).
- Real-time websocket updates (batch/periodic is sufficient).
- Pre-2000 data.
