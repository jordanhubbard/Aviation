# Implementation Specs for Shared Code Extraction

This directory contains detailed technical specifications for extracting shared aviation code from existing applications into reusable SDK packages.

---

## Overview

These specs support the **Incremental Execution Plan (Option B)**, which extracts shared code into new packages and integrates them into the accident-tracker first, before migrating existing applications.

---

## Specifications

### 1. [Airports Extraction](./AIRPORTS_EXTRACTION_SPEC.md)
**Bead:** [Aviation-o2d] ⭐ P0 - MVP Blocker  
**Effort:** 2-3 days  
**Dependencies:** None

**What:**
- Extract airport database loading and search from flightplanner
- Create `@aviation/shared-sdk/aviation/airports` module
- Support ICAO/IATA lookup, text search, proximity search
- Port `airports_cache.json` (68K+ airports)

**Key Features:**
- `getAirport(code)` - Lookup by ICAO/IATA
- `searchAirports(query, limit)` - Text search
- `searchAirportsAdvanced(options)` - Proximity search
- `haversineDistance()` - Distance calculation
- TypeScript + Python wrappers

**Deliverables:**
- TypeScript implementation with tests
- Python wrapper with tests
- Singleton pattern for easy import
- Documentation with examples
- Performance: <10ms per search

---

### 2. [Weather Services Extraction](./WEATHER_EXTRACTION_SPEC.md)
**Bead:** [Aviation-dx3] ⭐ P0 - MVP Blocker  
**Effort:** 3-4 days  
**Dependencies:** Aviation-o2d (for coordinate lookup)

**What:**
- Extract weather services from flightplanner
- Create `@aviation/shared-sdk/aviation/weather` module
- Support OpenWeatherMap, Open-Meteo, METAR
- Flight category calculations (VFR/MVFR/IFR/LIFR)

**Key Features:**
- `OpenWeatherMapClient` - Current weather via OWM API
- `OpenMeteoClient` - Forecast and route weather
- `MetarClient` - METAR fetching and parsing
- `calculateFlightCategory()` - VFR/IFR classification
- `WeatherCache` - 5-10min TTL caching

**External APIs:**
- OpenWeatherMap (API key from keystore)
- Open-Meteo (free, no key)
- AviationWeather.gov (free, no key)

**Deliverables:**
- All weather clients implemented
- Caching with TTL
- API key management via keystore
- Rate limiting handled
- TypeScript + Python wrappers
- Documentation and tests

---

### 3. [Navigation Utilities Extraction](./NAVIGATION_EXTRACTION_SPEC.md)
**Bead:** [Aviation-ywm] ⭐ P0 - MVP Blocker  
**Effort:** 2 days  
**Dependencies:** None

**What:**
- Extract navigation calculations from flightplanner
- Create `@aviation/shared-sdk/aviation/navigation` module
- Distance, bearing, coordinate utilities, T/S/D calculations

**Key Features:**
- `haversineDistance()` - Great circle distance (NM, SM, KM)
- `initialBearing()`, `finalBearing()` - Course calculations
- `calculateGroundSpeed()` - Wind correction
- `solveTSD()` - Time/speed/distance problems
- Coordinate validation and formatting (DMS, decimal)

**Deliverables:**
- All navigation functions implemented
- 100% test coverage (critical code)
- Precision validated (<0.1% error)
- Performance: <1ms per calculation
- TypeScript + Python wrappers
- Documentation with aviation examples

---

### 4. [Map Integration Extraction](./MAP_EXTRACTION_SPEC.md)
**Bead:** [Aviation-r2l] ⭐ P0 - MVP Blocker  
**Effort:** 3-4 days  
**Dependencies:** None (but benefits from airports and navigation)

**What:**
- Extract Leaflet map patterns from flightplanner
- Create `@aviation/ui-framework/map` module
- Reusable React components for maps

**Key Features:**
- `<BaseMap>` - Core map component with OpenStreetMap
- `<Marker>` - Markers with popups and tooltips
- `<MarkerCluster>` - Efficient clustering for many markers
- `<Polyline>` - Route drawing and visualization
- `useMapState()` - React hook for map state management

