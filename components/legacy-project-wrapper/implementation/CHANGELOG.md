# Changelog

## Unreleased

Build, test and container infrastructure repair, plus the React 19 unification.

### The suite builds and runs again

- `make build` invoked a bare `pnpm`, which is not installed and not implied by
  anything in the tree, so the monorepo was unbuildable from a clean checkout.
  The package manager is now pinned via `packageManager` and resolved through
  corepack when absent from `PATH`.
- Five projects declared TypeScript `^6`, which removed `moduleResolution:
  node10`; their builds died on TS5107. Moved to `node16`/`bundler` per package.
- `apps/flight-planner/frontend` and `apps/aviation-missions-app/frontend` were
  never listed as workspaces, so their dependencies never installed and they were
  excluded from every build. The workspace globs now cover `apps/*/frontend` and
  `apps/*/backend`.
- Two startup defects in aviation-accident-tracker: sqlite cannot create its own
  parent directory, and Express 5 rejects the bare `*` route.

### Containers and CI

- Seven Dockerfiles installed with npm, which cannot parse the `workspace:`
  protocol the packages use (`EUNSUPPORTEDPROTOCOL`), so no app image could
  build. All now install with pnpm from the workspace root; the remaining CI
  `npm ci` steps moved with them.
- Removed five committed npm lockfiles. They described React 17/18 trees, were
  unused once the images moved to pnpm, and still passed the peer guard — whose
  own premise ("the container builds install with `npm ci`") no longer held.
  `pnpm-lock.yaml` is the only lockfile.
- Added a root `.dockerignore`; every image builds from the repo root and was
  shipping `node_modules` and `.git` as build context.
- The MAC repository contract required `pnpm` and `lein` binaries that are not
  installed and not needed (corepack and Docker cover both).

### Tests actually run

- `make test` exercised no application suites at all, and the Python and Clojure
  targets printed success even when every suite had been skipped. All six
  application JS/TS suites are wired in, skips are reported honestly, and Go is
  covered for the first time.
- Python went from one suite to four (185 tests to 400) by falling back to the
  Docker test paths that already existed but were never invoked. flight-planner
  contributed zero tests before this: all four of its blocked files failed to
  collect. g1000-simulator ran only one of its two test directories, leaving 97
  tests unexecuted.

### Defects found by newly-running tests

- `CheckFuelAlert` was inverted: `LowFuelLevel` encoded its 10 gal floor as
  `MaxValue`, so a full tank warned and an empty one stayed silent.
- Both PID controllers differenced against `prev_error = 0` on the first sample,
  producing a derivative kick of `error/dt` — a control-surface spike at the
  moment a mode engages.
- `nav_database` imported three names its schema module never defined and built
  `NavProcedureSchema` from fields it does not have.
- The flight-recording endpoints returned 404 for everything because `create`
  never assigned an id; the `/ws` telemetry endpoint was never registered;
  `AHRS.compute_attitude` returned an undefined type.
- Airport lookups in aviation-accident-tracker silently returned nothing: the
  service queried the SDK database but never loaded it.
- `validateAirportCode` reported every malformed code as "required" because
  normalization collapsed them all to `''`.

### shared-sdk

- The barrel hid much of the package. `wind.ts` (crosswind limits, runway
  selection), weight & balance, and the only TAF client were unreachable from
  the package root; seven navigation result types were unnameable.
- Added pressure/density altitude, which existed only inside dead files.
- Ships ESM alongside CommonJS. Browser consumers previously depended on bundler
  interop luck — Vite 8 coped, Vite 7 did not.
- Promoted flight-planner's `TTLCache` into the Python SDK; the only cache there
  was Redis-backed and would have forced new infrastructure on consumers.

### React 19

- flight-planner and foreflight-dashboard were the last apps on React 18, held
  there by tsconfig `paths` pins forcing their react types to a local v18 copy.
  Both are now on 19 and the pins are gone.
- MUI 5 already declares `react ^19`, so no `Grid` call sites needed touching.
  The work was react-query v3 (unmaintained, peer-caps at 18) moving to
  `@tanstack/react-query` v5 across 11 files, plus react-leaflet 4→5,
  framer-motion 10→12, `@mui/x-charts` 6→7, testing-library 13→16 and vite 8.
- `ui-framework` and `aviation-config` advertised React 18 peers while depending
  on react-leaflet 5; both now say 19.

### Duplication removed

- aviation-accident-tracker carried two complete ingest implementations. The one
  the service runs had no tests; the one with all the tests was imported by
  nothing but its own tests. Coverage moved onto the live path (33 cases,
  including a pipeline test that previously hit the network and was excluded
  from the run).
- `ui-framework`'s `map.ts` shadowed the richer `map/` directory, making bounds
  math, wind barbs and hooks unreachable from the barrel — which is why
  flight-planner duplicated `windBarbSvg` locally.
