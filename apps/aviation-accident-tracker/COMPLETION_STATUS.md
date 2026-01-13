# Aviation Accident Tracker - Completion Status vs PLAN.md

## Summary

**All beads are CLOSED**, but **NOT all user stories are implemented**.

Many epics have only **scaffolding/stubs** in place. The architecture is solid and ready for development, but key features remain unimplemented.

---

## Epic-by-Epic Status

### ✅ Epic: Planning (COMPLETE)
All planning tasks completed:
- ✅ Stack chosen (Node/TS, SQLite, Vite/React, Leaflet)
- ✅ Sources picked (ASN, AVHerald)
- ✅ Data model defined with uniqueness rules
- ✅ Provenance model defined
- ✅ GA/Commercial heuristic defined
- ✅ UTC normalization rules defined
- ✅ Retention window (>= 2000) defined
- ✅ Security approach (keystore)

**Status: 100% complete**

---

### ⚠️ Epic: Database (MOSTLY COMPLETE)

**Completed:**
- ✅ Schema created (events, sources tables)
- ✅ Indexes created (date_z, registration, geo, airport, category)
- ✅ Retention constraint (>= 2000 in code)
- ✅ Upsert helpers keyed on (date_z, registration)
- ✅ Foreign keys with CASCADE

**Missing:**
- ❌ Formal migration system (just SQL schema file)
- ❌ Seed sample data
- ❌ DB bootstrap script

**Status: 80% complete** - Core functionality works, missing tooling

---

### ⚠️ Epic: Data Sources (FRAMEWORK ONLY)

**Completed:**
- ✅ Adapter interfaces defined
- ✅ ASN adapter class created
- ✅ AVHerald adapter class created
- ✅ Normalization utilities (UTC conversion)
- ✅ Classification logic implemented
- ✅ Exact dedupe on (date_z, registration)
- ✅ Error handling framework
- ✅ Retry logic with exponential backoff
- ✅ Rate limiting support
- ✅ Orchestrator for running adapters

**Missing (CRITICAL):**
- ❌ **Actual ASN web scraping/API implementation**
- ❌ **Actual AVHerald feed parsing implementation**
- ❌ Fuzzy dedupe (date±1d, country, type matching)
- ❌ Scheduling/cron for periodic ingestion
- ❌ Metrics/observability beyond basic logging
- ❌ Backfill implementation

**Status: 30% complete** - Framework exists, but NO REAL DATA can be ingested

---

### ❌ Epic: Geo (NOT IMPLEMENTED)

**Completed:**
- ✅ Database schema includes lat/lon/airport fields
- ✅ Geo indexes on (lat, lon)

**Missing (ALL):**
- ❌ Airport lookup service (ICAO/IATA → lat/lon/country)
- ❌ Reverse geocoding fallback
- ❌ Tile/cluster prep for map
- ❌ Cache layer for airport/geo lookups

**Status: 10% complete** - Only schema exists, no functionality

---

### ✅ Epic: Backend Service (COMPLETE)

**Completed:**
- ✅ Service scaffold (config, logging, error model)
- ✅ Ingestion orchestrator
- ✅ Classification helper (GA/Commercial/Unknown)
- ✅ Pagination helpers (limit, offset)
- ✅ Filtering helpers (date range, category, airport, country, region, search)
- ✅ Health endpoint (`/health`)
- ✅ Readiness endpoint (implicit in health check)
- ✅ Error handling middleware
- ✅ Request logging

**Status: 100% complete**

---

### ⚠️ Epic: API (MOSTLY COMPLETE)

**Completed:**
- ✅ `GET /api/events` with filters (from/to, category, airport, country, region, search)
- ✅ Pagination (limit, offset)
- ✅ Sort by date DESC
- ✅ `GET /api/events/:id` detail with sources
- ✅ `POST /api/ingest/run` (with bearer token auth)
- ✅ `GET /health`
- ✅ `GET /version`
- ✅ JSON error responses
- ✅ Proper HTTP status codes

