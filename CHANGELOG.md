# Changelog

- Qualified planning IAS/TAS and ISA Mach conversions across the TypeScript and Python
  SDK bindings, with shared valid and fail-closed Component vectors.
- Qualified shared wind components and wind-triangle calculations across TypeScript
  and Python, and migrated Flight Planner's private wind arithmetic to the SDK.
- Removed unused G1000 and Flight Planner private geodesy service scaffolds now that
  realized route calculations are owned by the common Aviation navigation SDK.

## Unreleased

- Added an independently specified and cross-language tested
  `aviation.service.lifecycle` Component for deterministic start, stop, failure, and
  reset transitions. The shared TypeScript `BackgroundService` now exposes in-progress
  and failed states, rejects concurrent transitions, captures hook errors, and prevents
  disabled startup; Weather Briefing consumes that common base instead of maintaining
  private lifecycle methods.
- Added an independently specified and tested `aviation.service.health` Component
  with shared TypeScript/Python status normalization and report-construction vectors.
  Aviation Chat, Flight Tracker, Weather Briefing, G1000, and Flight Planner health
  endpoints now delegate their common payload semantics to the SDK while retaining
  HTTP routing and application-specific operational detail policy.
- Added an independently specified and tested `aviation.ui.panes` Component for
  deterministic pane ordering, default selection, navigation, reordering, closeability,
  and close-state transitions. Meta App now delegates initial selection to the common
  UI capability while G1000 continues to publish the shared pane contract; rendering,
  URLs, icons, styling, persistence, and layout remain application policy.
- Added an independently specified and tested `aviation.alerts` Component with
  shared TypeScript, Python, and Go severity normalization, stable ordering,
  acknowledgement reconciliation, and highest-active-severity vectors. G1000's alert
  service and live Zustand store, the UI framework, and Flight Planner's live alert
  manager now consume the portable core. Flight Planner retains its extended
  critical-before-warning tie-break, while applications retain thresholds, messages,
  timestamps, persistence, events, sounds, visibility limits, and rendering policy.
- Added an independently specified and tested `aviation.notam` Component with
  shared TypeScript/Python normalization, classification, effective-window and route
  filtering, stable severity ordering, and text-formatting vectors. Weather Briefing
  continues to consume the common SDK while FAA HTTP/authentication, development
  fallback, and application presentation remain outside the portable authority.
- Added an independently specified and tested `aviation.logbook` Component with
  cross-language validation for common flight-time accounting, student restrictions,
  role normalization, flight-condition totals, and landing consistency. ForeFlight
  Dashboard now delegates that portable policy to the SDK while retaining provider
  CSV repair, registration and route heuristics, certificate advice, persistence,
  accounts, and presentation as application behavior.
- Promoted ForeFlight Dashboard's private 170-code aircraft type-designator support
  snapshot into cross-language `aviation.aircraft` APIs with Component-owned vectors,
  deterministic lookup/suggestions, and independent SDK tests. ForeFlight now keeps
  only compatibility response shapes and logbook-specific validation policy.
- Added fail-closed manufacturer/model matching to both `aviation.aircraft`
  bindings and migrated Flight School's fleet page to qualified SDK reference
  identity, weight, fuel, and performance data. Fleet registration, rates,
  equipment, availability, bookings, and maintenance scheduling remain application
  policy; two unused invalid maintenance helpers were removed.
- Migrated Flight Planner's retained ADF bearing, DME ground range, VOR/HSI angle,
  and GPS track normalization to the independently tested `aviation.avionics`
  realization. Random GPS error injection, approach orchestration, CDI sensitivity,
  TO/FROM selection, and instrument presentation remain application policy.
- Migrated G1000 backend heading normalization, shortest-turn error, and geodesic
  position stepping to `aviation.navigation`. Flight Planner now delegates its
  retained dynamics heading semantics to the same SDK while preserving the legacy
  `+180` compatibility response and application-owned controller/alert policy.
- Qualified coordinated-turn bank and deterministic synthetic piston-engine
  instrumentation across Python and TypeScript `aviation.flight-dynamics` bindings.
  Flight Track Analyzer now delegates common turn physics while retaining measured
  inference, and G1000 delegates engine state plus MFD geodesy while retaining session,
  alert, gauge, and pixel policy.
- Qualified shortest heading differences, circular heading means, runway designators,
  and reversible local tangent-plane projection across both `aviation.navigation`
  bindings. Flight Track Analyzer now retains only vectorized track adaptation, and
  G1000 HSI retains only display scaling and styling instead of private navigation
  formulas.
- Qualified east/north wind-vector decomposition in both `aviation.navigation`
  bindings and migrated Flight Track Analyzer's fitted-wind, reported-wind, and
  airport-distance calculations to the common SDK while retaining its spatial index
  and measured-track policy.
- Added cross-language C182T and SR22 Perspective 3600 operating profiles and linked
  their flight-dynamics models to the common aircraft authority, removing duplicated
  limits, fuel, weight, dimensions, and reference-performance data from model files.
- Link the common C172S flight-dynamics model directly to `aviation.aircraft` and remove
  its duplicate serialized operating limits, dimensions, fuel capacity, and reference
  performance while retaining physics-specific model data and calculations.
- Qualified a cross-language C172S sample loading profile in
  `aviation.weight-balance`, explicitly linked it to `aviation.aircraft`, and migrated
  G1000 Trip Planning away from its mismatched C172N record while retaining entered
  occupant, baggage, and fuel values as application state.
- Expanded `aviation.aircraft` into a cross-language identity and reference-profile
  authority with ICAO lookup, fuel/weight limits, dimensions, and cited C172S
  performance data. Flight Planner's contradictory private YAML profile was removed;
  Flight Planner and G1000 now derive bundled C172 selectors and defaults from the SDK.
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
