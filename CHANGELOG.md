# Changelog

- Qualified planning IAS/TAS and ISA Mach conversions across the TypeScript and Python
  SDK bindings, with shared valid and fail-closed Component vectors.
- Qualified shared wind components and wind-triangle calculations across TypeScript
  and Python, and migrated Flight Planner's private wind arithmetic to the SDK.
- Removed unused G1000 and Flight Planner private geodesy service scaffolds now that
  realized route calculations are owned by the common Aviation navigation SDK.

## Unreleased

- Added an independently tested `aviation.aircraft` Component with a portable C172S
  operating profile shared by TypeScript and Python; G1000's airspeed tape now derives
  its color arcs and never-exceed marker from the SDK instead of private V-speed data.
- Added Component-owned pressure-altitude, ISA-temperature, and density-altitude
  vectors to both Aviation SDK language bindings; Flight Track Analyzer now delegates
  atmospheric normalization to the Python SDK while retaining entered-POH interpolation
  and measured-track comparison as application policy.
- Replaced G1000 Trip Planning's private flight-time, reserve-fuel, density-altitude,
  station-moment, and CG formulas with the TypeScript Aviation SDK and its shared C172
  profile; the application now retains only interactive state and presentation.
- Replaced G1000's private route-distance and initial-course formulas with the Python
  `aviation.navigation` realization while preserving route presentation and rounding.
- Removed five independent Flight Planner haversine implementations; route sampling,
  A* routing, local-airport planning, approach waypoints, and navigation helpers now
  delegate great-circle distance to the Python `aviation.navigation` realization.
- Promoted weight-and-balance loading and envelope interpolation into a tested
  `aviation.weight-balance` Component; Preflight Check now loads the built browser SDK
  realization instead of maintaining its own calculation module.
- Added configurable fuel-reserve vectors to `aviation.navigation`; Flight Planner now
  delegates route time, fuel consumption, reserve, and range arithmetic to the common
  SDK while retaining route selection, refueling stops, and response construction.
- Extended `aviation.flight-dynamics` with independently tested active/armed mode,
  capture, target-vertical-speed, and disconnect transitions; G1000 now delegates its
  flight-director state machine to the SDK while retaining simulator-specific capture
  thresholds, PID reset timing, limit annunciation, and stepping.
- Moved axis-controller, mode-transition, autotrim, and envelope-protection
  qualification into the independently tested `aviation.flight-dynamics` Component;
  Flight Planner now instantiates those common controllers directly instead of
  maintaining an app-local compatibility implementation.
- Added cross-language marker-beacon, audio-panel, and transponder models to
  `aviation.avionics`, including explicit site catalogs, bounded levels, octal squawk
  normalization, and deterministic IDENT timing; G1000 now delegates those models to
  the common SDK while retaining its simulator-specific catalog and orchestration.
- Added cross-language ADF and DME receiver models to `aviation.avionics`, including
  deterministic station selection, bearing/range geometry, service-volume behavior,
  and unavailable-signal handling; G1000 now delegates to the common models and shared
  navigation-data catalog instead of returning fixed-zero radio placeholders.
- Added cross-language, independently tested AHRS, ADC, and GPS models to
  `aviation.avionics`; G1000 and Flight Planner now delegate to the common Python
  realization, and the former zero/`None` placeholder APIs were removed.
- Promoted telemetry/command schemas, flight-plan exchange, display layout, render
  pipelines, and functional canvas primitives into an `aviation.avionics` Component
  with independent protocol/rendering tests; G1000 now consumes the shared telemetry
  types and runtime guards instead of maintaining its own full-snapshot schema.
- Promoted atmosphere, deterministic wind, aircraft performance/model validation,
  rigid-body integration, scalar physics, and autopilot PID primitives into an
  `aviation.flight-dynamics` Component with independently runnable acceptance
  vectors; Flight Planner delegates its duplicate formulas and PID state, while
  G1000 delegates bounded PID behavior and common C172 model data to the package.
- Promoted navaids, procedures, airspace ingestion, provenance, and freshness into an
  `aviation.nav-data` Component with shared TypeScript/Python acceptance vectors;
  Flight Planner and G1000 now delegate their common navigation-data catalogs to the
  SDK. The retained `@aviation/nav-data` package now contains only provider adapters
  for OurAirports, openAIP, and FAA CIFP; duplicate database, cache, search, distance,
  and procedure-selection implementations were removed.
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
