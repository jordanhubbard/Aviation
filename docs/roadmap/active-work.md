# Active work

This file is the durable resumption queue for user-directed and discovered work. Before
implementation, follow `skills/agent/record-user-directed-work/SKILL.md`.
Keep detailed designs in focused roadmap documents and link them here.
Record release scope in the [release-goal manifest](release-goals.json); the release
gate cross-checks it against this queue.

## Detailed-roadmap lifecycle

This file is the sole resumable queue. Create a supporting file beneath `docs/roadmap/`
only when one item cannot keep a program's rationale, ordering, and acceptance contract
readable. Put this visible header immediately after the detailed document's title:

```markdown
- **Status:** active
- **Owning queue item:** [AREA-NNN](active-work.md#area-nnn-heading)
- **Completion / archival evidence:** pending while AREA-NNN remains open
```

Status is exactly `active`, `partial`, `deferred`, `completed`, or `historical`. The
owner must resolve to a checkbox or named program heading in this file. A terminal state
requires linked evidence. Keep a completed plan here only when doing so preserves useful
inbound links; move substantial closed programs beneath `docs/history/roadmap/`, retain
their owner, and mark them `historical`. Do not create a separate file for an ordinary
queue item or let `docs/roadmap/` become a plan archive.

## P0

### [ ] ONBOARD-001 — Replace this starter item with the first project outcome

- **Owner:** project core
- **Direction:** Record the user's desired outcome without copying conversation noise.
- **Conclusion:** State the evidence-backed implementation boundary.
- **Depends on:** none
- **Implementation:**
  - [ ] Name the next concrete change.
- **Evidence:**
  - [ ] Name the build, test, execution, or review proof required for completion.

Check the parent only after every required subtask and evidence item passes. Add the
release-visible outcome to `CHANGELOG.md`; Git preserves prior queue states.

<a id="adopt-002"></a>
### [ ] ADOPT-002 — Native Literate AI rewrite

- **Owner:** project architecture / Components / Flavors / skills / assets
- **Direction:** Execute
  [ADR 0002](../decisions/0002-native-literate-ai-rewrite.md) through the
  [native rewrite program](native-rewrite-program.md), preserving retained source
  authority until each boundary independently qualifies. The target architecture is a
  rich common Aviation SDK made from independently specified and tested Literate AI
  Components; applications consume those capabilities and retain only behavior unique
  to the application.
- **Conclusion:** The retained workspace has useful shared packages, but package
  placement alone does not establish Component authority, cross-language behavioral
  equivalence, required SDK CI, or removal of duplicated app-local aviation logic.
  Promote one independently testable domain at a time, beginning with navigation, and
  do not transfer release authority until its retained realizations satisfy the same
  independent acceptance contract.
- **Depends on:** none; E2E-001 consumes the common SDK lifecycle after its contracts
  exist.