**Deliverables:**
- All React components implemented
- Marker clustering functional
- Responsive design (mobile-friendly)
- Accessibility (keyboard navigation)
- Performance: 60fps rendering
- Component tests (>70% coverage)
- Documentation with examples

---

## Package Architecture

### Target Structure

```
packages/
├── shared-sdk/                      # Backend utilities
│   ├── src/aviation/
│   │   ├── airports/               # Airport database and search
│   │   ├── weather/                # Weather services
│   │   └── navigation/             # Navigation calculations
│   ├── python/aviation/            # Python wrappers
│   └── data/
│       └── airports_cache.json     # Airport database
│
└── ui-framework/                    # Frontend components
    ├── src/map/                    # Map integration
    │   ├── BaseMap.tsx
    │   ├── Marker.tsx
    │   ├── MarkerCluster.tsx
    │   ├── Polyline.tsx
    │   └── useMapState.ts
    └── styles/
        └── map.css
```

---

## Implementation Order

### Phase 1: Airports (Week 1, Days 1-3)
1. [Aviation-o2d] Extract airports to shared SDK
2. [Aviation-a5f] Integrate into accident-tracker

**Why First:**
- No dependencies
- Needed by weather and accident-tracker
- Relatively simple extraction
- Quick win for validation

---

### Phase 2: Weather (Week 1-2, Days 3-7)
1. [Aviation-dx3] Extract weather services
2. [Aviation-a5f] Integrate into accident-tracker (optional)

**Why Second:**
- Depends on airports (for coordinate lookup)
- More complex (3 APIs, caching, parsing)
- Optional for accident-tracker MVP

---

### Phase 3: Navigation (Week 2, Days 1-2)
1. [Aviation-ywm] Extract navigation utilities
2. [Aviation-a5f] Integrate into accident-tracker

**Why Third:**
- No dependencies
- Needed for distance calculations
- Critical for proximity searches
- High precision requirements

---

### Phase 4: Map (Week 2-3, Days 3-6)
1. [Aviation-r2l] Extract map components
2. [Aviation-58s] Integrate map into accident-tracker

**Why Last:**
- Most complex (UI components, state management)
- Benefits from airports and navigation being available
- Critical for accident-tracker MVP

---

## Testing Strategy

### Coverage Targets

| Component | Target | Rationale |
|-----------|--------|-----------|
| Airports | >80% | Business logic, search algorithms |
| Weather | >80% | API integration, parsing, caching |
| Navigation | 100% | Critical calculations, precision |
| Map | >70% | UI components harder to test |

### Test Types

1. **Unit Tests**
   - Pure functions
   - Business logic
   - Calculations

2. **Integration Tests**
   - API clients (mocked)
   - Cache behavior
   - Component integration

3. **Performance Tests**
   - Search: <10ms
   - Distance: <1ms
   - Map rendering: 60fps

4. **Precision Tests**
   - Navigation: <0.1% error
   - Known test cases
   - Edge cases (poles, dateline)

---

## API Key Management

### Required API Keys

1. **OpenWeatherMap**
   - Key: `OPENWEATHERMAP_API_KEY`
   - Source: flightplanner (already exists)
   - Storage: keystore
   - Usage: Weather services

2. **Stadia Maps** (Optional)
   - Key: `STADIA_MAPS_API_KEY`
   - Usage: Alternative map tiles
   - Storage: keystore

### Configuration

```typescript
// API keys loaded from keystore
import { createSecretLoader } from '@aviation/keystore';

const secrets = createSecretLoader('shared-sdk');
const apiKey = secrets.getRequired('OPENWEATHERMAP_API_KEY');
```

---

## Migration Strategy

### For Accident-Tracker (Week 3)

**Integration Steps:**
1. Add `@aviation/shared-sdk` dependency
2. Add `@aviation/ui-framework` dependency
3. Replace stub implementations:
   - Airport lookup → `getAirport()`
   - Distance calculations → `haversineDistance()`
   - Map → `<BaseMap>` + `<MarkerCluster>`
4. Add weather (optional)
5. Test integration
6. Verify feature parity

