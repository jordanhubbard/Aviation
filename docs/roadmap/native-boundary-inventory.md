# Native boundary inventory

- **Status:** partial
- **Current scope:** consumer audit complete; residual retained-source classification remains open
- **Owning queue item:** [ADOPT-002](active-work.md#adopt-002)
- **Completion / archival evidence:** pending while ADOPT-002 remains open

This is the source-evidence inventory for ADR 0002. Paths below are relative to
`components/legacy-project-wrapper/implementation` (called **R**). The retained
source remains release authority. A row being listed does not transfer it to a
native Component or prove its acceptance contract is complete.

The pre-adoption revision `f68efb8273508c74fbc3cd710e8f0ae1bc4a8d39` had
1,409 tracked files. The original first pass preserved those paths and established
the wrapper baseline. The current audit is bound to main revision
`3eb6b597e3cd15485847f31905713508341c3d89`, 19 committed Component locks, and
retained receipt
`sha256:05bd764935f252a52fc05343f0c15ea557e282041c2f3a1d39f44a62d893d436`
with 589 admitted tests. It maps all 12 application directories and 10 shared
package directories. That receipt proves retained lifecycle parity; it does not by
itself prove native regeneration or authorize retiring the wrapper.

## Application boundaries

Each row is a provisional Component candidate. Public contracts, storage, target
variance, and acceptance need a separate review before source promotion. `none`
means this pass found no owned test suite; it is an evidence gap.

| Boundary and owner | Common SDK / Component consumption evidence | Application-unique responsibility retained | Test evidence |
| --- | --- | --- | --- |
| Accident Tracker — `apps/aviation-accident-tracker` | `backend/src/geo/airportLookup.ts` consumes `aviation.airports` and `aviation.navigation`; `backend/src/e2e/manager.ts` consumes `aviation.testing.e2e` | feed ingestion, accident classification, repository schema, scheduler, export, GraphQL/REST, and map presentation | backend and frontend test trees, including E2E isolation |
| Aviation Chat — `apps/aviation-chat` | `src/index.ts` consumes `aviation.service.health` and `aviation.testing.e2e` | chat/OpenClaw composition, conversation policy, and HTTP surface | production build plus retained lifecycle |
| Aviation Missions — `apps/aviation-missions-app` | no common-domain import is required: source inspection finds mission records and workflow, not airport lookup, weather, flight math, aircraft performance, or avionics algorithms | Clojure mission catalog CRUD, submissions, moderation, ratings, completion records, authentication, and presentation | `backend/test/aviation_missions/`; a zero-domain-consumer classification is intentional, not an SDK gap |
| Flight Planner — `apps/flight-planner` | Python and TypeScript adapters consume aircraft, airports, alerts, avionics, flight dynamics, navigation, nav-data, service health, testing E2E, and weather Components | route choice, planning floors, HTTP schemas, streaming, persistence, scenario orchestration, and UI | backend, root integration, and frontend tests plus production build |
| Flight Track Analyzer — `apps/flight-track-analyzer` | consumes airports-normalized data, flight-dynamics turn physics, navigation/geodesy/wind, and testing E2E | measured-track inference, signal processing, KD-tree search, POH interpolation, reports, and storage | `app/tests/`, including SDK-wiring and isolation tests |
| Flight Tracker — `apps/flight-tracker` | `src/index.ts` and `src/service.ts` consume shared service health, lifecycle, and weather contracts | live tracking ingestion, WebSocket/API orchestration, tracked-flight state, and presentation | `tests/service.test.ts` and production build |
| Flight School — `apps/flightschool` | consumes `aviation.aircraft`, shared Google integration adapters, and testing E2E isolation | fleet registration/rates/equipment, bookings, maintenance scheduling, accounts, and pages | `tests/` and retained lifecycle |
| ForeFlight Dashboard — `apps/foreflight-dashboard` | consumes `aviation.aircraft` type-designator matching and `aviation.logbook` accounting/validation | provider CSV repair, registration/route heuristics, certificate advice, accounts, persistence, and dashboard presentation | `tests/`, including structural SDK-boundary checks |
| G1000 Simulator — `apps/g1000-simulator` | consumes aircraft, airports, alerts, avionics protocols/devices/rendering, flight dynamics, navigation, nav-data, service health/lifecycle, and shared UI panes/plugins | simulator stepping, telemetry/session state, transports, capture thresholds, tuning, annunciation, gauge/page composition, and physical-I/O boundary | root, backend, frontend, protocol, rendering, and SDK-wiring tests |
| Meta App — `apps/meta-app` | `src/App.tsx` consumes qualified shared pane default-selection and the UI framework | application catalog, URLs, launcher composition, feedback integration, and styling | three application tests and production build |
| Preflight Check — `apps/preflight-check` | `public/calculations.js` directly re-exports built `aviation.weight-balance`; its image also ships the linked aircraft module | user-entered POH/AFM profile, browser persistence, risk checklist, and presentation | `calculations.test.mjs` exercises the built SDK realization |
| Weather Briefing — `apps/weather-briefing` | `src/service.ts` consumes weather, NOTAM, service lifecycle, and shared health behavior | briefing composition, scheduled refresh, HTTP surface, cache cleanup timing, and presentation | `tests/service.test.ts` and production build |

Eleven applications therefore consume common SDK capabilities directly. Aviation
Missions is the deliberate exception because its retained aviation-themed content is
mission catalog data, not a second implementation of a portable aviation capability.
The audit does not require a decorative dependency where no shared behavior exists.
Any future common-domain behavior added there must first use an existing Component or
open a new boundary review.

## Shared package boundaries

Each package is a provisional Component or library contract. The package
manifest names its build and export surface; its README, where present, is the
current human description.

| Boundary and owner | Source and contract evidence | Existing test evidence |
| --- | --- | --- |
| AI Explainer — `packages/ai-explainer` | `packages/ai-explainer/package.json`; `packages/ai-explainer/README.md` | `packages/ai-explainer/tests/` |
| Aviation Config — `packages/aviation-config` | `packages/aviation-config/package.json`; `packages/aviation-config/src/` | none located |
| Flight Dynamics — `packages/flight-dynamics` | `packages/flight-dynamics/package.json`; `packages/flight-dynamics/README.md`; `packages/flight-dynamics/requirements.txt` | Component-owned conformance vectors, package physics/model tests, and retained API tests |
| G1000 Avionics SDK — `packages/g1000-avionics-sdk` | `packages/g1000-avionics-sdk/package.json`; `packages/g1000-avionics-sdk/README.md`; Python package under `packages/g1000-avionics-sdk/python/` | Component-owned cross-language AHRS/ADC/GPS vectors and invalid-input tests |
| G1000 Protocols — `packages/g1000-protocols` | `packages/g1000-protocols/package.json`; `packages/g1000-protocols/README.md`; Go package under `packages/g1000-protocols/` | Component-owned telemetry/command/flight-plan conformance vectors and TypeScript package tests; Go remains provisional |
| G1000 Rendering — `packages/g1000-rendering` | `packages/g1000-rendering/package.json`; `packages/g1000-rendering/README.md` | Component-owned layout/pipeline/primitive conformance vectors and TypeScript package tests |
| Keystore — `packages/keystore` | `packages/keystore/package.json`; `packages/keystore/README.md`; Python package under `packages/keystore/python/` | `packages/keystore/src/keystore.test.ts`; `packages/keystore/src/cli.test.ts` |
| Navigation Data providers — `packages/nav-data` | `packages/nav-data/package.json`; `packages/nav-data/src/ingestion/` | Component-owned synthetic provider vectors and package tests |
| Shared SDK — `packages/shared-sdk` | `packages/shared-sdk/package.json`; `packages/shared-sdk/README.md`; Python package under `packages/shared-sdk/python/`; Go package under `packages/shared-sdk/` | `packages/shared-sdk/tests/`; Python tests; Go tests |
| UI Framework — `packages/ui-framework` | `packages/ui-framework/package.json`; `packages/ui-framework/README.md` | `packages/ui-framework/src/` tests |

### First selected boundary: aviation navigation

`aviation.navigation` is the first native boundary because its calculations are pure,
already have TypeScript and Python realizations, and are consumed by multiple
applications. Its classification is:

| Retained path | Classification | Native owner / disposition |
| --- | --- | --- |
| `packages/shared-sdk/src/aviation/navigation/` | retained TypeScript realization | `component://aviation/aviation-navigation`; keep until regenerative qualification |
| `packages/shared-sdk/python/aviation/navigation.py` | retained Python realization | same capability; keep until shared-vector parity and replacement qualification |
| `packages/shared-sdk/src/aviation/__tests__/navigation.test.ts` | retained implementation tests | preserve; supplement with Component-owned cross-language vectors |
| `packages/shared-sdk/python/tests/test_navigation_conformance.py` | retained realization adapter | evaluates the Component-owned vectors; removable with the retained realization |
| `components/aviation-navigation/` | Component intent, interface, and acceptance | native authority for observable navigation behavior |
| `.github/workflows/sdk-ci.yml` | repository acceptance workflow | required-style CI gate for common SDK realizations |
| app-local distance, bearing, wind, fuel, procedure, and performance code | candidate duplication | classify against the interface, migrate consumers, then remove only after parity |

Target language, package manager, compiler, and operating-system details remain Flavor
or workflow authority. Airport datasets, magnetic models, and procedure databases are
separate assets/components and are not folded into the navigation arithmetic boundary.

### Second selected boundary: aviation airports

`aviation.airports` owns the normalized airport record and query behavior while the
large retained cache remains data pending provenance and license qualification.

| Retained path | Classification | Native owner / disposition |
| --- | --- | --- |
| `packages/shared-sdk/src/aviation/airports/` | retained TypeScript realization | `component://aviation/aviation-airports`; shared-vector adapter required |
| `packages/shared-sdk/python/aviation/airports.py` | retained Python realization | same capability; normalization is the common ingestion boundary |
| `packages/shared-sdk/data/airports_cache.json` | retained dataset | do not promote as an asset until source, license, revision, and refresh evidence are explicit |
| `apps/flight-planner/backend/app/models/airport.py` | compatibility adapter | already delegates to the Python SDK; remove after app import packaging no longer needs it |
| `apps/aviation-accident-tracker/backend/src/geo/airportLookup.ts` | application adapter | already delegates to the TypeScript SDK; retain only unit conversion/orchestration |
| `apps/flight-track-analyzer/app/flightlab/airports.py` | application-specific acceleration | consume SDK-normalized records; retain KD-tree batch lookup and touchdown radius policy |
| `packages/nav-data/src/ingestion/ourairports.ts` | provider compatibility adapter | emits `aviation.airports` records and delegates normalization to the common SDK |
| G1000 simulator sample nav database | simulated avionics fixture | retain as explicit simulator test/runtime data, not as the common airport database |

### Third selected boundary: aviation weather

`aviation.weather` owns provider-neutral observations and forecasts, METAR parsing,
flight-category classification, warnings, provider normalization, caching policy, and
departure-window scoring. Route sampling and pilot-facing presentation remain with
their applications.

| Retained path | Classification | Native owner / disposition |
| --- | --- | --- |
| `packages/shared-sdk/src/aviation/weather/` | retained TypeScript realization | `component://aviation/aviation-weather`; shared-vector adapter required |
| `packages/shared-sdk/python/aviation/weather/` | retained Python realization | same capability; common cache and provider adapters live here |
| `apps/weather-briefing/src/service.ts` | application composition | already consumes the TypeScript SDK; retain briefing/NOTAM presentation orchestration |
| `apps/flight-planner/backend/app/services/metar.py` | compatibility adapter | delegates to the Python SDK; remove when direct SDK imports fit app packaging |
| `apps/flight-planner/backend/app/services/open_meteo.py` | compatibility adapter | delegates to the Python SDK; no private provider implementation remains |
| `apps/flight-planner/backend/app/services/openweathermap.py` | compatibility adapter | delegates to the Python SDK; no private provider implementation remains |
| `apps/flight-planner/backend/app/services/flight_recommendations.py` | compatibility adapter | delegates classification, warning, and scoring behavior to the Python SDK |
| `apps/flight-planner/backend/app/routers/weather.py` | application orchestration | retain airport lookup, route sampling, HTTP schemas, and response composition |

### Fourth selected boundary: aviation navigation data

`aviation.nav-data` owns provider-neutral navaid, procedure, and airspace records,
normalization and ingestion validation, catalog query behavior, source provenance, and
effective-date freshness. Airport identity remains with `aviation.airports`; geodesy
remains with `aviation.navigation`; spatial indexes and avionics state remain private
to their applications.

| Retained path | Classification | Native owner / disposition |
| --- | --- | --- |
| `packages/shared-sdk/src/aviation/nav-data/` | retained TypeScript realization | `component://aviation/aviation-nav-data`; shared-vector adapter required |
| `packages/shared-sdk/python/aviation/nav_data/` | retained Python realization | same capability; owns validated catalog ingestion and queries |
| `apps/flight-planner/backend/app/services/nav_database.py` | compatibility adapter | combines `aviation.airports` with SDK navaids/procedures and retains Pydantic response mapping only |
| `apps/flight-planner/backend/app/services/procedures.py` | compatibility adapter | delegates common procedure selection and retains the planner UI response shape |
| `apps/flight-planner/backend/app/utils/data_loader.py` | application asset loader | delegates GeoJSON validation to the SDK; retains file location, logging, and cache policy |
| `apps/flight-planner/backend/app/routers/airspace.py` | application-specific acceleration | retain GeoPandas projection, spatial indexing, radius policy, and HTTP serialization |
| `apps/g1000-simulator/backend/app/services/nav_database.py` | compatibility adapter | combines common airports/nav-data and retains the simulator API response shape |
| `apps/g1000-simulator/backend/app/services/procedures.py` | compatibility adapter | delegates selection/filtering and retains legacy simulator method names |
| `packages/nav-data/src/` | retained provider-ingestion package | CIFP, openAIP, and OurAirports adapters emit common SDK contracts; duplicate database, cache, search, proximity, and procedure-selection surfaces are removed and Component-owned adapter vectors run in package CI |
| retained airport/airspace caches | retained datasets | provenance, license, revision, and refresh evidence remain required before asset promotion |

### Fifth selected boundary: aviation flight dynamics

`aviation.flight-dynamics` owns deterministic atmosphere and wind models, common
force and integration primitives, aircraft performance/model validation, and
autopilot-control primitives. Avionics display state, HTTP schemas, alert routing,
recorded-flight analytics, and application simulation orchestration remain private.

| Retained path | Classification | Native owner / disposition |
| --- | --- | --- |
| `packages/flight-dynamics/aviation_flight_dynamics/` | retained Python realization | `component://aviation/aviation-flight-dynamics`; Component-vector adapter required |
| `packages/flight-dynamics/aviation_flight_dynamics/aircraft/models/` | validated model assets | retain C172, C182, and SR22 configurations with explicit validation counts |
| `packages/flight-dynamics/tests/` | independent realization adapter | evaluates Component-owned vectors without application or network dependencies |
| `apps/flight-planner/backend/app/services/flight_dynamics.py` | compatibility adapter plus application orchestration | delegates scalar physics and environmental calculations, instantiates common axis controllers directly with planner-specific gains and fixed-step policy, and retains planner state and alert orchestration |
| `apps/g1000-simulator/backend/app/services/autopilot.py` | compatibility adapter plus app-private avionics state | delegates bounded PID behavior and flight-director state transitions; retains aircraft tuning selection and limit annunciation fields |
| `apps/g1000-simulator/backend/app/models/aircraft_state.py` | compatibility adapter plus app-private telemetry state | maps common C172 performance, limits, fuel, mass, and wing data; retains live engine/position/attitude telemetry and display-only dimensions |
| `apps/g1000-simulator/backend/app/services/flight_dynamics.py` | application simulator orchestration | retains capture thresholds, PID reset timing, limit annunciation, sensor/radio/audio/transponder state, geographic stepping, and telemetry snapshots; consumes common PID/model and flight-director transitions |
| `apps/flight-track-analyzer/app/flightlab/` | recorded-flight analytics | retain signal processing, measurement calibration, POH comparison, and observed-flight inference; consume common primitives only where semantics match |

### Sixth selected boundary: aviation avionics protocols and rendering

`aviation.avionics` owns runtime-validated telemetry and command records, flight-plan
exchange formats, deterministic display layout, functional canvas primitives, and
PFD/MFD pipeline contracts. Simulator stepping, WebSocket reconnection, frontend
stores, page composition, alerts, and physical device I/O remain application-private.
Unqualified radio behavior remains outside this boundary.

| Retained path | Classification | Native owner / disposition |
| --- | --- | --- |
| `packages/g1000-protocols/src/` | retained TypeScript realization | `component://aviation/aviation-avionics`; Component-vector adapter required |
| `packages/g1000-rendering/src/` | retained TypeScript realization | same capability; layout, pipeline ordering, and drawing operations are independently tested |
| `packages/g1000-protocols/src/__tests__/` | independent realization adapter | evaluates protocol and flight-plan vectors without an application or network |
| `packages/g1000-rendering/src/__tests__/` | independent realization adapter | evaluates layout, one-shot rendering, layer ordering, and canvas-operation traces without a browser |
| `apps/g1000-simulator/frontend/src/types/telemetry.ts` | compatibility re-export | contains no private schema; re-exports the common protocol types |
| `apps/g1000-simulator/frontend/src/stores/flightStore.ts` | application state adapter | delegates full-snapshot classification; retains merge policy and Zustand state |
| `apps/g1000-simulator/frontend/src/hooks/useTelemetrySocket.ts` | application transport adapter | delegates snapshot/delta validation; retains URL, reconnect, ping, and invalid-session policy |
| `packages/g1000-avionics-sdk/` | retained cross-language realization | AHRS/ADC/GPS are qualified by Component vectors; radio models remain absent pending a separate contract |

### Seventh selected boundary: aviation avionics sensor models

The device-model extension of `aviation.avionics` owns pure AHRS, ADC, and GPS
solutions with unit-explicit inputs and fail-closed validation. It deliberately does
not own application stepping, stores, transport, physical I/O, or unqualified radio
station state.

| Retained path | Classification | Native owner / disposition |
| --- | --- | --- |
| `packages/g1000-avionics-sdk/src/devices.ts` | retained TypeScript realization | evaluates Component-owned AHRS/ADC/GPS vectors |
| `packages/g1000-avionics-sdk/python/aviation_avionics/` | retained Python realization | same vector and invalid-input contract |
| `apps/g1000-simulator/backend/app/services/{ahrs,adc,gps}.py` | compatibility exports | contain no private sensor algorithms |
| `apps/flight-planner/backend/app/services/ahrs_adc_simulation.py` | compatibility exports | replaces the former `None`-return stubs with common SDK delegation |

### Airspeed and aircraft-configuration inventory conclusion

Planning IAS/TAS and ISA Mach conversion belongs to `aviation.navigation`; its public
TypeScript and Python surfaces now run the same Component-owned valid and invalid
vectors. Calibrated sensor air data remains with `aviation.avionics`: Flight Planner's
`ahrs_adc_simulation.py` and G1000's `adc.py` are compatibility exports with no private
formula, and G1000 telemetry supplies the common ADC result directly to the PFD.

G1000's backend `aircraft_state.py` is also already a compatibility projection over
the `aviation.flight-dynamics` C172 model. Its live position, attitude, engine, and
telemetry records plus display-only length/height remain application state. The
frontend Airspeed Tape now derives its C172 arcs and Vne marker from the qualified
`aviation.aircraft` operating profile; scale, trend, styling, and presentation remain
application code.

## Cross-cutting authority to classify

| Boundary and proposed owner | Evidence | Provisional classification and open question |
| --- | --- | --- |
| Airport data — shared navigation asset | Byte-identical `apps/flight-planner/backend/data/airports_cache.json` and `packages/shared-sdk/data/airports_cache.json`; both are bound by tested provenance manifests to SHA-256 `2ea6613e...54d3`, 82,870 records, the OurAirports public-domain declaration, and the `elevation_ft` MSL contract. | Redistributable derived snapshot. Its acquisition time and input digest were not retained, so freshness remains unknown; retain the generated asset and do not claim it is current or navigation-authoritative. |
| Airspace data — Flight Planner retained third-party data | Tested `apps/flight-planner/backend/data/provenance.json` binds `airspaces_us.json` (23,872 records) and `airspace_cache.json` (24,232 features) to exact digests. The generator identifies openAIP, whose live API schema declared CC BY-NC 4.0 and requested attribution on 2026-10-31; the combined cache has 360 features from an unretained legacy input. | Intentionally retained app data, not a Component asset. Historical acquisition terms, dates, input digests, freshness, and the legacy additions' provenance are unresolved. Visible attribution is present, but recorded evidence does not authorize commercial use or promotion; a refresh must retain all source evidence. |
| Accident feed fixtures and seeds — Accident Tracker | `apps/aviation-accident-tracker/backend/data/` | Asset/fixture versus runtime-ingested data must be distinguished before promotion. |
| Application persistence and credentials — each owning app/package | `apps/flight-track-analyzer/app/flightlab/store.py`; `packages/keystore/README.md`; app READMEs and environment configuration | Named runtime state and secret contracts, not generated source. Inventory locations, migration, and rollback per app. |
| Workspace build and package graph — repository harness | `Makefile`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `go.mod`, application/package manifests, and `apps/*/Makefile` | Repository-only harness plus target Flavors; each promoted boundary must keep a reproducible build and package oracle. |
| CI, delivery, and release — repository workflow | Root `.github/workflows/ci.yml`, `dependency-scan.yml`, `deploy.yml`, `integration-tests.yml`, `performance_regression.yml`; R `scripts/release.sh` | Workflow and acceptance oracle; all six exact-main workflows at `3eb6b597e3cd15485847f31905713508341c3d89` passed, including the 12-application deployment-image matrix (run 41194894882). |
| Target variance — Flavor authority | App Dockerfiles, Python requirements, `pnpm-workspace.yaml`, Clojure `project.clj`, Go `go.mod`, `k8s/`, `monitoring/` | Move OS, package, container, and toolchain requirements into Flavors only when each boundary is promoted. |
| Retained parity — adoption harness | `.literate/harness-inventory.json`, `.literate/legacy-harness-baseline.json`, `.literate/legacy-wrapper-parity.json`, `verification/current.json` at project root | Baseline and independent acceptance evidence; current project receipt does not prove native source equivalence. |

## Next review

The application consumer pass is complete. Continue at file-level granularity: name
public inputs and outputs, schema versions, persistent state, test oracle, runtime
target, and dependencies for each retained package and cross-cutting asset. Classify
each retained path as Component intent, Flavor requirement, conversion skill,
immutable asset, repository harness, or intentionally retained source. Prioritize the
application persistence and credential contracts next. The airport/airspace decision
is now explicit and machine-checked: the airport snapshot is a public-domain derived
asset of unknown freshness, while the openAIP/mixed airspace snapshots remain
separately licensed retained app data with unresolved historical provenance. The
project remains at the `retained` conversion stage;
19 Component locks and the current receipt are evidence for the migrated boundaries,
not authority to retire unclassified retained source.