- **Implementation:**
  - [x] Define `aviation.navigation` as a native Component with a public interface,
    independent acceptance contract, and shared TypeScript/Python conformance vectors.
  - [x] Make common SDK tests a dedicated CI workflow rather than an optional side
    effect of application builds.
  - [x] Define `aviation.airports`, add synthetic cross-language normalization/query
    vectors, and migrate Flight Track Analyzer's duplicate dataset ingestion to the
    SDK while retaining only its application-specific vectorized spatial index.
  - [x] Define `aviation.weather`, add synthetic cross-language METAR/category/provider
    vectors, and replace Flight Planner's duplicated weather algorithms and provider
    clients with SDK compatibility surfaces.
  - [x] Define `aviation.nav-data`, add synthetic cross-language normalization/query/
    freshness vectors, and replace Flight Planner and G1000 navaid/procedure catalogs
    with SDK compatibility surfaces while retaining app-specific schemas and avionics
    state.
  - [x] Define `aviation.flight-dynamics`, add deterministic atmosphere/wind/PID/
    performance/model vectors, and replace Flight Planner's duplicate scalar physics
    and PID implementation with SDK compatibility adapters. Reconcile G1000's bounded
    PID implementation and duplicated C172 model fields onto the same capability.
  - [x] Qualify the remaining common flight-dynamics autopilot primitives with
    Component-owned axis-controller, mode-transition, autotrim, and envelope vectors;
    move their tests out of the G1000 application and remove Flight Planner's
    redundant app-local controller implementation.
  - [x] Qualify reusable flight-director active/armed/capture/disconnect transitions
    and migrate G1000 to the shared state machine while retaining capture thresholds,
    PID reset timing, simulator stepping, and limit annunciation as application policy.
  - [x] Qualify configurable fuel-reserve arithmetic in `aviation.navigation` and
    migrate Flight Planner's route time, fuel consumption, reserve, and range formulas
    to the common SDK while retaining route selection and refueling policy.
  - [x] Define `aviation.weight-balance`, add portable loading/envelope vectors, and
    replace Preflight Check's independent formulas with the built browser SDK
    realization while retaining aircraft-profile storage and presentation as app policy.
  - [x] Remove Flight Planner's five independent Python haversine implementations and
    route sampling, A* routing, local-airport planning, approach waypoints, and legacy
    navigation helpers through the Python `aviation.navigation` realization.
  - [x] Replace G1000's private route-distance and initial-course formulas with the
    Python `aviation.navigation` realization while retaining route assembly, catalog,
    response rounding, and presentation as simulator policy.
  - [x] Replace G1000 Trip Planning's private time/fuel, density-altitude, station-
    moment, and CG formulas and its duplicate C172 loading data with the TypeScript
    navigation and weight-and-balance realizations plus the shared C172 profile.
  - [x] Qualify pressure altitude, ISA temperature, and density altitude with shared
    TypeScript/Python navigation vectors and migrate Flight Track Analyzer to the
    Python realization. Retain its entered-POH interpolation, no-extrapolation rule,
    wind normalization, and measured-track comparison as analyzer-specific policy.
  - [x] Remove G1000 and Flight Planner's unused private geodesy service scaffolds;
    their methods were never called and returned only `None` or constant zero, while
    realized route distance and bearing already delegate to `aviation.navigation`.
  - [x] Qualify headwind/crosswind components, wind-correction angle, corrected
    heading, and along-course ground speed with shared TypeScript/Python vectors;
    migrate Flight Planner's bearing, wind-component, and wind-triangle arithmetic to
    the Python realization while retaining its 30-knot planning floor as app policy.
  - [x] Inventory common airspeed and aircraft-configuration behavior; qualify the
    shared SDK's public planning IAS/TAS and ISA Mach conversions with cross-language
    valid/invalid vectors. Confirm Flight Planner and G1000 already delegate sensor
    air data to `aviation.avionics`, while G1000's backend C172 compatibility record
    derives from `aviation.flight-dynamics` and retains only telemetry/display shape.
  - [x] Qualify a portable `aviation.aircraft` operating-profile surface with shared
    TypeScript/Python valid and fail-closed vectors; add the missing Vfe limit to the
    common C172S model and make G1000 Airspeed Tape derive its arcs and Vne marker from
    that authority while retaining only scale, trend, styling, and presentation code.
  - [x] Expand `aviation.aircraft` with a real Python SDK realization, stable ICAO
    lookup, fuel and weight limits, dimensions, and cited reference performance.
    Remove Flight Planner's unused contradictory C172 YAML profile; make its plan
    defaults and FPL export plus G1000's selector and backend compatibility record
    consume the common profile while retaining user loading and planning policy.
  - [x] Define `aviation.avionics` protocol and rendering contracts, add deterministic
    telemetry/command/flight-plan/layout/pipeline vectors, and replace G1000's duplicate
    frontend telemetry schema with the shared protocol surface. Keep simulator stores,
    transport hooks, display composition, and placeholder device models outside this
    authority until separately qualified.
  - [x] Qualify shared AHRS, ADC, and GPS device models with cross-language vectors and
    migrate G1000 and Flight Planner away from app-private implementations and stubs.
  - [x] Qualify deterministic ADF and DME receiver models with cross-language station,
    tuning, geometry, service-volume, and unavailable-signal vectors; make G1000 consume
    the common models and the common navigation-data catalog instead of fixed-zero
    app-private placeholders.
  - [x] Qualify deterministic marker-beacon, audio-panel, and transponder state models
    with cross-language vectors; migrate G1000 to common state transitions while
    retaining audio playback, COM transmission, simulator orchestration, and physical
    device I/O as application-private behavior.
  - [ ] Promote airports, weather, procedures/nav-data, flight dynamics, avionics
    protocols/rendering, shared UI, configuration, and integration infrastructure into
    explicit Components with owned tests and contracts.
  - [ ] Migrate each application to those capabilities and remove app-local common
    aviation implementations after parity qualification.
  - [ ] Classify and remove or intentionally retain every remainder beneath the legacy
    wrapper.
- **Next action:** Reconcile G1000 Trip Planning's C172N sample loading profile with its
  C172S simulator identity by qualifying a C172S loading profile in
  `aviation.weight-balance`, linking it explicitly to `aviation.aircraft`, and
  retaining entered station weights and fuel as application state.
