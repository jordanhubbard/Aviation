# Shared Code Extraction & Migration Plan

Created: 2026-01-13

## Summary

Created **17 new beads** (3 epics + 14 stories) for extracting common aviation code from individual apps into shared SDK packages, then migrating all apps to use the shared code.

**Total Beads:** 41 open (24 accident-tracker + 17 shared code)

---

## Problem Statement

Currently, aviation applications in this monorepo have **duplicated code** for:
- Airport database and search
- Weather services (OpenWeatherMap, Open-Meteo, METAR)
- Navigation calculations (haversine, coordinates)
- Map integration patterns (Leaflet)
- External API clients (Google Calendar, ForeFlight)

This leads to:
- Code duplication across apps
- Inconsistent implementations
- Scattered API key management
- Difficult maintenance

---

## Solution: Extract to Shared SDK

Extract common functionality into shared packages:
- `@aviation/shared-sdk` - Core aviation data services
- `@aviation/ui-framework` - UI components and patterns
- `@aviation/keystore` - Centralized secrets management (already exists)

---

## Epic Structure

### Epic 1: Extract Shared Aviation Data Services
**[Aviation-sv9]** - Extract common code from apps

**Child Stories:**
1. **[Aviation-o2d]** Extract airport database and search
   - From: `apps/flightplanner/backend/app/models/airport.py`
   - To: `packages/shared-sdk/src/aviation/airports.ts`
   - Features: Search, proximity, ICAO/IATA lookup, distance calc
   - Languages: TypeScript + Python wrapper

2. **[Aviation-dx3]** Extract weather services
   - From: `apps/flightplanner/backend/app/services/`
   - To: `packages/shared-sdk/src/aviation/weather/`
   - Services: OpenWeatherMap, Open-Meteo, METAR, flight category
   - API Keys: OPENWEATHERMAP_API_KEY (from keystore)

3. **[Aviation-ywm]** Extract navigation utilities
   - From: `apps/flightplanner` navigation functions
   - To: `packages/shared-sdk/src/aviation/navigation/`
   - Features: Haversine, great circle, bearing, fuel, T/S/D

4. **[Aviation-r2l]** Extract map integration patterns
   - From: `apps/flightplanner/frontend/src/components/LocalMap.tsx`
   - To: `packages/ui-framework/src/map/`
   - Features: Leaflet components, clustering, polylines, markers

5. **[Aviation-5o5]** Extract Google Calendar integration
   - From: `apps/flightschool/app/calendar_service.py`
   - To: `packages/shared-sdk/src/integrations/google/calendar.ts`
   - Features: OAuth2, event CRUD, timezone handling
   - API Keys: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

---

### Epic 2: Migrate All Apps to Shared SDK
**[Aviation-q0h]** - Update all apps to use shared code

**Child Stories:**
1. **[Aviation-b8m]** Migrate flightplanner
   - Replace: airports, weather, navigation, map
   - Impact: HIGH (heavy user of shared code)
   - Effort: 3-5 days

2. **[Aviation-a5f]** Migrate accident-tracker
   - Integrate: airports, weather, map, navigation
   - Impact: HIGH (MVP blocker)
   - Effort: 2-3 days

3. **[Aviation-64g]** Migrate flightschool
   - Replace: Google Calendar service
   - Impact: MEDIUM
   - Effort: 2 days

4. **[Aviation-kmc]** Migrate foreflight-dashboard
   - Audit and replace shared code
   - Impact: LOW (minimal shared code)
   - Effort: 1-2 days

5. **[Aviation-cgu]** Migrate flight-tracker
   - Add: airports, weather, navigation
   - Impact: MEDIUM
   - Effort: 1-2 days

6. **[Aviation-u90]** Migrate weather-briefing
   - Replace: weather services
   - Impact: HIGH (core functionality)
   - Effort: 1-2 days

7. **[Aviation-tcy]** Migrate aviation-missions-app
   - Audit (Clojure app, may use HTTP API)
   - Impact: LOW
   - Effort: 1 day

---

### Epic 3: Validate All Apps Post-Migration
**[Aviation-gnm]** - Ensure 100% CI/CD green

**Child Stories:**
1. **[Aviation-st5]** Validate flightplanner
   - 100% tests, build, deploy, feature parity
   - Effort: 1-2 days

2. **[Aviation-8m2]** Run full monorepo validation
   - All apps, CI/CD, code quality, docs
   - Effort: 2-3 days

