# General aviation API and MCP contract

Tracked in GitHub issue #444. The retained Flight Planner owns provider adapters and
HTTP presentation; portable aircraft/navigation calculations remain in the common SDK.

- `/api/openapi.json` describes real domain operations and their request/response
  schemas. Meta App advertises this schema in its catalog and exposes it through
  `aviation://v1/planning/openapi`. Generic request tools remain compatible.
- `/api/aircraft` and `/api/aircraft/{identifier}` expose the SDK's bounded catalog,
  bundled operating profiles and cited manufacturer reference conditions. No profile
  is guessed for an unknown model. No maximum cruise value is an aircraft-specific
  performance prediction.
- `/api/performance` computes wind correction, heading, ground speed, trip fuel,
  reserve/endurance/range and pressure/density altitude from explicit unit-named
  caller inputs using the SDK. Impossible winds and non-finite/invalid inputs fail.
- Airport details include sourced runways/frequencies (OurAirports) and US fuel,
  repairs and transient facilities (FAA NASR via US DOT NTAD). Preserve source date,
  fetch time, raw service codes and explicit unknowns; no fuel price, opening hours,
  FBO names or availability is fabricated. Provider failure is distinct from no data.
- Geographic layers are bounded GeoJSON with longitude/latitude coordinate order:
  airports, navigation aids, and FAA airspace. Airport maps exclude closed sites by
  default. No truncation silently implies complete coverage.
- NOAA aviation observations, TAFs, PIREPs and advisories retain provider records and
  timestamps. Empty results mean no reports, not a successful safety assessment.
- Cloud coverage percentage cannot establish an observed ceiling. Without an actual
  ceiling/visibility observation, the planner reports unknown flight category rather
  than passing an estimated ceiling as measured. Terrain responses name the actual
  provider and elevation units; missing samples never establish terrain clearance.
- Deterministic API tests must exercise calculations against independent examples,
  malformed and empty provider responses, spatial/size limits, unknown aircraft and
  explicit provenance. Hosted verification uses MCP for substantive data and HTTP
  for schema parity, with receipts identifying the deployed revision.

The public `/api/restrictions/tfr` endpoint additionally exposes the FAA TFR list,
optionally filtered by state. Preserve NOTAM IDs and provider descriptions without
claiming route intersection, currently-active-only filtering or full NOTAM coverage.

`/api/performance/table` bilinearly interpolates a complete caller-supplied
pressure-altitude/temperature grid at one declared weight/configuration. It supports
POH takeoff/landing ground roll or distance over 50 feet and climb-rate values.
Reject duplicate/incomplete grids and all extrapolation. Preserve caller source
edition/page/applicability as unverified input authority; infer no wind, runway,
surface, slope or weight corrections and never describe synthetic test grids as
published aircraft data.
