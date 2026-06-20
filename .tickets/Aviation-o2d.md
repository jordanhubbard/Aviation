---
id: Aviation-o2d
status: closed
deps: []
links: []
created: 2026-01-13T15:21:28.801734-08:00
type: task
priority: 0
mac-task-id: task_155e6252a63a496399caf5004f4cda2d
---
# Extract airport database and search to @aviation/shared-sdk

**Epic Child: Aviation-sv9 - Shared Aviation Data Services**

Extract airport database loading, search, and lookup functionality from flightplanner into shared SDK.

**Current Implementation:**
- Location: `apps/flightplanner/backend/app/models/airport.py`
- Features:
  - Airport cache loading from JSON
  - ICAO/IATA code normalization
  - Fuzzy search with scoring
  - Proximity search (haversine distance)
  - Coordinate extraction

**Target Location:**
- `packages/shared-sdk/src/aviation/airports.ts` (TypeScript)
- `packages/shared-sdk/python/aviation/airports.py` (Python)

**Data Files:**
- Move `apps/flightplanner/backend/data/airports_cache.json` to `packages/shared-sdk/data/`
- Or fetch from OurAirports dynamically

**Requirements:**
- [ ] Port airport search logic to TypeScript
- [ ] Port airport search logic to Python
- [ ] Include distance calculations
- [ ] Include fuzzy matching
- [ ] Support both ICAO and IATA lookups
- [ ] Cache airport data in memory
- [ ] Unit tests for search algorithms
- [ ] Documentation with examples

**Dependencies:** OPENWEATHERMAP_API_KEY, Open-Meteo (free)

**Acceptance Criteria:**
- [ ] TypeScript and Python implementations match functionality
- [ ] All airport search tests passing
- [ ] Performance benchmarks (< 10ms search)
- [ ] Documentation complete
- [ ] Ready for migration to apps

**Blocks:** accident-tracker geo features, all apps using airport data
