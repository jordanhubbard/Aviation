# Active work

This file is the durable resumption queue for user-directed and discovered work. Before
implementation, follow `skills/agent/record-user-directed-work/SKILL.md`.
Keep detailed designs in focused roadmap documents and link them here.

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
  authority until each boundary independently qualifies.
- **Next action:** Complete the public contract and file-by-file classification
  of the initial map in `docs/roadmap/native-boundary-inventory.md` before
  selecting the first native boundary.
- **Evidence:** Phase 1.2 lift-and-shift identity `sha256:c5ca4361ba010f6e8d81c93398468f9f4f8b8cc352504bc8535fa74b7c6e9990`.
  Retained conversion stage is backed by current test receipt
  `sha256:60e252aceb5834018a21d3ec5a75b667c564e207ea3cf02d475b3245640c3c79`;
  original source remains release authority.

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

### [ ] FLIGHT-002 — Remove unrelated planner demo controls and canvas

- **Priority:** P2
- **Owner:** retained Flight Planner frontend
- **Direction:** Explain and correct the initial blank canvas and joystick controls visible in Flight Planner.
- **Conclusion:** App.tsx mounts a G1000 demo control and fixed sample canvas globally; neither powers the real plan maps. Remove those shell mounts while preserving the form and its existing pre-plan empty state. MAC task task_429cbcaff6a84f06a383bac4c1c9eb83 tracks the same work.
- **Depends on:** FLIGHT-001 deployed planner
- **Implementation:**
  - [x] Remove global demo components from the planner shell and cover the initial view in a rendered post-deployment browser check.
- **Evidence:**
  - [x] Flight Planner frontend build and 8 tests pass; the new browser check rejects the current deployed demo controls.
  - [ ] Literate AI verification, reviewed CI, exact-main image, and deployed browser check.

### [ ] META-001 — Navigate to every Aviation service from Meta App

- **Priority:** P2
- **Owner:** retained Meta App and deployment browser verification
- **Direction:** Ensure all deployed Aviation applications can be opened from Meta App.
- **Conclusion:** The deployed manifest has eleven entries; Meta App is the current application and has links to nine of the other ten. Add the missing Aviation Chat destination and use the manifest as the browser gate for destination completeness. MAC task task_c7befa4095b74be7967535e52557d21b tracks the same work.
- **Depends on:** DEPLOY-001 public DNS
- **Implementation:**
  - [x] Add Aviation Chat destination to Meta App and assert each other deployed application has a matching launch link.
- **Evidence:**
  - [x] Meta App and dependencies build; the manifest browser check rejects the current deployed launcher because Aviation Chat is missing (9/10 destinations).
  - [ ] Literate AI verification, reviewed CI, exact-main deployment of both changed apps, and passing public browser checks.
