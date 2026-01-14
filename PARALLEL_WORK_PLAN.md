# Parallel Work Plan - Aviation Shared SDK Extraction

**Status:** 1 of 5 extraction tasks complete ✅  
**Updated:** 2026-01-14  
**Coordinator:** Track progress via `bd ready` and this document

## Overview

This plan enables **4 parallel work streams** to extract shared aviation services from individual apps into the shared SDK. Each stream is independent and can be worked on simultaneously by different AI agents or developers.

## Completed Work

- ✅ **Stream 1: Airport Database** (Aviation-o2d) - COMPLETE
  - Commit: `043e85a`
  - Files: `packages/shared-sdk/src/aviation/airports.ts`, Python version
  - Status: Merged, ready for use

## Active Parallel Streams (4 Concurrent)

### Stream 2: Weather Services 🌤️
**Issue:** Aviation-dx3  
**Priority:** P0 (blocks accident-tracker)  
**Branch:** `feature/extract-weather-services`  
**Estimated Effort:** 6-8 hours  
**Dependencies:** None (fully independent)

**Scope:**
- Extract from `apps/flightplanner/backend/app/services/`
  - `openweathermap.py` → `packages/shared-sdk/src/aviation/weather/openweathermap.ts`
  - `open_meteo.py` → `packages/shared-sdk/src/aviation/weather/open-meteo.ts`
  - `metar.py` → `packages/shared-sdk/src/aviation/weather/metar.ts`
  - `flight_recommendations.py` → `packages/shared-sdk/src/aviation/weather/flight-category.ts`

**Files to Create:**
- `packages/shared-sdk/src/aviation/weather/openweathermap.ts`
- `packages/shared-sdk/src/aviation/weather/open-meteo.ts`
- `packages/shared-sdk/src/aviation/weather/metar.ts`
- `packages/shared-sdk/src/aviation/weather/flight-category.ts`
- `packages/shared-sdk/src/aviation/weather/cache.ts`
- `packages/shared-sdk/python/aviation/weather.py`

**Key Features:**
- OpenWeatherMap API client (requires `OPENWEATHERMAP_API_KEY`)
- Open-Meteo API client (free, no key)
- METAR fetching and parsing
- Flight category calculations (VFR, MVFR, IFR, LIFR)
- Caching with TTL (5min) and LRU eviction
- Rate limiting
- Python wrapper

**Testing:**
- Mock API responses for unit tests
- Real API integration tests (optional)
- Cache behavior tests

**Command to Start:**
```bash
git checkout -b feature/extract-weather-services
bd update Aviation-dx3 --status in_progress
# Begin work...
```

---

### Stream 3: Navigation Utilities 🧭
**Issue:** Aviation-ywm  
**Priority:** P0 (blocks accident-tracker)  
**Branch:** `feature/extract-navigation-utils`  
**Estimated Effort:** 4-6 hours  
**Dependencies:** None (fully independent)

**Scope:**
- Extract navigation calculations from flightplanner
- Pure math functions (no external dependencies)
- Target: `packages/shared-sdk/src/aviation/navigation/`

**Files to Create:**
- `packages/shared-sdk/src/aviation/navigation/distance.ts`
- `packages/shared-sdk/src/aviation/navigation/bearing.ts`
- `packages/shared-sdk/src/aviation/navigation/coordinates.ts`
- `packages/shared-sdk/src/aviation/navigation/fuel.ts`
- `packages/shared-sdk/src/aviation/navigation/time-speed-distance.ts`
- `packages/shared-sdk/python/aviation/navigation.py`

**Key Features:**
- Haversine distance (NM, km, mi)
- Great circle route generation
- Bearing calculations (initial, final)
- Midpoint calculation
- Destination point from distance/bearing
- Coordinate validation
- Fuel range calculations
- Wind correction angles
- Ground speed calculations

**Testing:**
- Validate against known aviation values
- Precision tests (< 0.1% error)
- 100% test coverage (pure math functions)
- Performance tests (< 1ms per calculation)

**Command to Start:**
```bash
git checkout -b feature/extract-navigation-utils
bd update Aviation-ywm --status in_progress
# Begin work...
```

---

### Stream 4: Map Integration Patterns 🗺️
**Issue:** Aviation-r2l  
**Priority:** P0 (blocks accident-tracker)  
**Branch:** `feature/extract-map-patterns`  
**Estimated Effort:** 6-8 hours  
**Dependencies:** None (fully independent)

**Scope:**
- Extract Leaflet/MapLibre patterns from flightplanner
- React components and utilities
- Target: `packages/ui-framework/src/map/`

**Files to Create:**
- `packages/ui-framework/src/map/MapProvider.tsx`
- `packages/ui-framework/src/map/LeafletMap.tsx`
- `packages/ui-framework/src/map/Markers.tsx`
- `packages/ui-framework/src/map/Polylines.tsx`
- `packages/ui-framework/src/map/Controls.tsx`
- `packages/ui-framework/src/map/clustering.ts`
- `packages/ui-framework/src/map/types.ts`