- **Evidence:** Phase 1.2 lift-and-shift identity `sha256:c5ca4361ba010f6e8d81c93398468f9f4f8b8cc352504bc8535fa74b7c6e9990`.
  Retained conversion stage is backed by current test receipt
  `sha256:60e252aceb5834018a21d3ec5a75b667c564e207ea3cf02d475b3245640c3c79`;
  original source remains release authority.
  The first native boundary has Component lock
  `sha256:b156aad3a60d74a7eba30b6f4e7ba5d8cc01c8ecc2d7c41a069348db6ed75a9b`;
  its shared acceptance vectors pass 292 TypeScript and 94 Python SDK tests, and
  the full retained `make test` gate passes locally. Literate AI issue
  [#212](https://github.com/jordanhubbard/literate-ai/issues/212) tracks the
  verifier false positive caused by third-party `component.json` files under the
  retained implementation's `node_modules`; generated dependency trees remain
  outside authority, and current Component locks and `litai verify` pass.
  Autopilot-primitives qualification passes 20 independent flight-dynamics tests,
  25 G1000 compatibility tests, and the 321-test retained receipt; Flight Planner's
  redundant controller module and G1000-owned common-package test file are removed.
  Flight-director qualification passes 22 independent flight-dynamics tests, 26
  G1000 compatibility tests, and the 321-test retained receipt; G1000 has no remaining
  direct assignments for common engagement, active/armed mode, capture, target
  vertical-speed, or disconnect state.
  Configurable navigation-fuel qualification passes 328 TypeScript and 109 Python
  shared-SDK tests plus all 126 non-integration Flight Planner tests; delegation tests
  prove the application calls common time, consumption, reserve, and range operations
  while retaining route selection and refueling policy.
  Weight-and-balance qualification passes 335 TypeScript SDK tests, six portable
  Component vectors, two Preflight Check SDK-wiring tests, the shared SDK build, and a
  clean deployment-container definition check; the app-local formulas are removed.
  Flight Planner geodesy consolidation passes all 126 non-integration application
  tests, including three boundary tests proving shared distance semantics, invalid
  coordinate rejection, and absence of the five former app-local formulas.
  G1000 route-geodesy consolidation passes all 29 backend tests, including three
  boundary tests proving shared distance/bearing semantics, invalid-coordinate
  rejection, and absence of the former app-local formulas.
  G1000 Trip Planning consolidation passes all 71 retained TypeScript tests, including
  three SDK-boundary tests for fuel/reserve, density altitude, shared C172 loading, and
  absence of the former display formulas; all 29 backend tests and the production
  frontend build also pass.
  Performance-altitude parity passes 340 TypeScript and 109 Python SDK tests across
  four new shared vectors plus invalid-setting rejection; all 66 Flight Track Analyzer
  tests pass, including a source boundary proving its atmospheric conditions call the
  common Python realization.
  The G1000 and Flight Planner private geodesy service placeholders were classified as
  non-realized scaffolding and removed with application boundary tests preventing their
  reintroduction; all 30 G1000 backend tests and 178 non-integration Flight Planner
  tests pass after removal.
  Wind-triangle qualification adds seven shared valid/invalid vectors, corrects the
  SDK's former headwind sign and vector-magnitude ground-speed error, and passes 347
  TypeScript SDK tests, 109 Python SDK tests, and all 179 non-integration Flight Planner
  tests plus eight subtests. The navigation lock is
  `sha256:0c87dbea0947d441af3e99ff548a6e0b3a3914d2296b9fdc82a395507c83915e`.
  Airspeed/configuration inventory confirms both application ADC adapters are pure
  `aviation.avionics` delegations and the G1000 backend C172 record maps the common
  flight-dynamics model. Eight new navigation vectors qualify standard-day and
  hot/high IAS-to-TAS, TAS/Mach conversion, and negative/domain rejection; all 355
  TypeScript SDK tests, 109 Python SDK tests, two Flight Planner ADC tests, and six
  G1000 aircraft/autopilot compatibility tests pass. G1000's frontend V-speed constants
  were the next unqualified aircraft-profile boundary.
  Aircraft-profile qualification adds a dedicated `aviation.aircraft` Component and
  eight invalid-profile vectors; 364 TypeScript SDK tests, 25 Python flight-dynamics
  tests, four G1000 SDK-boundary tests, and the production G1000 frontend build pass.
  The airspeed tape now imports the common C172S profile and contains no private V-speed
  constants; Python model validation also rejects non-finite speeds and invalid limit
  ordering.
  Aircraft-reference qualification advances the Component lock to
  `sha256:4d5ce77ed3ee64c3e4d7332077deadf99916e239b50d918f4fd3259edf8de61b`
  with 14 fail-closed mutations and four ID/designator lookup vectors. The independent
  suites pass 374 TypeScript and 128 Python shared-SDK tests plus 25 flight-dynamics
  tests. Flight Planner passes 182 non-integration Python tests, 12 frontend tests, and
  a production build; G1000 passes 73 TypeScript and 30 Python tests plus its production
  frontend build. Its former private aircraft YAML is removed, and cited C172S values
  correct total/usable fuel to 56/53 gallons and the common maximum-cruise, climb, and
  landing reference figures.
  Navigation and the dedicated SDK workflow landed in PR #339 at exact-main commit
  `9c55e4ac70dbc87def6d5ce6e6abc47aed214304`; all seven exact-commit workflows
  passed. Airports landed in PR #340 at exact-main commit
  `67d505a9ab47e3584b094c41f6d5abdcbdc99d2d`; all six exact-commit workflows
  passed, including Common Aviation SDK run 41103415439, Integration Tests run
  41103415429, Monorepo CI/CD run 41103415361, and deployment-image run
  41103415358. The airport graph lock is
  `sha256:82d0bbe3f36eaf3c1640681036821db992629db80a6a0eee0b823b09dace083d`.
  Weather landed in PR #341 at exact-main commit
  `5ccbe7d889ec7e92fa94d7bf2591b43748ac5ece`; all six exact-commit workflows
  passed, including Common Aviation SDK run 41105586694, Integration Tests run
  41105586797, Monorepo CI/CD run 41105586686, and deployment-image run
  41105586742. The weather Component lock is
  `sha256:a176e62833839cca2fbbe897ee68de0cccdd2d2b514041f1184b6b920bb3f9fc`.
  Nav-data core landed in PR #342 at exact-main commit
  `079af9398dcf540c8dbe4b5d9760e322493f77b5`; all seven exact-commit workflows
  passed, including Common Aviation SDK run 41110871727 and Integration Tests run
  41110871688. Provider reconciliation landed in PR #343 at exact-main commit
  `1a9d42c8b02ada926f173474f66eb7a4ea3d6efd`; all six direct exact-main workflows
  passed, including Common Aviation SDK run 41115026210, Integration Tests run
  41115026166, Monorepo CI/CD run 41115026320, and deployment-image run 41115026360.
  Flight dynamics and Flight Planner delegation landed in PR #344 at exact-main commit
  `55088f0b33ab4fbda8df82a17744632ef1fc5f6f`; all seven exact-main workflows passed,
  including Common Aviation SDK run 41119233841, Integration Tests run 41119234024,
  Monorepo CI/CD run 41119234068, deployment-image run 41119233837, and dependency
  graph run 41119239572. G1000 flight-dynamics reconciliation landed in PR #345 at
  exact-main commit `7c36bd734185fdb83e2e4219bc5d5e6d9de2108b`; all seven exact-main workflows
  passed, including Common Aviation SDK run 41122926192, Integration Tests run
  41122926152, Monorepo CI/CD run 41122926122, deployment-image run 41122926237,
  Dependency Scan run 41122926302, Performance Regression Check run 41122926123,
  and dependency graph run 41122936981. The avionics protocol/rendering slice has
  Component lock
  `sha256:d0adc77ef53c41396e29dc8e583bbbca075c56a72a76097c6eab93a25c702892`;
  3 protocol and 3 rendering conformance tests, the production G1000 frontend build,
  all 68 retained G1000 TypeScript tests, all 101 G1000 Python tests, and the full
  retained `CI=true make test` lifecycle pass locally. The slice landed in PR #346 at
  exact-main commit `217f985f70fb599c47bdad3016cc85248ae9d5db`; all six triggered
  exact-main workflows passed, including Common Aviation SDK run 41127278668,
  Integration Tests run 41127278697, Monorepo CI/CD run 41127278760, deployment-image
  run 41127278767, Dependency Scan run 41127278888, and Performance Regression Check
  run 41127279392. The AHRS/ADC/GPS slice has Component lock
  `sha256:510968d491836d091a50a5cd3962ea0a75ab9b56f31fda82a4d7e2f269eef4f8`;
  four TypeScript and four Python device conformance tests pass from shared vectors,
  all 77 G1000 Python compatibility tests pass, all 173 Flight Planner backend tests
  pass, and the retained `CI=true make test` lifecycle passes locally. Retained source
  readmission passed with baseline identity
  `sha256:26d3daabc4953bb168715e1d727c273ce07487281d2a1fd6b0f03f12eff5e6ee`
  and parity identity
  `sha256:abb50e5f62745c7c590773e1b518f73e524e06e0bc3601e5f5d3c5c9c9fecaa9`.
  The ADF/DME slice has Component lock
  `sha256:fa177de4924d455d393237f750d05ea9ebc4993bc1912fe0e4f13930abed6865`;
  seven TypeScript and seven Python avionics conformance tests pass, all 61 G1000
  Python compatibility tests pass, and retained source readmission passed with
  baseline identity
  `sha256:ef3451131134d83d1ead44c8bbfefe47868db6e65355c8f3d80ce5c11ce5bc60`
  and parity identity
  `sha256:5436a2ed6cb02e12eee0ddbbd8c1750fca184980aa459bbdf31b0f04d732b08a`.
  The marker-beacon/audio-panel/transponder slice has Component lock
  `sha256:e5df5a1dd6e3c3427a411738ba0a56da88050866bb96de2e88f07d0f98b727e4`;
  nine TypeScript and nine Python avionics conformance tests pass, all 64 G1000 Python
  compatibility tests pass, and retained source readmission passed with baseline
  identity `sha256:3655035fb873c9c31ba28776c819ff4de1d9d7de579d9e810516a9d83cd300a6`
  and parity identity
  `sha256:4f5acf5f618ab336bf169ec84d4f1068f4754702371d1ff0d63c093880d5deee`.
  The current retained receipt is
  `sha256:7777144b36eeb981175a7576380da49d322083dd3c7f21897cfe89f13e1bc8d7`
  (candidate `sha256:94d8b8f65d112d5e671141168f832831afb49755cdec9ccba6f6f0c93453758e`,
  347 tests).
  The ADF/DME slice landed in PR #348 at exact-main commit
  `f3da7e3406b6b2d04b95da03217231d1b7313a1e`; all six exact-commit workflows
  passed: Common Aviation SDK run 41137297070, Integration Tests run 41137297059,
  Monorepo CI/CD run 41137297055, deployment-image run 41137297063, Dependency Scan
  run 41137297214, and Performance Regression Check run 41137297025.
  - [ ] Each promoted Component has a current lock, independent acceptance evidence,
    and exact-main CI evidence.
  - [ ] An architecture inventory proves every application imports common capabilities
    and contains no duplicated common aviation implementation.
  - [ ] Full retained parity, deployment E2E, and a current authenticated Literate AI
    receipt prove the wrapper can be retired.

### [x] ADOPT-003 — Preserve Aviation interfaces and integrate flight analyzer

- **Priority:** P0
- **Owner:** components/legacy-project-wrapper and flight-analyzer
- **Direction:** Keep existing Aviation functionality after Literate AI adoption and merge the KML flight analyzer with airport MSL elevation access.
- **Conclusion:** The CLI lift-and-shift preserved retained source and wrapper parity but moved the old workspace paths and workflows below the retained Component. Restore compatible entrypoints, then add the analyzer as an Aviation application and use the existing bundled airport dataset as optional corroborating touchdown evidence.
- **Depends on:** ADOPT-002 retained source boundary; KMLab FLIGHT-002
- **Implementation:**
  - [x] Restore root workspace and CI entrypoints against the retained implementation (root symlinks, Make wrapper, and GitHub workflows)
  - [x] Integrate KMLab source, API, UI, tests, and runtime paths as an Aviation app (`apps/flight-track-analyzer`)
  - [x] Add airport identity and MSL elevation to landing analysis with bias, missing-data, and proximity safeguards (61 analyzer tests)
- **Evidence:**
  - [x] Literate AI project validate and verify pass (authority, two locks, current retained receipt at 4646278fb)
  - [x] Existing Aviation app tests and all 54 KMLab tests pass in the merged tree (`make test`: 13 Node suites, Go, 61 analyzer tests)
  - [x] Synthetic touchdown tests exercise airport elevation, GPS bias, touch-and-go, and go-around (`app/tests/test_airports.py`)
  - [x] Hosted CI confirms retained apps and new analyzer after push (PR #304, a5fa6fa9d: 19 checks passed, Dependabot skipped)

### [x] ADOPT-004 — Repair retained deployment workflow after conversion

- **Priority:** P0
- **Owner:** workflows/deploy.yml
- **Direction:** Restore the main-branch deployment dry run after the Literate AI source relocation.
- **Conclusion:** The job-level working directory is unavailable before checkout, and Docker builds must use the real retained implementation as context so workspace COPY instructions see actual files.
- **Depends on:** ADOPT-003 merged adoption
- **Implementation:**
  - [x] Remove the unnecessary workflow-wide working directory and point Docker actions at the retained implementation (`.github/workflows/deploy.yml` in PR #305).
- **Evidence:**
  - [x] Workflow YAML parses, PR #305 passed 19 checks, and exact main run 39905597056 built four images and passed the staging dry run at c8b958a34.

### [x] DEPLOY-001 — Deploy every Aviation application with KMLab-style services

- **Priority:** P0
- **Owner:** retained application deployment and monorepo operations
- **Direction:** Build, run, and deploy every Aviation application from the monorepo using KMLab-style service management, unique loopback ports, DNS names, and live public checks.
- **Conclusion:** All eleven applications build and deploy from Aviation with unique loopback ports, DigitalOcean DNS records, systemd units, and public HTTPS health checks. Application revision d619a2c0 is deployed; later main commit 6db095f3 changes only this roadmap and passed exact-main CI. Accident Tracker serves 742 recent NTSB records with source attribution. OpenClaw is an optional upstream integration for Chat's `/chat` route, not a dependency of the Aviation build or deployment. Existing Sentiment workers drive do-host1's memory and swap use; the 16 GiB rescue swapfile is persistent while a dedicated-host option is considered.
- **Depends on:** ADOPT-003; ADOPT-004
- **Optional follow-up:** A dedicated Aviation droplet would isolate the eleven services from Sentiment; choosing and cutting over that host is a separate infrastructure decision.
- **Implementation:**
  - [x] Inventory each application runtime, data and credential requirements; keep the manifest aligned with its actual health path and writable state.
  - [x] Build and smoke-test deploy packages from committed Aviation source; qualify the exact revision on native amd64 CI.
  - [x] Install idempotent systemd/Caddy services with unique loopback ports, health checks, and rollback; preserve the existing analyzer service and its airport data.
  - [x] Increase host capacity, register DNS, and deploy each service serially with resource checks.
- **Evidence:**
  - [x] All eleven application build gates pass, including native analyzer tests and ten target-architecture container images (exact-main image run 39927730949; all eleven public health routes returned HTTP 200 after the serial rollout).
  - [x] Project verification passes three applicable gates, the retained receipt covers 273 tests, PR #314 checks passed, and all exact-main workflows for d619a2c0 completed successfully.
  - [x] All eleven active units and Caddy sites validate, and every DNS name responds over HTTPS to a meaningful health request.
  - [x] Accident Tracker's live API returns 742 NTSB events with official source URLs; repeated ingestion updated the same records without duplicates.
  - [x] The deployment verifier confirms all eleven public DNS names resolve to do-host1 and their service health routes return HTTP 200; OpenClaw-dependent chat behavior is outside this deployment check.

### [x] ACCIDENT-001 — Discover and display accident citations

- **Priority:** P1
- **Owner:** retained Accident Tracker backend, frontend, and source attribution contract
- **Direction:** Find relevant media and aviation reports when accident records are ingested and show citations in an expandable table row.
- **Conclusion:** Reuse event source attribution, discover bounded feed articles with registration and date matching, preserve provenance and deduplication, and render accessible inline citations.
- **Depends on:** Existing NTSB ingest and source repository
- **Implementation:**
  - [x] Add bounded concurrent media feed discovery and persistence; expose citation metadata; add expandable table rows and targeted tests.
- **Evidence:**
  - [x] Deterministic matching and persistence tests, frontend interaction test, and application build pass locally.
  - [x] PR #317 and citation correction PR #318 merged; exact-main image run 40108419185 passed. The public event API exposes the verified AeroTime N514AX crash article with its NTSB source, and the browser disclosure passes. An unrelated AOPA link was removed and did not recur after ingestion.

### [x] CHAT-001 — Explain Aviation Chat at its root URL

- **Priority:** P2
- **Owner:** retained Aviation Chat service
- **Direction:** Make the public root URL explain what Aviation Chat does instead of showing Cannot GET /.
- **Conclusion:** The service is an API proxy with POST /chat and no browser UI; serve a simple informational root page.
- **Depends on:** none
- **Implementation:**
  - [x] Add a root route and document the API-only behavior.
- **Evidence:**
  - [x] Service build passes locally.
  - [x] Public root and health return HTTP 200; the full eleven-service browser sweep confirms the root, and an invalid POST /chat returns HTTP 400.

### [x] FLIGHT-001 — Repair deployed Flight Planner and add browser deployment gates

- **Priority:** P0
- **Owner:** retained Flight Planner frontend and Aviation deployment verification
- **Direction:** Fix the live TypeError and verify rendered application behavior after deployment under Literate AI gates.
- **Conclusion:** The frontend requests a nonexistent /api/flight-plans route, accepts its 404 JSON body as an array, and crashes at render; use the available /flight-plans/ route with response validation, then make browser smoke checks a deployment gate.
- **Depends on:** none
- **Implementation:**
  - [x] Repair fetch and saved-plan mapping; add regression coverage; add post-deployment rendered checks for browser apps and API-only chat.
- **Evidence:**
  - [x] Live browser reproduction, frontend tests, and full build pass locally; the new browser gate rejects the deployed error page.
  - [x] Public Chromium sweep loads Flight Planner, opens its saved-plans dialog without an error boundary, and passes for all eleven service roots.
  - [x] Retained source scope and test receipt are refreshed; `litai verify` passes all three applicable gates.

### [x] FORE-001 — Accept overlapping solo and PIC logbook time

- **Priority:** P1
- **Owner:** retained ForeFlight Dashboard validator and deployed browser contract
- **Direction:** Treat solo time as overlapping PIC time for a certificated pilot, and verify a representative ForeFlight upload after deployment.
- **Conclusion:** The existing time-accountability sum counts solo and PIC twice. Preserve both fields and show a validation error only when the covered flight time is inconsistent.
- **Depends on:** ForeFlight CSV importer and public deployment browser gate
- **Implementation:**
  - [x] Correct the validator, add model and upload regressions, and add a post-deployment browser upload check.
- **Evidence:**
  - [x] ForeFlight Dashboard test suite passes locally (188 tests).
  - [x] PR #319 merged; exact-main ForeFlight image deployed. Public Chromium gate uploads 0.2 total / 0.2 PIC / 0.2 solo CSV, observes zero validation errors, and renders the dashboard without an error banner; full eleven-service sweep passes.

### [x] FORE-002 — Avoid false excessive-landing errors

- **Priority:** P1
- **Owner:** retained ForeFlight Dashboard validator and deployed browser contract
- **Direction:** Accept rapid pattern-work landing counts, including eight landings in half an hour, without declaring valid data erroneous.
- **Conclusion:** The current rule assumes a four-minute minimum between landings and cannot infer an impossible rate from total flight time alone; remove the frequency heuristic as a data validation error while retaining concrete consistency checks.
- **Depends on:** FORE-001
- **Implementation:**
  - [x] Remove the 15-landings-per-hour error and add representative model and upload regressions.
- **Evidence:**
  - [x] PR #321 merged at eeb4e684b; 190 local ForeFlight tests, the 273-test retained receipt, and three Literate AI gates pass. The exact-main image is deployed; its public Chromium upload of eight landings in 0.5 hours returns zero errors, and the full eleven-service browser sweep passes.

### [x] FORE-003 — Repair ICAO designator verification link

- **Priority:** P1
- **Owner:** retained ForeFlight Dashboard ICAO validator
- **Direction:** Give pilots a working authoritative lookup when an aircraft type code is invalid.
- **Conclusion:** The error links to a nonresolving domain and the validator documents two obsolete ICAO URLs; use ICAO current Doc 8643 search page as the single remediation destination.
- **Depends on:** FORE-001
- **Implementation:**
  - [x] Update validation message and resource metadata, and test the exact C82S remediation URL.
- **Evidence:**
  - [x] ICAO's current Doc 8643 search page returned HTTP 200. PR #321 merged at eeb4e684b; 190 ForeFlight tests and Literate AI verification pass. The deployed public browser upload of invalid C82S shows the current ICAO URL in the expanded row, and the full eleven-service sweep passes.

### [x] ACCIDENT-002 — Show sourced accident cause badges

- **Priority:** P1
- **Owner:** retained Accident Tracker ingestion, repository, and frontend
- **Direction:** Classify accident causes from available accident data and relevant reports, showing Unknown only when no supported cause is available.
- **Conclusion:** NTSB weekly data carries probable-cause narratives, flagged findings, and event sequences, while matched aviation reports can state mechanisms. Store sourced labels separately from flight category, distinguish official cause, NTSB occurrence, and reported mechanism, and show them in accident rows.
- **Depends on:** ACCIDENT-001 citation ingestion
- **Implementation:**
  - [x] Extract explicit cause labels from NTSB probable-cause data and matched reports; persist attribution across ingestion and deduplication; render cause badges and evidence in row details.
- **Evidence:**
  - [x] Local backend extraction and persistence tests (51 Vitest, 2 Python), frontend interaction tests (64 Vitest), and both app builds pass.
  - [x] Literate AI retained test receipt refreshed and `litai verify` passed for implementation commit 396a0ce5a.
  - [x] PR #323 checks passed and merged at b03fd66e3; exact-main CI 40121936341 and image build 40121936340 passed. The image was deployed on do-host1, public health and browser checks passed, and all eleven public app browser checks passed. Live API returned 742 events with 30 loss-of-control, 21 engine-failure, 3 CFIT, 8 fuel-exhaustion, and 1 weather attribution; a Chromium row check verified N30718's badge and NTSB source link. Unclassified events still show Unknown.

### [x] FLIGHT-002 — Remove unrelated planner demo controls and canvas

- **Priority:** P2
- **Owner:** retained Flight Planner frontend
- **Direction:** Explain and correct the initial blank canvas and joystick controls visible in Flight Planner.
- **Conclusion:** App.tsx mounts a G1000 demo control and fixed sample canvas globally; neither powers the real plan maps. Remove those shell mounts while preserving the form and its existing pre-plan empty state. MAC task task_429cbcaff6a84f06a383bac4c1c9eb83 tracks the same work.
- **Depends on:** FLIGHT-001 deployed planner
- **Implementation:**
  - [x] Remove global demo components from the planner shell and cover the initial view in a rendered post-deployment browser check.
- **Evidence:**
  - [x] Flight Planner frontend build and 8 tests pass; the new browser check rejects the current deployed demo controls.
  - [x] Retained source scope, test receipt, and `litai verify` passed for PR #325; all PR checks passed and merged at b350ad59d.
  - [x] Exact-main CI 40123358725 and image run 40123358794 passed. do-host1 runs the b350ad59d Flight Planner image; public health, initial-view browser check, and eleven-app sweep passed.

### [x] META-001 — Navigate to every Aviation service from Meta App

- **Priority:** P2
- **Owner:** retained Meta App and deployment browser verification
- **Direction:** Ensure all deployed Aviation applications can be opened from Meta App.
- **Conclusion:** The deployed manifest has eleven entries; Meta App is the current application and has links to nine of the other ten. Add the missing Aviation Chat destination and use the manifest as the browser gate for destination completeness. MAC task task_c7befa4095b74be7967535e52557d21b tracks the same work.
- **Depends on:** DEPLOY-001 public DNS
- **Implementation:**
  - [x] Add Aviation Chat destination to Meta App and assert each other deployed application has a matching launch link.
- **Evidence:**
  - [x] Meta App and dependencies build; the manifest browser check rejects the current deployed launcher because Aviation Chat is missing (9/10 destinations).
  - [x] Retained source scope, test receipt, and `litai verify` passed for PR #325; all PR checks passed and merged at b350ad59d.
  - [x] Exact-main CI 40123358725 and image run 40123358794 passed. do-host1 runs the b350ad59d Meta App image; the public browser gate confirmed all ten outbound links match the manifest, and all eleven app roots passed.

### [x] ACCIDENT-003 — Improve tracker provenance, freshness, filters, and search

- **Priority:** P1
- **Owner:** retained Accident Tracker backend, frontend, and deployment browser contract
- **Direction:** Show source and last sync time, make category filtering useful, expand abbreviations in selectors, and support natural-language accident search without an external token.
- **Conclusion:** The live category filter applies correctly but all 742 events are unknown because NTSB FAR part is dropped. Preserve source attributions in list rows, persist successful ingest time, classify NTSB operation from FAR part, display full country/state labels, and map plain-language search to explicit supported filters with a deterministic parser.
- **Depends on:** ACCIDENT-002 sourced causes
- **Implementation:**
  - [x] Add list-row sources, durable ingest status, NTSB operation classification, readable filter labels, and a deterministic query parser with UI and post-deployment coverage.
- **Evidence:**
  - [x] Backend and frontend tests (53 backend and 67 frontend), live category counts (457 general, 40 commercial, 245 unknown), successful ingest status (741 updated), deterministic search tests and live browser query for general aviation in California passed. PR #327 merged at f20475a07; exact-main image CI, all-app browser gate and Literate AI verification passed.

### [x] MISSIONS-001 — Add written feedback under completed missions

- **Priority:** P1
- **Owner:** retained Aviation Missions backend and frontend
- **Direction:** Allow pilots to add comments under a completed mission.
- **Conclusion:** The Completed action currently records a pilot name and empty notes but offers no way to view or submit feedback later. Add a completion detail view with written feedback persisted against the completion, with no file attachments.
- **Depends on:** Existing mission completions API
- **Implementation:**
  - [x] Persist feedback comments for a completion and render submission and history beneath Completed.
- **Evidence:**
  - [x] Clojure API and DB tests (9 tests, 78 assertions), live rendered browser submission with a synthetic intercepted completion, Literate AI verification, reviewed PR #327 and exact-main image CI passed; deployment verification passed for all 12 apps.

### [x] FEEDBACK-001 — Submit contextual GitHub feedback from every Aviation app

- **Priority:** P1
- **Owner:** Aviation
- **Direction:** Add a shared feedback widget and server issue endpoint to all eleven deployed apps
- **Conclusion:** A feedback control in every app should collect a short description and create an Aviation monorepo issue with the current app, page, and browser context; keep GitHub credentials on the server and limit abuse.
- **Depends on:** none
- **Implementation:**
  - [x] Build a shared widget served by meta-app, install it in each app document, provide a server-side GitHub Issues endpoint with validation and rate limits, and provision a scoped credential on do-host1.
  - [x] Load the widget independently on KMLab, where its module graph delays deferred scripts; allow the widget and issue API in ForeFlight Dashboard's CSP; verify the rendered buttons on both deployed hostnames.
- **Evidence:**
  - [x] Widget/API tests, all 12 public browser checks, and live issue creation (#328, closed after smoke) passed. PRs #327 and #329, exact-main CI and image run 40128092475 passed; all services and health endpoints passed deployment verification.

### [x] PREFLIGHT-001 — Add GA preflight weight and balance application

- **Priority:** P1
- **Owner:** Aviation
- **Direction:** Build a preflight tool for aircraft-specific loading, takeoff and landing CG, and pilot risk review
- **Conclusion:** The suite covers weather and route planning but lacks an aircraft-specific loading and preflight risk workspace. FAA AC 91-92 and Weight and Balance Handbook support this capability.
- **Depends on:** none
- **Implementation:**
  - [x] Add a browser-local preflight app requiring user-entered POH/AFM limits and stations; compute takeoff and landing weight/CG against an envelope, persist profiles locally, and link from Meta App.
- **Evidence:**
  - [x] Calculation unit tests, live browser weight/CG example and Meta App link, exact-main CI/image build, DNS and deployment verification passed at preflight-check.jordanhubbard.net.

### [x] META-002 — Show only pilot-facing apps in Meta App

- **Priority:** P2
- **Owner:** retained Meta App and deployment browser verification
- **Direction:** Remove the internal Aviation Chat API from the Meta App launcher because it has no user-facing UI.
- **Conclusion:** Keep Aviation Chat deployed as an API service, but exclude it from Meta App navigation and from the launcher destination contract.
- **Depends on:** META-001
- **Implementation:**
  - [x] Remove Aviation Chat from the launcher app list while retaining its API deployment; update the browser contract to expect only pilot-facing destinations.
- **Evidence:**
  - [x] Meta App production build and rendered launcher check showed ten pilot-facing destinations and no Chat card. The 273-test retained harness and `litai verify` passed; PR #330 merged at 302c8dbe6 with all 32 checks green. Exact-main image run 40129107242 succeeded, the 302c8dbe6 Meta App image was deployed, and all 12 public browser and health checks passed, including the separately running Chat API.

<a id="e2e-001"></a>
### [ ] E2E-001 — SDK-owned isolated remote application E2E harness

- **Priority:** P1
- **Owner:** shared SDK, all deployed apps, and deployment verification
- **Direction:** Exercise every application screen remotely with SDK-provided mocks and sample data that is explicitly tagged and isolated from production records, then clean it up after each test run.
- **Conclusion:** The current remote browser gate covers roots and selected interactions only. Build reusable SDK E2E fixtures and lifecycle controls, enforce production/test data separation in every persistent app, inventory and exercise all app screens, verify cleanup after both success and failure, and make this a post-deployment gate.
- **Depends on:** DEPLOY-001 public DNS and existing browser smoke gate
- **Implementation:**
  - [ ] Define SDK test-run identity, isolation and cleanup contracts; implement reusable browser/HTTP fixtures and mock data; adapt each of the twelve services including non-Node runtimes; cover every navigable screen and persist/read/delete flows where applicable; run the suite after deployment.
- **Evidence:**
  - [ ] SDK unit and isolation tests, per-app screen and data lifecycle coverage matrix, failure cleanup tests, retained Literate AI receipt, reviewed CI, and live post-deployment E2E run without production data leakage.
- **Detailed program:** [SDK remote E2E program](sdk-remote-e2e-program.md).
