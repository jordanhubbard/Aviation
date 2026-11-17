# Current aviation charts and navigation cycles

Behavioral authority for [#490](https://github.com/jordanhubbard/Aviation/issues/490), under #488. The retained planner owns FAA transport, storage, chart rendering and API/UI presentation. The shared `aviation.nav-data` contract owns normalization, catalog selection and freshness; provider adapters do not introduce a parallel navigation catalog.

## Sources, dates and identity

Discover current and next editions from official FAA publication pages, rather than guessing the active cycle from a calendar date. Ingest d-TPP XML airport/procedure/diagram catalogs and VFR/IFR chart download tables; preserve exact airport identifiers, chart names, kinds, formats, source URLs and UTC effective/expiration metadata. Do not invent ICAO codes from FAA identifiers. Preserve originals and SHA-256 identities, acquisition time and dated source snapshots. Publication end instants are exclusive and use the shared navigation SDK's `effective_until` metadata; adapters do not subtract precision-dependent offsets or implement separate freshness arithmetic. Future, expired, undated, source-unavailable and cached-unverified states are distinct from current. A failed refresh retains acquired originals and labels stale discovery explicitly. Expose calendar `edition_freshness` separately from `verification_state` and the latest source-check time. Only an in-date edition with a successful source check no more than 24 hours old may have combined `freshness=current`; missing/undated/future/old verification is `cached-unverified`, and a failed latest check is `source-unavailable`. Expired, future, undated and withdrawn edition states remain visible regardless of verification. Current navigation selection requires a verified in-date cycle; cached chart originals and pinned offline references remain accessible with their warnings. Current/next cycles coexist; updates never silently rewrite a pinned offline reference.

## Chart delivery and rendering

Expose searchable, paginated terminal/sectional/enroute catalogs, source links and download/cached-copy operations. Binary responses have explicit media types, original hashes and cache provenance. Downloads accept catalog IDs, not arbitrary caller URLs. Restrict acquisition to FAA HTTPS hosts and revalidate redirects. Bound payloads, ZIP entries/decompression, disk use, render size and tiles; reject unsafe archive paths. Original and extracted assets are immutable by hash.

Display complete PDF originals and available georeferenced raster charts. Reproject GeoTIFFs from their declared CRS to Web Mercator tiles; do not approximate rotated charts as unrotated geographic rectangles. Only the main chart body inside its neatline is accurately georeferenced according to FAA documentation; preserve original margins and expose these limits. Missing/invalid georeferencing remains explicit. Include cycle/source/expiration and refresh/download/error controls on desktop/mobile and stable HTTP/MCP schemas. Provide offline manifests for #493.

## Real navigation ingestion

Acquire the corresponding real FAA CIFP distribution and effective dates. Preserve raw records, continuation/route/transition identity, parser limitations and source checksums. Translate fixed-width records using a maintained ARINC parser and pass provider-neutral records to `aviation.nav-data`. Preserve constraints and unknowns; missing courses/altitudes must not become zero. Incomplete/special legs remain visible with their raw source, without claiming flyable guidance. Provider failure cannot fall back to samples. Synthetic catalogs remain available only when injected for tests/simulation. The VFR form stays free of instrument-procedure inputs; chart/navigation browsing is separate.

## Application consumers

G1000 procedure browsing consumes the same sourced navigation service as the
planner. Replace hard-coded procedure names and production sample defaults;
keep sample catalogs available through explicit test/simulator injection only.
Both the visible browser and legacy procedure API preserve cycle/source metadata,
verification failures, pagination, unknown constraints and incomplete guidance.
An unavailable provider or unverified cycle produces an explicit unavailable
state, without silently substituting sample procedures or an empty success.
Loading a different airport invalidates earlier responses; requests remain owned
through body reads and are cancelled when the user leaves that scope. Browsing
does not activate a flight plan or turn incomplete records into flight guidance.

Planning and preflight workflows provide a discoverable chart/navigation handoff
that carries the selected airport when known. Airport identifiers retain their
published meaning; a missing ICAO association is never guessed. These consumers
use the existing stable HTTP/MCP boundary rather than maintaining independent FAA
downloads, navigation catalogs or freshness calculations. Verify actual source
records, unavailable/stale states and desktop/mobile interactions in each flow.

## Acceptance

Exercise real FAA catalogs and selected originals; independent fixture rollover/failure cases; unsafe downloads/archives; byte identity; CRS/tile reference points; real CIFP records and SDK normalization; HTTP/MCP parity; desktop/mobile viewing and source/expiry visibility. Current receipt/locks, CI, reviewed merge and exact-image live deployment remain required. An index-only or source-registry-only change does not complete #490.

## Public source references

- [FAA d-TPP](https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/dtpp/)
- [FAA VFR raster charts and georeferencing limits](https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/vfr/)
- [FAA IFR enroute charts](https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/ifr/)
- [FAA CIFP distributions](https://www.faa.gov/air_traffic/flight_info/aeronav/digital_products/cifp/download/)

Selecting a chart places its source details and viewer before the result list, including on mobile; users must not traverse the complete catalog page to reach the selected chart.