**Key Features:**
- Base map component (Leaflet)
- Marker component with clustering
- Polyline/route drawing
- Custom icon support
- Map controls (zoom, layers)
- Event handling (click, hover, drag)
- Responsive design
- SSR compatibility
- Accessibility (keyboard navigation)

**Dependencies to Add:**
- `leaflet` or `maplibre-gl`
- `react-leaflet` or `react-map-gl`
- `leaflet.markercluster`

**Testing:**
- Component tests (React Testing Library)
- Storybook examples
- Performance tests (60fps)
- Accessibility tests

**Command to Start:**
```bash
git checkout -b feature/extract-map-patterns
bd update Aviation-r2l --status in_progress
# Begin work...
```

---

### Stream 5: Google Calendar Integration 📅
**Issue:** Aviation-5o5  
**Priority:** P2 (lower priority but independent)  
**Branch:** `feature/extract-google-calendar`  
**Estimated Effort:** 5-7 hours  
**Dependencies:** None (fully independent)

**Scope:**
- Extract from `apps/flightschool/app/calendar_service.py`
- Target: `packages/shared-sdk/src/integrations/google/`

**Files to Create:**
- `packages/shared-sdk/src/integrations/google/calendar.ts`
- `packages/shared-sdk/src/integrations/google/auth.ts`
- `packages/shared-sdk/src/integrations/google/types.ts`
- `packages/shared-sdk/python/integrations/google_calendar.py`

**Key Features:**
- OAuth2 authorization flow
- Token storage and refresh
- Create/update/delete calendar events
- List events with filtering
- Recurring event support
- Timezone handling
- Rate limiting

**API Keys Required:**
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

**Testing:**
- Mock OAuth flow
- Mock Google Calendar API
- Token refresh tests
- Integration tests (optional)

**Command to Start:**
```bash
git checkout -b feature/extract-google-calendar
bd update Aviation-5o5 --status in_progress
# Begin work...
```

---

## Coordination & Merge Strategy

### Branch Strategy

```
main
├── feature/extract-weather-services (Stream 2)
├── feature/extract-navigation-utils (Stream 3)
├── feature/extract-map-patterns (Stream 4)
└── feature/extract-google-calendar (Stream 5)
```

### Merge Order (Recommended)

Since these are independent, merge in any order as they complete. However, for maximum impact:

1. **Navigation Utils** (fastest, math-only) → Unblocks distance calculations
2. **Weather Services** → Unblocks weather features
3. **Map Patterns** → Unblocks map displays
4. **Google Calendar** → Nice to have, lower priority

### Avoiding Merge Conflicts

Each stream modifies different files:
- Stream 2: `packages/shared-sdk/src/aviation/weather/`
- Stream 3: `packages/shared-sdk/src/aviation/navigation/`
- Stream 4: `packages/ui-framework/src/map/`
- Stream 5: `packages/shared-sdk/src/integrations/google/`

**Potential Conflicts:**
- `packages/shared-sdk/src/index.ts` - All streams export here
  - **Solution:** Last to merge resolves by adding their exports after existing ones
- `packages/shared-sdk/README.md` - Documentation updates
  - **Solution:** Last to merge adds their section to README
- `package.json` dependencies - Map patterns adds Leaflet deps
  - **Solution:** Run `npm install` after each merge

### Testing Before Merge

Each stream must:
1. ✅ Build successfully: `npm run build`
2. ✅ Pass linting: `npm run lint` (if available)
3. ✅ Update exports in `index.ts`
4. ✅ Update README with examples
5. ✅ No TypeScript errors
6. ✅ Git commit with proper message

### Commit Message Format

```
feat(shared-sdk): Extract <feature> from <source-app>

- Add TypeScript implementation in <path>
- Add Python implementation in <path> (if applicable)
- Key feature 1
- Key feature 2
- Update shared-SDK exports and README

Closes <issue-id>
```

Example:
```
feat(shared-sdk): Extract weather services from flightplanner

- Add TypeScript implementations in packages/shared-sdk/src/aviation/weather/
- Add Python wrapper in packages/shared-sdk/python/aviation/weather.py
- Support OpenWeatherMap, Open-Meteo, METAR APIs
- Implement caching with 5min TTL
- Add flight category calculations (VFR/MVFR/IFR/LIFR)
- Update shared-SDK exports and README

Closes Aviation-dx3
```

---

## Post-Merge Integration (Stream 6)

**Issue:** Aviation-a5f  
**Branch:** `feature/migrate-accident-tracker`  
**Dependencies:** Streams 2, 3, 4 must complete first

After all extraction streams complete, integrate shared SDK into accident-tracker:

1. Add shared-SDK dependencies
2. Replace stub airport lookup → use shared airports
3. Add weather integration → use shared weather
4. Add map display → use shared map components
5. Use navigation for distance calculations

---

## Progress Tracking

### Status Dashboard

