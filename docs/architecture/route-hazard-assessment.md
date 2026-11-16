# Route, altitude and time hazard assessment

Behavioral authority for [#491](https://github.com/jordanhubbard/Aviation/issues/491), under #488. Combine sourced weather advisories, FAA airspace, public TFR geometry, digital obstacles and sampled terrain against a requested route with planned UTC timing and altitude. This is reference planning assistance; a result must never assert that a route is safe, clear of all obstacles, legally cleared or a complete NOTAM briefing. FAA NOTAM access remains a separate pending entitlement.

## Request and route model

Accept two or more bounded WGS84 waypoints with explicit UTC arrival times and altitude in feet MSL at each waypoint. The planner may derive those inputs from an existing plan only when the user supplies departure time and valid speed/altitude inputs; show derived times before assessment. Reject ambiguous antipodal legs, invalid coordinates, nonfinite values, nonmonotonic times and resource-exceeding routes. Preserve climb/descent between waypoints. Geometry sampling uses the shared navigation SDK's minor great-circle arcs, distance and destination primitives, with explicit maximum spacing and sample-count limits. Position, elapsed time and altitude correspond along each leg. UTC timestamps require a zone. Pressure levels, MSL and AGL remain distinct references; do not convert flight levels using a sea-level identity assumption.

Evaluate hazards during the time spent inside the intersected geometry, rather than at departure or an entire leg's midpoint. Distinguish a centerline intersection from proximity within a requested corridor. Polygon holes and multipart geometry must not be flattened into incorrect filled regions; antimeridian routes/geometries must not become trans-world segments. Preserve provider geometry, timing and vertical reference alongside translated values. Shared aviation hazard/navigation contracts own reusable domain geometry, altitude and temporal behavior; application adapters own provider translation, requests, limits, orchestration and presentation. Extend common contracts with conformance evidence when they lack required behavior rather than cloning their existing algorithms.

## Sources and applicability

Use current fixed official origins, existing acquisition/cache/provenance conventions and server-side credentials. Bound source queries and preserve explicit pagination/truncation and rejected/unsupported record counts. Partial provider failures return independent source statuses and useful remaining evidence. Never turn unavailable, outside-coverage, expired or uninterpretable data into a no-hazard result.

- AWC SIGMETs, G-AIRMETs and CWAs retain raw records and observation/issue/validity times. G-AIRMET forecast snapshots and freezing-level contours are not interchangeable with continuous active-area warnings. Variable freezing-level bases, unknown geometry widths and uncertain altitude datums remain possible applicability or uninterpreted records, not assumed zero or unlimited safe exclusions. Current JSON `geom` and `geometryType` may disagree; record this uncertainty.
- FAA Class Airspace geometry retains upper/lower value, unit/reference code, exclusions and published operating-hour remarks. A geometrical class-airspace encounter is a planning requirement, not proof of an unauthorized incursion. Unknown schedules/AGL surfaces require explicit uncertainty.
- Public FAA TFR WFS geometry and list summaries are complementary. Match by published identity, preserve raw schedules and vertical constraints and link the full published text. A list summary alone cannot establish a route intersection; missing/unmatched geometry remains unknown coverage. Full NOTAM coverage is unavailable.
- FAA Digital Obstacle File uses source elevation and units without inventing elevations from AGL. Preserve accuracy, type and publication information. It is not a census of every possible obstruction. Incomplete result pagination is explicit.
- Terrain uses existing actual-provider provenance and a bounded profile. Report sampled clearance against a user-visible margin and identify missing elevations and gaps between samples. Do not claim a continuous maximum or terrain clearance from endpoint elevations alone.

## Response and interface

Expose typed HTTP and MCP discovery for a route assessment. Return the exact requested/derived route, SHA-256-identified shared source geometries, intersections with entry/exit position/time/leg and altitude applicability, proximity encounters, sampled terrain clearances, unassessed candidates, per-source coverage/status, source links, retrieval times and limitations. Identify why a candidate was excluded only when geometry, time and altitude evidence supports exclusion. Use `intersects`, `possible` and `unassessed` semantics rather than a global safe boolean.

Integrate an assessment action into Flight Planner and an independently usable route form. Desktop/mobile views show route timing/altitude, encountered hazards, source geometry on the map, source coverage and uncertainty together. Keep existing plan, weather, approval and dispatch state. Failed or superseded requests must not replace a newer route assessment; users can retry explicitly. Relevant consuming applications use stable gateway behavior rather than direct credential-bearing provider calls. The shared aviation review panel links to the standalone assessment form with all 2–50 validated airport identifiers in route order. URL context prepares form inputs only: no automatic lookup or assessment. A single or malformed airport selection links to the default form without a route query. The assessment form resolves the complete airport sequence and displays a draft with explicit departure, assumed groundspeed and MSL altitude before assessment. The gateway admits only the assessment read-only POST operation for existing aviation consumer origins, strips credentials and preserves its existing restrictions for other operations.

## Acceptance

Prove crossing/noncrossing, entry/exit timing (including an advisory becoming active inside a leg), climb/descent altitude overlap, datums/units, polygon holes/multipart/antimeridian behavior, zero-length/time validation, partial providers, source truncation, variable freezing levels, missing elevations and stale responses. Exercise real sourced routes, actual HTTP/gateway/MCP parity and rendered desktop/mobile interactions. Refresh retained authority/receipts and locks as required, pass exact-head and exact-main CI, review/merge, deploy and admit hosted evidence before closing #491.

## Official references

- [AWC current API and schemas](https://aviationweather.gov/data/api/)
- [FAA Class Airspace](https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/arcgis/rest/services/Class_Airspace/FeatureServer/0)
- [FAA public TFR WFS capabilities](https://tfr.faa.gov/geoserver/TFR/ows?service=WFS&version=2.0.0&request=GetCapabilities)
- [FAA Digital Obstacle File](https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/dof/)

Identical profile responses retain their original assessment time for a bounded 60-second cache interval. Source loaders execute outside the cache metadata lock; concurrent misses for the same key share one result/failure, while composite worker requests for different keys can proceed. Geometry is returned once per content identity to preserve full source shapes within bounded HTTP/MCP responses. Findings and unassessed output caps are explicit.
