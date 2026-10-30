# Native boundary inventory

- **Status:** partial
- **Owning queue item:** [ADOPT-002](active-work.md#adopt-002)
- **Completion / archival evidence:** pending while ADOPT-002 remains open

This is the first source-evidence pass for ADR 0002. Paths below are relative to
`components/legacy-project-wrapper/implementation` (called **R**). The retained
source remains release authority. A row being listed does not transfer it to a
native Component or prove its acceptance contract is complete.

The pre-adoption revision `f68efb8273508c74fbc3cd710e8f0ae1bc4a8d39` had
1,409 tracked files. All 1,409 paths still exist under R on main; 1,399 retain
the same Git blob identity. The ten changed retained files are the workspace
Makefile, README, four application dependency manifests, meta-app README and
launcher, pnpm lockfile, and pnpm workspace manifest. The full retained test
receipt and its exact-main verification establish the wrapper baseline, not native
regeneration. Current local verification is separately blocked by Literate AI
[issue #212](https://github.com/jordanhubbard/literate-ai/issues/212), which mistakes
third-party dependency manifests for legacy Component authoring. This pass maps 11
application directories and 10 shared package directories.

## Application boundaries

Each row is a provisional Component candidate. Public contracts, storage, target
variance, and acceptance need a separate review before source promotion. `none`
means this pass found no owned test suite; it is an evidence gap.

| Boundary and owner | Retained source and public-contract evidence | Existing test evidence |
| --- | --- | --- |
| Accident Tracker — `apps/aviation-accident-tracker` | `apps/aviation-accident-tracker/README.md`; backend/frontend `package.json`; `apps/aviation-accident-tracker/Dockerfile` | `apps/aviation-accident-tracker/backend/tests/`; `apps/aviation-accident-tracker/frontend/src/tests/App.test.tsx` |
| Aviation Chat — `apps/aviation-chat` | `apps/aviation-chat/README.md`; `apps/aviation-chat/package.json` | none located |
| Aviation Missions — `apps/aviation-missions-app` | `apps/aviation-missions-app/README.md`; `apps/aviation-missions-app/backend/project.clj`; frontend `package.json` | `apps/aviation-missions-app/backend/test/` |
| Flight Planner — `apps/flight-planner` | `apps/flight-planner/README.md`; `apps/flight-planner/requirements.txt`; frontend `package.json`; `apps/flight-planner/Dockerfile` | `apps/flight-planner/backend/tests/`; `apps/flight-planner/tests/`; `apps/flight-planner/frontend/src/components/ModeSelector.test.tsx` |
| Flight Track Analyzer — `apps/flight-track-analyzer` | `apps/flight-track-analyzer/README.md`; `apps/flight-track-analyzer/app/flightlab/api.py`; `apps/flight-track-analyzer/app/requirements.txt` | `apps/flight-track-analyzer/app/tests/` (61 tests including airport MSL) |
| Flight Tracker — `apps/flight-tracker` | `apps/flight-tracker/README.md`; `apps/flight-tracker/package.json`; `apps/flight-tracker/Dockerfile` | `apps/flight-tracker/tests/service.test.ts` |
| Flight School — `apps/flightschool` | `apps/flightschool/README.md`; `apps/flightschool/requirements.txt`; `apps/flightschool/Dockerfile` | `apps/flightschool/tests/` |
| ForeFlight Dashboard — `apps/foreflight-dashboard` | `apps/foreflight-dashboard/README.md`; `apps/foreflight-dashboard/requirements.txt`; frontend `package.json` | `apps/foreflight-dashboard/tests/` |
| G1000 Simulator — `apps/g1000-simulator` | `apps/g1000-simulator/README.md`; root/backend/frontend `package.json`; backend `requirements.txt` | `apps/g1000-simulator/tests/`; `apps/g1000-simulator/backend/tests/` |
| Meta App — `apps/meta-app` | `apps/meta-app/README.md`; `apps/meta-app/package.json`; `apps/meta-app/src/App.tsx` | none located |
| Weather Briefing — `apps/weather-briefing` | `apps/weather-briefing/README.md`; `apps/weather-briefing/package.json` | `apps/weather-briefing/tests/service.test.ts` |

## Shared package boundaries

Each package is a provisional Component or library contract. The package
manifest names its build and export surface; its README, where present, is the
current human description.

| Boundary and owner | Source and contract evidence | Existing test evidence |
| --- | --- | --- |
| AI Explainer — `packages/ai-explainer` | `packages/ai-explainer/package.json`; `packages/ai-explainer/README.md` | `packages/ai-explainer/tests/` |
| Aviation Config — `packages/aviation-config` | `packages/aviation-config/package.json`; `packages/aviation-config/src/` | none located |
| Flight Dynamics — `packages/flight-dynamics` | `packages/flight-dynamics/package.json`; `packages/flight-dynamics/README.md`; `packages/flight-dynamics/requirements.txt` | Component-owned conformance vectors, package physics/model tests, and retained API tests |
| G1000 Avionics SDK — `packages/g1000-avionics-sdk` | `packages/g1000-avionics-sdk/package.json`; `packages/g1000-avionics-sdk/README.md` | none located; retained zero-return device stubs are explicitly outside Component authority |
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
| `apps/flight-planner/backend/app/services/flight_dynamics.py` | compatibility adapter | delegates scalar physics and environmental calculations; retains planner state and alert orchestration |
| `apps/flight-planner/backend/app/services/autopilot_controller.py` | compatibility adapter | delegates PID state/update behavior; retains legacy controller names and fixed-step API |
| `apps/g1000-simulator/backend/app/services/autopilot.py` | compatibility adapter plus app-private avionics state | delegates bounded PID state/update behavior; retains tuning selection, lateral/vertical modes, annunciation, and disconnect state |
| `apps/g1000-simulator/backend/app/models/aircraft_state.py` | compatibility adapter plus app-private telemetry state | maps common C172 performance, limits, fuel, mass, and wing data; retains live engine/position/attitude telemetry and display-only dimensions |
| `apps/g1000-simulator/backend/app/services/flight_dynamics.py` | application simulator orchestration | retains mode capture, sensor/radio/audio/transponder state, geographic stepping, and telemetry snapshots; consumes common PID/model primitives |
| `apps/flight-track-analyzer/app/flightlab/` | recorded-flight analytics | retain signal processing, measurement calibration, POH comparison, and observed-flight inference; consume common primitives only where semantics match |

### Sixth selected boundary: aviation avionics protocols and rendering

`aviation.avionics` owns runtime-validated telemetry and command records, flight-plan
exchange formats, deterministic display layout, functional canvas primitives, and
PFD/MFD pipeline contracts. Simulator stepping, WebSocket reconnection, frontend
stores, page composition, alerts, and physical device I/O remain application-private.
Fixed zero-return sensor/radio classes are placeholders, not qualified device models.

| Retained path | Classification | Native owner / disposition |
| --- | --- | --- |
| `packages/g1000-protocols/src/` | retained TypeScript realization | `component://aviation/aviation-avionics`; Component-vector adapter required |
| `packages/g1000-rendering/src/` | retained TypeScript realization | same capability; layout, pipeline ordering, and drawing operations are independently tested |
| `packages/g1000-protocols/src/__tests__/` | independent realization adapter | evaluates protocol and flight-plan vectors without an application or network |
| `packages/g1000-rendering/src/__tests__/` | independent realization adapter | evaluates layout, one-shot rendering, layer ordering, and canvas-operation traces without a browser |
| `apps/g1000-simulator/frontend/src/types/telemetry.ts` | compatibility re-export | contains no private schema; re-exports the common protocol types |
| `apps/g1000-simulator/frontend/src/stores/flightStore.ts` | application state adapter | delegates full-snapshot classification; retains merge policy and Zustand state |
| `apps/g1000-simulator/frontend/src/hooks/useTelemetrySocket.ts` | application transport adapter | delegates snapshot/delta validation; retains URL, reconnect, ping, and invalid-session policy |
| `packages/g1000-avionics-sdk/` | unqualified placeholder candidates | do not promote until real AHRS/ADC/GPS/radio behavior has unit-explicit contracts and deterministic vectors |

## Cross-cutting authority to classify

| Boundary and proposed owner | Evidence | Provisional classification and open question |
| --- | --- | --- |
| Airport and airspace data — shared navigation asset | `apps/flight-planner/backend/data/airports_cache.json`, `airspaces_us.json`, `airspace_cache.json`; `packages/shared-sdk/data/airports_cache.json`; analyzer `apps/flight-track-analyzer/app/flightlab/airports.py` | Immutable asset or retained data cache after provenance, freshness, and license review; preserve the MSL field contract. |
| Accident feed fixtures and seeds — Accident Tracker | `apps/aviation-accident-tracker/backend/data/` | Asset/fixture versus runtime-ingested data must be distinguished before promotion. |
| Application persistence and credentials — each owning app/package | `apps/flight-track-analyzer/app/flightlab/store.py`; `packages/keystore/README.md`; app READMEs and environment configuration | Named runtime state and secret contracts, not generated source. Inventory locations, migration, and rollback per app. |
| Workspace build and package graph — repository harness | `Makefile`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `go.mod`, application/package manifests, and `apps/*/Makefile` | Repository-only harness plus target Flavors; each promoted boundary must keep a reproducible build and package oracle. |
| CI, delivery, and release — repository workflow | Root `.github/workflows/ci.yml`, `dependency-scan.yml`, `deploy.yml`, `integration-tests.yml`, `performance_regression.yml`; R `scripts/release.sh` | Workflow and acceptance oracle; four Docker image builds and the staging dry run passed on main run 39907267413. |
| Target variance — Flavor authority | App Dockerfiles, Python requirements, `pnpm-workspace.yaml`, Clojure `project.clj`, Go `go.mod`, `k8s/`, `monitoring/` | Move OS, package, container, and toolchain requirements into Flavors only when each boundary is promoted. |
| Retained parity — adoption harness | `.literate/harness-inventory.json`, `.literate/legacy-harness-baseline.json`, `.literate/legacy-wrapper-parity.json`, `verification/current.json` at project root | Baseline and independent acceptance evidence; current project receipt does not prove native source equivalence. |

## Next review

For each application and package, name its exact public inputs and outputs, schema
versions, persistent state, test oracle, runtime target, and dependencies. Classify
each retained file as Component intent, Flavor requirement, conversion skill,
immutable asset, repository harness, or intentionally retained source. Select the
smallest independently testable boundary only after that review. The native
conversion stage cannot advance to `drafted` yet: the CLI reports
`conversion_authority.component_evidence_missing` because no retained-source
Component authority projections exist.