**Missing:**
- ❌ OpenAPI/Swagger spec
- ❌ Response validation middleware
- ❌ Separate map vs table response shaping (optimization)
- ❌ Rate limiting on public endpoints

**Status: 85% complete** - Core API works, missing docs and optimizations

---

### ❌ Epic: Frontend (NOT IMPLEMENTED)

**Completed:**
- ✅ Basic Vite + React structure
- ✅ Dependencies listed (React, Leaflet)
- ✅ Entry point files exist

**Missing (EVERYTHING):**
- ❌ Map component with Leaflet/MapLibre
- ❌ Clustered pins on map
- ❌ Tooltips on map markers
- ❌ Filter UI (date range, airport, category, search)
- ❌ Event table component
- ❌ Table sorting
- ❌ Detail modal
- ❌ State management (React Query/SWR)
- ❌ Accessibility implementation
- ❌ Any UI components at all

**Status: 5% complete** - Only empty scaffolding

---

### ⚠️ Epic: Docs (PARTIAL)

**Completed:**
- ✅ App README with overview
- ✅ Quick start instructions
- ✅ Test review document
- ✅ Comments in code

**Missing:**
- ❌ OpenAPI/Swagger documentation
- ❌ Detailed data model documentation
- ❌ Ingestion guide (how to add sources, cadence, backfill)
- ❌ Ops/runbook (logs, retries, monitoring, alerts)
- ❌ Deployment guide

**Status: 40% complete** - Basic docs exist, missing operational guides

---

### ⚠️ Epic: Tests (PARTIAL)

**Completed:**
- ✅ Unit tests for classification (7 tests)
- ✅ Unit tests for time normalization (4 tests)
- ✅ Test infrastructure (Vitest)
- ✅ 11 tests passing

**Missing:**
- ❌ Integration tests for API endpoints
- ❌ Repository integration tests
- ❌ Contract/fixture tests for source adapters
- ❌ Frontend component tests
- ❌ E2E tests
- ❌ Performance/load tests
- ❌ Test coverage reporting

**Status: 30% complete** - Unit tests for core logic only

---

## Overall Completion Analysis

### What's Ready for Production
- ✅ Backend service architecture
- ✅ Database schema and repository layer
- ✅ API endpoints
- ✅ Authentication framework
- ✅ Error handling and logging
- ✅ Core business logic (classification, normalization)

### What's Blocking MVP
- ❌ **Data source adapters (ASN, AVHerald)** - CRITICAL
- ❌ **Frontend UI (map, table, filters)** - CRITICAL
- ❌ **Geo features (airport lookup)** - HIGH PRIORITY

### What's Missing for Full Plan
- ❌ Fuzzy deduplication
- ❌ Scheduled ingestion (cron)
- ❌ API documentation (OpenAPI)
- ❌ Frontend tests
- ❌ Integration tests
- ❌ Operational documentation
- ❌ Performance tests

---

## Recommended Priorities

### Phase 1: Make it Work (MVP)
1. **Implement ASN adapter** - Scrape/parse actual data
2. **Implement AVHerald adapter** - Parse RSS/feed
3. **Add seed data script** - Populate DB for testing
4. **Implement airport lookup** - Basic geo functionality
5. **Build minimal frontend** - List view + filters only

### Phase 2: Make it Useful
6. Implement map view with clustering
7. Add detail modal
8. Implement fuzzy deduplication
9. Add integration tests
10. Write operational documentation

### Phase 3: Make it Production-Ready
11. Add OpenAPI documentation
12. Implement scheduled ingestion
13. Add monitoring/alerting
14. Performance testing
15. E2E tests
16. Deployment automation

---

## Bottom Line

**Beads Status:** ✅ All closed
**Implementation Status:** ⚠️ ~45% complete
**MVP Status:** ⚠️ Missing critical components (data ingestion, frontend)

The **architecture is solid** and the **foundation is complete**, but **core features** (actual data collection and user interface) are **not implemented**.

Think of it as: **The house is framed, wired, and plumbed, but there are no walls, floors, or furniture yet.**