---

## External Services Identified

From audit of existing apps:

### APIs with Keys (via keystore)
1. **OpenWeatherMap** - Current weather and maps
   - Key: `OPENWEATHERMAP_API_KEY`
   - Used by: flightplanner

2. **Open-Meteo** - Forecast and route weather
   - Free, no key required
   - Used by: flightplanner

3. **AviationWeather.gov** - METAR data
   - Free, no key required
   - Used by: flightplanner

4. **Google Calendar API**
   - Keys: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
   - Used by: flightschool

5. **ForeFlight API**
   - Keys: `FOREFLIGHT_API_KEY`, `FOREFLIGHT_API_SECRET`
   - Used by: foreflight-dashboard

### Data Sources
6. **OurAirports** - Airport database
   - Free, open data
   - Cached locally in `backend/data/airports_cache.json`

7. **OpenTopography** - Terrain elevation (SRTM)
   - Optional, API-key gated
   - Used by: flightplanner

---

## Shared Code Inventory

### Currently in flightplanner (to extract):

**Airports:**
- `backend/app/models/airport.py` (~210 lines)
- Airport cache loading
- ICAO/IATA normalization
- Fuzzy search with scoring
- Proximity search (haversine)
- Coordinate extraction

**Weather:**
- `backend/app/services/openweathermap.py` (~100 lines)
- `backend/app/services/open_meteo.py` (~150 lines)
- `backend/app/services/metar.py` (~120 lines)
- `backend/app/services/flight_recommendations.py` (~80 lines)
- Caching strategies (TTL + LRU)

**Navigation:**
- Haversine distance calculation
- Great circle route
- Bearing calculations
- Coordinate utilities

**Map:**
- `frontend/src/components/LocalMap.tsx` (~280 lines)
- Leaflet integration
- Marker clustering
- Polyline rendering

### Currently in flightschool (to extract):

**Google Calendar:**
- `app/calendar_service.py` (~100 lines)
- OAuth2 flow
- Calendar event CRUD
- Credential management

---

## Target Package Structure

```
packages/
├── shared-sdk/
│   ├── src/
│   │   ├── aviation/
│   │   │   ├── airports.ts           # NEW
│   │   │   ├── weather/              # NEW
│   │   │   │   ├── openweathermap.ts
│   │   │   │   ├── open-meteo.ts
│   │   │   │   ├── metar.ts
│   │   │   │   ├── flight-category.ts
│   │   │   │   └── weather-cache.ts
│   │   │   ├── navigation/           # NEW
│   │   │   │   ├── distance.ts
│   │   │   │   ├── bearing.ts
│   │   │   │   ├── coordinates.ts
│   │   │   │   ├── fuel.ts
│   │   │   │   └── time-speed-distance.ts
│   │   │   └── types.ts              # UPDATED
│   │   ├── integrations/             # NEW
│   │   │   └── google/
│   │   │       ├── calendar.ts
│   │   │       ├── auth.ts
│   │   │       └── types.ts
│   │   ├── ai.ts                     # EXISTING
│   │   ├── index.ts                  # UPDATED
│   │   └── service.ts                # EXISTING
│   ├── python/                       # NEW
│   │   └── aviation/
│   │       ├── airports.py
│   │       ├── weather.py
│   │       └── navigation.py
│   ├── data/                         # NEW
│   │   └── airports_cache.json
│   └── README.md                     # UPDATED
│
├── ui-framework/
│   ├── src/
│   │   ├── map/                      # NEW
│   │   │   ├── MapProvider.tsx
│   │   │   ├── LeafletMap.tsx
│   │   │   ├── Markers.tsx
│   │   │   ├── Polylines.tsx
│   │   │   ├── Controls.tsx
│   │   │   └── clustering.ts
│   │   └── index.ts                  # UPDATED
│   └── README.md                     # UPDATED
│
└── keystore/                         # EXISTING
    └── (no changes)
```

---

## Migration Impact by App

| App | Impact | Shared Code Used | Effort | Priority |
|-----|--------|------------------|--------|----------|
| **flightplanner** | 🔴 **HIGH** | Airports, Weather, Navigation, Map | 3-5 days | P1 |
| **accident-tracker** | 🔴 **HIGH** | Airports, Weather, Map, Navigation | 2-3 days | P1 |
| **weather-briefing** | 🔴 **HIGH** | Weather (core functionality) | 1-2 days | P2 |
| **flightschool** | 🟡 **MEDIUM** | Google Calendar | 2 days | P2 |
| **flight-tracker** | 🟡 **MEDIUM** | Airports, Weather, Navigation | 1-2 days | P2 |
| **foreflight-dashboard** | 🟢 **LOW** | Minimal shared code | 1-2 days | P2 |
| **aviation-missions-app** | 🟢 **LOW** | Clojure app, HTTP API | 1 day | P2 |

