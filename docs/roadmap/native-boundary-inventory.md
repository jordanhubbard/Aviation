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
| Flight Dynamics — `packages/flight-dynamics` | `packages/flight-dynamics/package.json`; `packages/flight-dynamics/README.md`; `packages/flight-dynamics/requirements.txt` | `packages/flight-dynamics/test_api.py` |
| G1000 Avionics SDK — `packages/g1000-avionics-sdk` | `packages/g1000-avionics-sdk/package.json`; `packages/g1000-avionics-sdk/README.md` | none located |
| G1000 Protocols — `packages/g1000-protocols` | `packages/g1000-protocols/package.json`; `packages/g1000-protocols/README.md`; Go package under `packages/g1000-protocols/` | Go test target in root `go.mod`; no owned fixture located |
| G1000 Rendering — `packages/g1000-rendering` | `packages/g1000-rendering/package.json`; `packages/g1000-rendering/README.md` | no owned test file located |
| Keystore — `packages/keystore` | `packages/keystore/package.json`; `packages/keystore/README.md`; Python package under `packages/keystore/python/` | `packages/keystore/src/keystore.test.ts`; `packages/keystore/src/cli.test.ts` |
| Navigation Data — `packages/nav-data` | `packages/nav-data/package.json`; `packages/nav-data/src/` | none located |
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
| `packages/nav-data/src/` airport model/search | nav-data capability | reconcile when `aviation.nav-data` is promoted; remove its private geodesy in favor of `aviation.navigation` |
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
