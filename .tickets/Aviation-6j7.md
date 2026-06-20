---
id: Aviation-6j7
status: closed
deps: []
links: []
created: 2026-01-13T15:14:19.614592-08:00
type: task
priority: 2
mac-task-id: task_d7c56427a5804156841bc0110a7e2358
---
# Implement airport lookup service (ICAO/IATA geo)

**Epic: Geo - Critical**

Implement airport database lookup for geocoding accidents/incidents.

**Requirements:**
- Load/cache airport database (ICAO/IATA codes)
- Lookup function: ICAO/IATA → (lat, lon, country, region, name)
- Support partial/fuzzy matching
- Reverse geocoding fallback when no airport given
- Consider using existing dataset (OurAirports, OpenFlights)
- Cache frequently accessed airports
- Handle missing/invalid codes gracefully

**Acceptance Criteria:**
- [ ] Airport database loaded (at least major airports)
- [ ] ICAO lookup works (e.g., KSFO → 37.619, -122.375)
- [ ] IATA lookup works (e.g., SFO → KSFO → coords)
- [ ] Returns country and region
- [ ] Caching implemented
- [ ] Unit tests for lookup
- [ ] Handles invalid codes gracefully
- [ ] Documentation for data source

**Blocks:** Map visualization (needs coordinates)
**Priority:** P0 - MVP blocker

## Notes

Airport lookup loads airports.json dataset with caching + fuzzy match; reverse lookup fallback.
