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
FAA NMS is a cache reader with separately selected environment and worker-owned
credentials; its report/status API establishes feed availability independently.

See the [source inventory and access decisions](aviation-data-sources.md) for the
verified provider contracts, credential coverage and integration boundaries.

The isolated planner lifecycle adapter SHALL admit only the declared station TAF
requests, supply run-tagged synthetic SDK fixtures, and assert full multiline TAF
text, UTC issue/validity windows and fixture provenance for both route airports.
Unexpected requests and foreign station IDs remain failures. These browser mocks
establish rendering/lifecycle behavior; the separate real-provider HTTP/MCP audit
establishes public data availability and API parity.

## Private aircraft document library

The planner hosts the [aircraft document knowledge service](aircraft-library.md) at
`/api/aircraft-library`. Its typed authenticated operations cover original PDF upload,
metadata/tail associations, document/page retrieval, source acquisition/discovery, durable
indexing/distillation jobs, full-text search and source-cited questions. Explicit
source/extraction-bound blank-page reviews and immutable audit history preserve
readable evidence and original identities; they are authenticated HTTP/MCP operations
with the same private/no-store policy. Library credentials
are separate from MCP transport credentials and must be supplied explicitly. Large original
PDFs use authenticated HTTP upload/download rather than the MCP response-size envelope.
These private operations are not admitted to the public credential-free cross-app data CORS path.

## FAA charts and current navigation

`/api/charts` provides status, paginated catalogs, chart detail, retained originals,
checksum-pinned members, PDF previews, georeferencing, map tiles and offline manifests.
Public reads serve FAA reference material. Chart records expose `edition_freshness`
separately from `verification_state` and `source_checked_at`. Combined `freshness`
is current only after a successful catalog check within 24 hours; otherwise a
calendar-current chart is `cached-unverified` or `source-unavailable`. These
values are also catalog filters. FAA cycle ends use the SDK exclusive
`effective_until` instant, while existing inclusive metadata stays compatible. Refresh and download mutations require an
operator bearer credential before body parsing. `/api/navigation/{airport}` selects
the unique current ingested FAA CIFP cycle through the shared navigation SDK and
preserves original records, special-leg omissions, constraints and unknown values.
The legacy procedure endpoint uses that same current catalog; missing or ambiguous
cycles fail explicitly. Binary chart responses use HTTP; gateway/MCP discovery uses
the planning OpenAPI contract. See [the behavior contract](charts-navigation.md).
## Timed route hazard assessment

`POST /api/route-assessment` accepts 2–50 waypoints with latitude/longitude, planned
time including timezone, and altitude in feet MSL; corridor proximity and a
terrain/obstacle clearance margin are explicit. Routes are bounded to 800 NM and
24 hours; profile interpolation and actual sample spacing are returned. The typed
response preserves original candidate fields, centerline/proximity encounters,
entry/exit times and altitudes, source statuses/URLs/retrieval times, geometry,
uncertainty, truncation and missing coverage. Common SDK interval operations own
planar geometry and linear time/altitude clipping; source adaptation and projection
remain planner concerns. Identical profile responses are cached for 60 seconds,
without relabeling original assessment/source times; concurrency is bounded.

The NOAA complete G-AIRMET cache preserves all published forecast snapshots and
explicit feet-MSL fields. It does not convert snapshots to invented continuous
validity periods or variable freezing levels to zero. TFR list identities are
joined to public geometry; absent geometry and uninterpreted schedules/vertical
limits stay explicit. FAA DOF queries follow actual nested GeoJSON pagination.
Neither these sources nor a successful assessment establishes safe/authorized
flight or full NOTAM coverage. See [the contract](route-hazard-assessment.md).

## Private flight-plan filing

The [Flight Service filing contract](flight-service-filing.md) owns typed private
`/api/filing` draft, validation, review/confirmation, provider lifecycle and receipt
operations. Source-backed provider states and uncertainty remain explicit.
Configuration or a saved/exported route does not establish provider filing success.
