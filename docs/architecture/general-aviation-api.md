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

## Route terminal forecasts

Tracked in GitHub issue #447. Flight Planner route weather cards show TAFs alongside
METARs for every unique airport in the planned route, including the destination
when there are more than four airports. TAF queries use the existing typed
`GET /api/aviation-weather/taf?airport=ICAO` operation (also accessible through MCP),
independently of current weather and daily forecasts. Preserve complete raw TAF
text, station, issue time, validity interval and provider/retrieval provenance.
Display times in UTC and keep missing timestamps unknown. Distinguish loading,
no reports for the requested station, provider failure and missing raw text. Do not
substitute a nearby station or general daily forecast as that airport's TAF.

## Route briefings and source access

Tracked in GitHub issue #449. `POST /api/aviation-weather/route` SHALL accept either
2–50 airport identifiers or 2–100 WGS84 latitude/longitude points, a 1–100 NM
corridor and a bounded station limit. Resolve airport coordinates explicitly,
measure proximity against every minor great-circle leg (including the dateline),
and reject ambiguous antipodal legs. Discover TAF-capable stations using NOAA's
daily global station catalog, including airports near the route that are not
waypoints. Keep requested airports explicit even when they do not issue TAFs.
Return station coordinates, closest leg, along-route progress, cross-track distance,
full original NOAA TAFs/forecast periods and optional METARs. Batch station requests;
report each station/product's no-report and error status separately. Keep actual
provider timestamps and retrieval provenance. An optional timezone-aware validity
instant selects overlapping forecast periods and labels out-of-window/unknown
forecasts without manufacturing future weather. Never silently truncate stations
or provider results or infer safe conditions from missing data.

`GET /api/aviation-weather/stations` SHALL offer bounded station discovery around a
point, with optional TAF-only filtering. Existing station weather APIs remain stable.
`GET /api/aviation-data/sources` SHALL enumerate supported sources, operations,
coverage, authentication readiness, licensing and limitations without exposing keys.
New source adapters SHALL expose bounded openAIP airport/airspace/navaid/reporting
point collections, NWS point alerts and forecasts, FAA NAS airport-event records,
NOAA center weather advisories, and Open-Meteo modeled pressure-level winds through
typed HTTP schemas. Preserve the latter's actual pressure levels, UTC times and units;
never label modeled winds as NOAA FD tables or fixed flight-level observations.
NOAA retired the legacy wind/temp table service in November 2026.
All operations SHALL be discoverable and callable through the existing planning
MCP schema resource, describe tool and request tool, with the same bodies/statuses.

Read credentials through the planner's existing server-side settings/keystore
boundary. Do not read workstation credential files from application runtime or
send credentials in URLs. Preserve openAIP attribution and CC BY-NC 4.0 terms;
reject a changed license until reviewed. Unconfigured authenticated sources fail
explicitly; provider errors must never fall back to invented or mock records.
Fixed provider origins, bounded payloads/pages/caches and sanitized errors apply.
Source discovery reports configuration, not a live availability or safety verdict.

See the [source inventory and access decisions](aviation-data-sources.md) for the
verified provider contracts, credential coverage and integration boundaries.