---

## Benefits

### Code Quality
- ✅ Eliminate duplication
- ✅ Consistent implementations
- ✅ Centralized bug fixes
- ✅ Shared test coverage

### Maintainability
- ✅ Single source of truth
- ✅ Easier to update APIs
- ✅ Centralized API key management
- ✅ Shared caching strategies

### Development Speed
- ✅ Reusable components
- ✅ Faster new app development
- ✅ Consistent patterns
- ✅ Better TypeScript types

### Performance
- ✅ Shared caching
- ✅ Optimized algorithms
- ✅ Reduced bundle sizes (shared deps)

---

## Timeline

### Phase 1: Extraction (2-3 weeks)
Week 1-2: Extract shared code
- Airports, Weather, Navigation, Map, Calendar
- TypeScript + Python wrappers
- Tests and documentation

Week 3: Package finalization
- Final testing
- Documentation polish
- Performance optimization

### Phase 2: Migration (2-3 weeks)
Week 1: High-impact apps
- flightplanner (3-5 days)
- accident-tracker (2-3 days)

Week 2: Medium-impact apps
- flightschool (2 days)
- flight-tracker (1-2 days)
- weather-briefing (1-2 days)

Week 3: Low-impact apps + validation
- foreflight-dashboard (1-2 days)
- aviation-missions-app (1 day)
- Full validation (2-3 days)

### Phase 3: Validation (1 week)
- Individual app validation
- Full monorepo CI/CD validation
- Performance benchmarking
- Documentation updates

**Total Estimated Time:** 5-7 weeks for one developer
**Parallelizable:** 2-3 developers could reduce to 3-4 weeks

---

## Success Criteria

### Technical
- [ ] All shared code extracted to packages/
- [ ] All apps migrated to use shared SDK
- [ ] 100% tests passing across all apps
- [ ] 100% apps building successfully
- [ ] CI/CD pipeline green
- [ ] No performance regressions
- [ ] Feature parity maintained

### Quality
- [ ] Shared SDK test coverage >80%
- [ ] All apps validated individually
- [ ] Documentation complete
- [ ] API keys centralized in keystore
- [ ] No code duplication

### Deployment
- [ ] All apps deployable
- [ ] Staging environments validated
- [ ] Production ready
- [ ] Rollback plan documented

---

## Risk Mitigation

### Risks
1. **Breaking changes** during migration
2. **Performance regressions** from abstraction
3. **Feature parity** not maintained
4. **Testing gaps** in shared code
5. **Deployment issues** with new dependencies

### Mitigation
1. ✅ Feature parity validation per app
2. ✅ Performance benchmarks before/after
3. ✅ Comprehensive test suite for shared SDK
4. ✅ Gradual migration (one app at a time)
5. ✅ Staging validation before production
6. ✅ Rollback plan (git revert + redeploy)

---

## Next Steps

1. **Review this plan** with team
2. **Prioritize beads** (extraction vs migration)
3. **Start with airports extraction** (Aviation-o2d)
4. **Parallel: Start accident-tracker MVP** (can use shared SDK as it's built)
5. **Weekly sync** on progress
6. **Update beads** as work progresses

---

## Questions for Discussion

1. Should we extract all shared code first, or extract + migrate incrementally?
2. Do we need Python wrappers for all shared code, or just critical parts?
3. Should we use Leaflet or MapLibre for maps? (standardize)
4. Do we want shared caching strategies (Redis) or keep in-process?
5. Should aviation-missions-app (Clojure) use HTTP API or JVM bindings?

---

## Related Documents

- [NEW_BEADS.md](NEW_BEADS.md) - Original accident-tracker beads
- [COMPLETION_STATUS.md](COMPLETION_STATUS.md) - Gap analysis
- [TEST_REVIEW.md](TEST_REVIEW.md) - Test results
- [PLAN.md](PLAN.md) - Original epic plan

---

**Status:** Ready for review and prioritization
**Owner:** TBD
**Start Date:** TBD
**Target Completion:** 5-7 weeks from start
