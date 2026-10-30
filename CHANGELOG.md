# Changelog

## Unreleased

- Promoted navaids, procedures, airspace ingestion, provenance, and freshness into an
  `aviation.nav-data` Component with shared TypeScript/Python acceptance vectors;
  Flight Planner and G1000 now delegate their common navigation-data catalogs to the
  SDK.
- Promoted METAR parsing, flight categories, provider normalization, forecast access,
  and departure-window scoring into an `aviation.weather` Component with shared
  TypeScript/Python acceptance vectors; Flight Planner now delegates its common
  weather services to the SDK.
- Promoted airport identity, normalization, lookup, search, proximity, and field
  elevation into an `aviation.airports` Component with shared TypeScript/Python
  acceptance vectors; Flight Track Analyzer now consumes SDK-normalized airport data.
- Began the common Aviation SDK migration with a native `aviation.navigation`
  Component, shared TypeScript/Python conformance vectors, independently runnable
  SDK tests, and a dedicated common-SDK CI workflow.
- Flight Planner no longer crashes when procedure data is unavailable or malformed; mission planning keeps the procedure selector usable and shows a nonfatal unavailable state.
- Accident Tracker now shows source citations and last successful sync, classifies NTSB operations, offers readable filters, and turns plain-language searches into supported filters without an external token.
- Aviation Missions now stores written feedback on individual completed missions and shows comments under each completion.
- Every Aviation application now has a feedback button that files a contextual issue in the Aviation repository; the button is included in deployed browser checks.
- Preflight Check adds aircraft-specific weight and balance calculations for takeoff and landing, plus a local PAVE risk checklist and a Meta App launch link.
- Meta App now lists only pilot-facing applications; the Aviation Chat API remains available to applications without appearing as a launcher card.
- Flight Planner opens on its planning form and empty state without unrelated G1000 demo controls or a sample canvas.
- Meta App links to all ten other deployed Aviation applications, with a manifest-based browser check for missing destinations.
- Accident Tracker labels explicit accident mechanisms from NTSB probable-cause data and matched reports, shows Unknown when no cause is supported, and links each classification to its source.
- Accident Tracker discovers matching publisher headlines during ingestion, stores citation titles and links, and expands citations beneath each event row.
- Flight Planner loads saved plans from its deployed API route and rejects invalid responses; Aviation Chat explains its API-only role at its root URL.
- Deployment verification now renders all eleven public application roots in Chromium and checks key Accident Tracker, Flight Planner, and Chat interactions.
- ForeFlight Dashboard accepts solo time that overlaps PIC time and verifies a synthetic logbook upload in the post-deployment browser gate.
- ForeFlight Dashboard no longer rejects rapid pattern-work landing counts based on a fixed four-minute-per-landing assumption; post-deployment browser checks cover eight landings in half an hour.
- ForeFlight Dashboard invalid aircraft type guidance now points to ICAO's current Doc 8643 search page instead of obsolete references.

- Restored the Aviation deployment workflow after source relocation: all four image builds and the staging dry run pass on main.

- Adopted the Aviation monorepo into Literate AI with retained application entrypoints, current locks, and retained test evidence.
- Integrated Flight Track Analyzer with bundled airport MSL elevations to support calibrated touchdown detection, plus API, UI, tests, and CI.
- Updated retained dependencies to resolve Trivy findings reported during the conversion.

- Initialized the project with Literate AI's specification-led lifecycle and durable
  user-directed work queue.