**Benefits:**
- No code duplication
- Production-ready utilities
- Tested and validated
- Better performance

---

### For Flightplanner (Week 4-5)

**Migration Steps:**
1. Update imports to use shared SDK
2. Remove local implementations:
   - Delete `app/models/airport.py`
   - Delete `app/services/openweathermap.py`
   - Delete `app/services/metar.py`
   - Update frontend map components
3. Run full test suite
4. Verify feature parity
5. Performance benchmarks

**Validation:**
- 100% tests passing
- Build successful
- No regressions
- Performance maintained

---

## Success Metrics

### Extraction Complete When:
- [ ] All TypeScript implementations done
- [ ] All Python wrappers done
- [ ] All tests passing (coverage targets met)
- [ ] Documentation complete
- [ ] Performance benchmarks met
- [ ] Ready for integration

### Integration Complete When:
- [ ] Accident-tracker using shared code
- [ ] All features working
- [ ] Tests passing
- [ ] No code duplication
- [ ] Performance acceptable

### Migration Complete When:
- [ ] All apps using shared SDK
- [ ] All local code removed
- [ ] 100% CI/CD green
- [ ] Feature parity confirmed
- [ ] Production ready

---

## Documentation Standards

### Each Spec Includes:

1. **Overview**
   - What's being extracted
   - Current implementation location
   - Target package structure

2. **API Design**
   - TypeScript interfaces
   - Function signatures
   - Usage examples

3. **Implementation Details**
   - Key algorithms
   - Data structures
   - Performance considerations

4. **Testing Requirements**
   - Coverage targets
   - Test types
   - Performance benchmarks

5. **Migration Path**
   - Step-by-step process
   - Integration steps
   - Validation criteria

6. **Acceptance Criteria**
   - Clear success metrics
   - Quality gates
   - Timeline

---

## Quick Reference

### Starting Implementation

```bash
# 1. Read the spec
cat specs/AIRPORTS_EXTRACTION_SPEC.md

# 2. Start the bead
bd start Aviation-o2d

# 3. Create package structure
cd packages/shared-sdk
mkdir -p src/aviation/airports

# 4. Implement per spec
# ... code ...

# 5. Run tests
npm test

# 6. Update bead
bd done Aviation-o2d
```

### Using in Accident-Tracker

```typescript
// Import from shared SDK
import { getAirport, searchAirports } from '@aviation/shared-sdk';
import { BaseMap, MarkerCluster } from '@aviation/ui-framework';

// Use in code
const airport = await getAirport('KSFO');
const nearby = await searchAirports('San Francisco', 10);
```

---

## Timeline Summary

| Week | Phase | Beads | Deliverables |
|------|-------|-------|--------------|
| 1 | Airports + Weather | o2d, dx3, a5f | Shared SDK with airports & weather |
| 2 | Navigation + Map | ywm, r2l | Complete shared SDK + UI framework |
| 3 | Integration | 58s, 6f2, czw, gil, 82s | Accident-tracker MVP with shared code |
| 4-5 | Migration | b8m, st5, others | All apps using shared SDK |
| 6-7 | Validation | 8m2 | 100% CI/CD green |

**Total: 6-7 weeks**

---

## Questions?

For detailed information on any extraction, see the individual spec files:
- [AIRPORTS_EXTRACTION_SPEC.md](./AIRPORTS_EXTRACTION_SPEC.md)
- [WEATHER_EXTRACTION_SPEC.md](./WEATHER_EXTRACTION_SPEC.md)
- [NAVIGATION_EXTRACTION_SPEC.md](./NAVIGATION_EXTRACTION_SPEC.md)
- [MAP_EXTRACTION_SPEC.md](./MAP_EXTRACTION_SPEC.md)

For the overall execution plan, see:
- [INCREMENTAL_EXECUTION_PLAN.md](../INCREMENTAL_EXECUTION_PLAN.md)

For the extraction analysis, see:
- [SHARED_CODE_EXTRACTION.md](../SHARED_CODE_EXTRACTION.md)

---

**Status:** Ready for implementation ✅  
**Last Updated:** 2026-01-13  
**Approach:** Option B - Incremental
