---
id: Aviation-sv9
status: closed
deps: []
links: []
created: 2026-01-13T15:21:16.974723-08:00
type: task
priority: 2
mac-task-id: task_b2067d6a41224408ab96a37d357a8048
---
# EPIC: Extract shared aviation data services to common SDK

**Epic: Shared Code Extraction**

Extract common aviation data services from individual apps into shared SDK packages for reuse across the monorepo.

**Scope:**
- Airport database and search (from flightplanner)
- Weather services (OpenWeatherMap, Open-Meteo, METAR)
- Navigation calculations (haversine, coordinates)
- Map utilities (Leaflet integration patterns)
- Google Calendar integration (from flightschool)
- ForeFlight API client (from foreflight-dashboard)

**Goals:**
1. Eliminate code duplication
2. Centralize API key management
3. Standardize data models
4. Improve maintainability
5. Enable shared caching strategies

**Success Criteria:**
- All common code extracted to packages/
- All apps migrated to use shared code
- 100% feature parity maintained
- All tests passing
- All apps building successfully

**Child Stories:**
- Airport services extraction
- Weather services extraction
- Navigation utilities extraction
- Map integration patterns
- Calendar integration
- API clients consolidation

**Estimated Effort:** 2-3 weeks