| Stream | Issue | Status | Branch | Progress | ETA |
|--------|-------|--------|--------|----------|-----|
| 1 - Airports | Aviation-o2d | ✅ Complete | merged | 100% | Done |
| 2 - Weather | Aviation-dx3 | 🟡 Ready | - | 0% | 6-8h |
| 3 - Navigation | Aviation-ywm | 🟡 Ready | - | 0% | 4-6h |
| 4 - Map | Aviation-r2l | 🟡 Ready | - | 0% | 6-8h |
| 5 - Calendar | Aviation-5o5 | 🟡 Ready | - | 0% | 5-7h |
| 6 - Integration | Aviation-a5f | ⏸️ Blocked | - | 0% | 2-3d |

### Commands to Check Status

```bash
# See all ready issues
bd ready --json

# Check specific issue status
bd show Aviation-dx3

# List all in-progress issues
bd list --status in_progress

# Sync with git
bd sync
```

---

## For AI Agents

### Starting a New Stream

```bash
# 1. Check out new branch
git checkout -b feature/extract-<feature>

# 2. Claim the issue
bd update <issue-id> --status in_progress --json

# 3. Create directory structure
mkdir -p packages/shared-sdk/src/aviation/<feature>
mkdir -p packages/shared-sdk/python/aviation

# 4. Begin implementation
# Follow the scope and files listed above

# 5. Build and test
npm run build
# npm test (when tests are set up)

# 6. Update exports
# Add to packages/shared-sdk/src/index.ts

# 7. Update README
# Add examples and API reference

# 8. Commit
git add -A
git commit -m "feat(shared-sdk): Extract <feature> from <app>

Closes <issue-id>"

# 9. Close issue
bd close <issue-id> --reason "Extracted to shared-SDK with TS and Python"

# 10. Ready for merge
git push origin feature/extract-<feature>
```

### Coordination Between Agents

- **Communication:** Use issue comments or bd notes
- **Conflict Prevention:** Stick to assigned directories
- **Shared Files:** `index.ts` and README - add incrementally
- **Dependencies:** Check `bd show <issue>` for blockers

---

## Timeline Projection

**Sequential (1 agent):** ~25-35 hours (~3-4 days)

**Parallel (4 agents):** ~6-8 hours (~1 day)
- Stream 2 (Weather): 6-8h
- Stream 3 (Navigation): 4-6h (finishes first)
- Stream 4 (Map): 6-8h
- Stream 5 (Calendar): 5-7h

**Speedup:** ~4x faster with parallel execution

---

## Risk Mitigation

### Potential Issues

1. **Merge Conflicts in `index.ts`**
   - Risk: Low (easy to resolve)
   - Solution: Add exports in alphabetical order

2. **Dependency Conflicts**
   - Risk: Low (different dependencies per stream)
   - Solution: Run `npm install` after merging map patterns

3. **Data File Collisions**
   - Risk: None (different data per stream)

4. **Build Failures**
   - Risk: Medium (TypeScript errors)
   - Solution: Each stream must verify build before committing

### Quality Gates

Before merging any stream:
- ✅ TypeScript builds without errors
- ✅ No linter errors
- ✅ Exports added to `index.ts`
- ✅ README updated with examples
- ✅ Python version created (if applicable)
- ✅ Issue closed in bd
- ✅ Commit message follows format

---

## Success Criteria

### Individual Stream Success
- ✅ Feature extracted from source app
- ✅ TypeScript implementation complete
- ✅ Python implementation complete (if applicable)
- ✅ Builds successfully
- ✅ Exported from shared-SDK
- ✅ Documented in README
- ✅ Issue closed

### Overall Project Success
- ✅ All 5 extraction streams complete
- ✅ accident-tracker successfully migrated
- ✅ All apps can use shared SDK
- ✅ No code duplication
- ✅ Consistent API across apps
- ✅ Performance maintained or improved

---

## Getting Started

**To begin Stream 2 (Weather):**
```bash
git checkout -b feature/extract-weather-services
bd update Aviation-dx3 --status in_progress
# Start extracting weather services...
```

**To begin Stream 3 (Navigation):**
```bash
git checkout -b feature/extract-navigation-utils
bd update Aviation-ywm --status in_progress
# Start extracting navigation utilities...
```

**To begin Stream 4 (Map):**
```bash
git checkout -b feature/extract-map-patterns
bd update Aviation-r2l --status in_progress
# Start extracting map patterns...
```

**To begin Stream 5 (Calendar):**
```bash
git checkout -b feature/extract-google-calendar
bd update Aviation-5o5 --status in_progress
# Start extracting calendar integration...
```

---

## Questions?

- **Check issue details:** `bd show <issue-id>`
- **See blockers:** Look at "Depends on" field
- **Update status:** `bd update <issue-id> --status <new-status>`
- **Report problems:** Add notes with `bd update <issue-id> --notes "Issue description"`

---

**Last Updated:** 2026-01-14 (after completing Aviation-o2d)  
**Next Update:** After first parallel stream completes