- Retired a vestigial `g1000` stub superseded by `packages/g1000-rendering`, and
  eleven dependencies that no source file imported.

### Security

- `make audit` reported zero known vulnerabilities after bumping starlette,
  PyJWT, python-multipart and pytest in foreflight-dashboard. `audit-python`
  previously failed outright: it preferred a `python3.12` whose `ensurepip` is
  broken, and `audit-node` passed an option pnpm does not have.

## v0.1.1 - 2026-04-02

- fix(lint): stub out broken eslint lint script in g1000-simulator (no config)
- fix(lint): stub out broken eslint lint script in g1000-rendering (no config)
- chore: update compiled outputs and pnpm lockfile after build
- fix(build): resolve all make build failures
- chore: make release.sh executable
- docs: comprehensive update across all guides and READMEs
- chore(deps): bump react and @types/react (#215)
- chore(deps): bump express-rate-limit from 8.3.1 to 8.3.2 (#214)
- fix(ci): switch build-check to pnpm; wire missing API routers; fix plugin test (#227)
- chore(deps): bump dependabot/fetch-metadata from 2.5.0 to 3.0.0 (#222)
- chore(deps): bump docker/metadata-action from 5 to 6 (#223)
- chore(deps): bump codecov/codecov-action from 5 to 6 (#224)
- chore(deps): bump actions/setup-node from 4 to 6 (#225)
- fix(foreflight): implement ingest adapter error handling and stats (closes #178)
- docs: update to reflect pnpm workspace + test infrastructure changes
- fix(tests): resolve all test failures across monorepo + CI fixes
- merge: historical task-sync branch into main
- fix(ci): resolve 3 chronic CI failures + Trivy scan findings
- feat(aviation): AI explainer wired to all Express apps + TODO audit
- feat(aviation): search/filter API, export (CSV/JSON/GeoJSON), stats aggregations
- feat(aviation): NTSB phase/weather/injuries fields, rate limiter, SVG map
- feat(ingest): implement fuzzy event dedup in findExisting (issue #180)
- fix(tests): wire up classifier test suite — 34/34 passing
- fix: bump g1000-simulator to React 19 to resolve monorepo Build Check failure
- chore(deps-dev): bump typescript in /packages/keystore (#185)
- chore(deps-dev): bump typescript in /apps/flight-tracker (#187)
- chore(deps-dev): bump typescript in /apps/weather-briefing (#189)
- chore(deps-dev): bump typescript in /packages/ui-framework (#191)
- chore(deps-dev): bump typescript in /packages/shared-sdk (#193)
- chore(deps): bump react-dom from 18.3.1 to 19.2.4 (#183)
- chore(deps): bump starlette in /apps/foreflight-dashboard (#188)
- chore(deps): bump fastapi in /apps/foreflight-dashboard (#186)
- chore(deps): bump yaml from 2.8.2 to 2.8.3 (#182)
- chore(deps): bump graphql-ws from 6.0.6 to 6.0.7 (#184)
- chore(deps): bump @mui/x-data-grid in /apps/flight-planner/frontend (#199)
- chore(deps-dev): bump eslint-plugin-react-refresh (#195)
- chore(deps): bump pytest-cov in /apps/foreflight-dashboard (#194)
- chore(deps): bump faker in /apps/foreflight-dashboard (#192)
- chore(deps): bump docker/setup-buildx-action from 3 to 4 (#201)
- chore(deps): bump docker/login-action from 3 to 4 (#200)
- chore(deps): bump dependabot/fetch-metadata from 1.1.1 to 2.5.0 (#198)
- chore(deps): bump docker/build-push-action from 6 to 7 (#197)
- Merge pull request #208 from jordanhubbard/dependabot/npm_and_yarn/apps/foreflight-dashboard/frontend/npm_and_yarn-2096aead0f
- Merge pull request #207 from jordanhubbard/dependabot/npm_and_yarn/apollo/server-5.5.0
- Merge pull request #204 from jordanhubbard/dependabot/npm_and_yarn/apps/flight-planner/frontend/npm_and_yarn-66413a1f6e
- Merge pull request #203 from jordanhubbard/dependabot/pip/apps/foreflight-dashboard/requests-2.33.0
- Merge pull request #202 from jordanhubbard/dependabot/github_actions/actions/upload-artifact-7
- chore(deps): bump the npm_and_yarn group across 1 directory with 3 updates
- chore(deps): bump @apollo/server from 5.4.0 to 5.5.0
- chore(deps-dev): bump picomatch
- chore(deps): bump requests in /apps/foreflight-dashboard
- chore(deps): bump actions/upload-artifact from 4 to 7
- feat(accident-tracker): implement ASN and AVHerald ingest adapters
- feat(foreflight): implement aircraft classification stats + aircraft_stats
- feat: add ai-explainer shared package and integrate into flight-planner
- chore(deps-dev): bump the dev-dependencies group across 1 directory with 13 updates (#169)
- fix: correct flightplanner -> flight-planner paths in dependabot.yml
- chore(deps-dev): bump jsdom in /packages/ui-framework (#173)
- chore(deps): bump react-dom and @types/react-dom (#166)
- fix: resolve TypeScript compile errors blocking CI
- fix: suppress CVE-2026-31802 in .trivyignore (runner OS tar, not project dep)
- fix: exclude test files from TypeScript build tsconfigs
- chore(deps): bump pdfkit in /apps/aviation-accident-tracker/backend (#174)
- chore(deps): bump uvicorn in /apps/foreflight-dashboard (#172)
- chore(deps): bump pyjwt in /apps/foreflight-dashboard (#171)
- chore(deps): bump faker in /apps/foreflight-dashboard (#170)
- chore(deps): bump express-rate-limit from 8.3.0 to 8.3.1 (#167)
- chore(deps): bump express and @types/express (#165)
- chore(deps-dev): bump the npm_and_yarn group across 2 directories with 1 update (#175)
- chore(deps): bump typescript from 4.9.5 to 5.9.3 in the typescript group (#163)
- chore(deps): bump rollup (#162)
- feat: complete G1000 legacy tasks, unified aviation-config, and repo cleanup
- chore(security): patch aviation-accident-tracker lockfile for minimatch 9.0.7
- chore: refresh root package-lock.json after security overrides
- chore(security): fix remaining Dependabot alerts (minimatch, rollup)
- chore(flightschool): upgrade to Flask 3.1.3 and Werkzeug 3.x
- chore(security): fix minimatch ReDoS in frontends, document open alerts
- chore: apply Dependabot-relevant upgrades and document branch cleanup
- Merge origin/main: integrate remote with OpenClaw and doc sync
- chore: sync doc index (case normalization)
- feat: OpenClaw in-app chat (SDK, proxy, ChatPanel) + env-first config for Railway
- chore(flightschool): add coverage.xml to gitignore
- Merge ai-template conventions into CLAUDE.md
- Add forward link to Part 5 (WebMux) in origin story
- refactor: update g1000 packages, flight-tracker, weather-briefing, and shared deps
- chore: migrate legacy tasks from SQLite to dolt server mode
- fix(deps): address Dependabot/npm audit vulnerabilities
- fix(ci): fix Test Flight School and Integration Tests jobs
- Update README.md to streamline project overview and setup instructions, including a simplified architecture description, consolidated prerequisites, and enhanced application running guidelines.
- refactor: update import paths to include file extensions
- chore: remove duplicate doc paths (lowercase variants)
- Fix flightschool auth.py: syntax error and missing imports
- Fix round-9 flightschool requirements: add pytz, Pillow, google-auth packages
- Fix round-8: add filetype to flightschool requirements (imported by app/models.py)
- Fix round-7 CI: add requests to flightschool, mark flight-planner tests non-blocking
- Fix round-6 CI failures: python-dotenv for flightschool, ignore integration tests in pytest
- Fix round-5 CI failures: settings immutability, Flask deps, App.tsx comma, deploy non-blocking
- Fix round-4 CI failures: TS type errors, broken JSX, comment-only bodies, Flask-Migrate
- Fix round-3 CI failures: flask-login, service IndentationError, main.tsx hooks, scan non-blocking
- Fix remaining CI failures: flask-sqlalchemy, legacy tasks config, lock file, test indentation
- fix: resolve CI failures across all workflow jobs
- ci: fix workflow errors across all five workflow files
- docs: add Part 4 origin story to README
- Add responsible MCP framework
- [WIP] Resolve Dependabot PR #86 merge conflicts (#150)
- feat: implement alert acknowledgment handling
- feat: implement telemetry recording service
- feat: implement alert message stack manager
- feat: Implement telemetry recording module for flight playback
- feat: Add new training scenarios to the catalog
- fix: Update FLIGHT_PLANS_FILE path to be absolute
- fix: revert websocket compression change and prepare for polish optim...
- docs: Define simulator threat model with trust boundaries, data flows...
- feat: Create flight dynamics package with physics engine and FastAPI ...
- ci: Add integration test CI wiring with Docker Compose setup
- feat: Add basic Dockerfile, requirements.txt, and app.py for flightsc...
- feat: Add learner scoring metrics design document
- docs: Add summary of trademark and branding constraints for Garmin an...
- feat: Add performance regression checks to CI/CD pipeline
- feat: Add risk review checklist structure
- feat: Implement performance test harness for frame time and telemetry...
- docs: Define integration test scenarios for backend services and UI
- feat: Implement alert message stack and manager for G1000 simulator
- feat: Add initial MFD rendering modules for map, terrain, weather ove...
- fix: Correct syntax errors in FlightRecording model and initialize fl...
- feat: Add alert priority system in shared-sdk
- feat: Implement engine, fuel, and electrical alert rules with tests
- feat: Implement advanced features for G1000 simulator
- docs: Create comprehensive user manual outline with PFD/MFD sections ...
- docs: Add strategy and inventory for triaging Dependabot PRs
- feat: Define E2E test flows for simulator scenarios
- feat: Add educational enhancements to flightschool admin dashboard
- feat: Add storage adapter interface and cloud storage stub
- feat: Implement config loader and persistence layer
- feat: Add hold pattern and parallel offset support
- feat: Add Alt+1 and Alt+2 keyboard shortcuts for tab navigation
- feat: Implement SQLite persistence layer with schema migrations and C...
- feat: Implement plugin architecture and containerized testing setup f...
- docs: Define acceptance criteria for roadmap milestones
- test: add basic tests for AHRS and ADC simulation methods
- fix: Adjust bank and pitch limit thresholds for enhanced envelope pro...
- feat: Implement flight dynamics API layer with FastAPI endpoints
- docs: Add README for G1000 Simulator with development phases
- feat: Add end-to-end tests with Playwright for flight simulator scena...
- fix: Add Optional import to aircraft_model.py for correct type hinting
- feat: Implement approaches and procedures service for flight planning
- fix: remove redundant save_flight_plans() calls in flight_plan_servic...
- feat: Implement core drawing primitives for G1000 rendering
- docs: Define success metrics for simulator release
- chore(deps): merge uvicorn 0.41.0 bump (resolve conflict with fastapi 0.133.0)
- Merge remote-tracking branch 'origin/dependabot/pip/apps/foreflight-dashboard/pandas-3.0.1'
- Merge remote-tracking branch 'origin/dependabot/pip/apps/foreflight-dashboard/fastapi-0.133.0'
- Merge remote-tracking branch 'origin/dependabot/pip/apps/foreflight-dashboard/faker-40.5.1'
- Merge remote-tracking branch 'origin/dependabot/pip/apps/foreflight-dashboard/bcrypt-5.0.0'
- Merge remote-tracking branch 'origin/dependabot/pip/apps/flightschool/google-api-python-client-2.190.0'
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- chore(deps): bump faker in /apps/foreflight-dashboard
- chore(deps): bump fastapi in /apps/foreflight-dashboard
- chore(deps): bump bcrypt in /apps/foreflight-dashboard
- chore(deps): bump uvicorn in /apps/foreflight-dashboard
- chore(deps): bump google-api-python-client in /apps/flightschool
- chore(deps): bump pandas in /apps/foreflight-dashboard
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- [WIP] Auto-checkpoint after file changes
- legacy tracker sync: 2026-01-17 23:29:08
- legacy tracker sync: 2026-01-17 23:06:12
- legacy tracker sync: 2026-01-17 22:43:02
- legacy tracker sync: 2026-01-17 22:39:27
- legacy tracker sync: 2026-01-17 22:34:50
- legacy tracker sync: 2026-01-17 22:30:52
- legacy tracker sync: 2026-01-17 22:28:38
- legacy tracker sync: 2026-01-17 22:27:13
- legacy tracker sync: 2026-01-17 22:26:13
- legacy tracker sync: 2026-01-17 19:18:35
- legacy tracker sync: 2026-01-17 18:46:44
- legacy tracker sync: 2026-01-17 16:10:34
- legacy tracker sync: 2026-01-17 14:37:10
- legacy tracker sync: 2026-01-17 14:33:49
- legacy tracker sync: 2026-01-17 13:44:34
- legacy tracker sync: 2026-01-17 13:29:14
- legacy tracker sync: 2026-01-17 00:07:17
- legacy tracker sync: 2026-01-16 21:13:41
- legacy tracker sync: 2026-01-16 20:04:25
- legacy tracker sync: 2026-01-15 23:08:20
- legacy tracker sync: 2026-01-15 19:55:09
- legacy tracker sync: merge divergent histories (44 local + 24 remote commits)
- legacy tracker sync: 2026-01-15 13:06:08
- legacy tracker sync: 2026-01-15 13:04:02
- legacy tracker sync: 2026-01-15 12:51:38
- legacy tracker sync: 2026-01-15 12:41:55
- legacy tracker sync: 2026-01-15 12:25:14
- legacy tracker sync: 2026-01-15 12:21:49
- legacy tracker sync: 2026-01-15 11:48:38
- legacy tracker sync: 2026-01-15 11:32:16
