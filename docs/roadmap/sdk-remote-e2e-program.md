# SDK remote E2E program

- **Status:** active
- **Owning queue item:** [E2E-001](active-work.md#e2e-001)
- **Completion / archival evidence:** pending while E2E-001 remains open

## Current checkpoint

The SDK run contract, signed credentials in TypeScript and Python, run-scoped
storage paths, tagged fixtures, network mocks, browser inventory helper, and
failure cleanup are implemented and unit tested. Accident
Tracker and Flight Track Analyzer use separate SQLite databases for each run with
explicit database tags. Local production server and browser checks passed for both,
including zero-residual cleanup. Preflight Check, Meta App, Weather Briefing,
Aviation Chat, and G1000 Simulator passed local browser or endpoint checks.
Flight Tracker, Flight Planner, and ForeFlight Dashboard passed checks against
their public deployments, with isolated browser mocks or stateless sample input.

The public runs of Flight Tracker, Flight Planner, and ForeFlight Dashboard
exercised the currently deployed build, not this branch's exact revision.
Missions now has a production-image adapter with a separate run-scoped H2
database, tagged seed rows, signed traffic, and a tagged comment write/read.
Planner has a production-image adapter with a separate run-scoped JSON store,
signed traffic, and tagged plan and recording write/read/delete. Both passed
local isolated browser runs. Production instances reject test credentials.
Accident Tracker also passed a local signed browser run in a throwaway
production-image container with its production and run-scoped SQLite files
under tmpfs. Flight School has a local
production-image adapter that launches a signed, isolated SQLite instance,
visits 57 declared GET screens using separate admin, instructor, and student
sessions, writes a tagged waitlist entry, verifies it in the test database,
then removes the database with its throwaway container. That sweep also
found and fixed previously broken Flight School routes and templates.

The deployment verifier now checks each running revision, requires the
independent [remote E2E inventory](../../verification/remote-e2e.json), and
dispatches all twelve adapters after the public browser smoke. The four
persistent Docker services use temporary containers. KMLab's native deploy
records its exact revision and installs a temporary remote process runner;
that runner's local EOF cleanup and revision rejection tests passed. These
new remote paths have not yet been exercised against a deployment of this
branch. SDK browser tracing retains a Playwright trace on failure and removes
it on success. All twelve adapters now exercise the shared feedback widget
with a mocked issue submission and verify its application and page context.
The local KMLab browser run passed against a disposable native server and
left no run-scoped SQLite files. Local production-image Chat and G1000
branch-preview browser runs also passed.

This remains a **partial checkpoint**: the G1000's currently shipped UI has
only dashboard and settings routes; its simulator components and plan store
are not exposed through those routes. Other product surfaces still need a
complete inventory. The stricter Flight School sweep reaches the correct booking
state screens and debug role, but retained traces also reveal missing static
assets in legacy templates. Replace unavailable decorative assets with text or
existing images, share the working Bootstrap resources, and make the sweep reject
HTTP/console errors before claiming complete rendered acceptance. Planner and Missions browser fixtures still mock some
API responses after the real storage lifecycle checks.
The declared inventories still need a route-by-route completeness audit and
full deployed-build evidence. The retained harness receipt must be renewed
after each source checkpoint.

## Local completeness checkpoint

Planner now exercises eight screens at desktop (1280 by 720) and mobile
(390 by 844) widths. Its saved-plan browser load reaches the real signed,
isolated server store; airport, weather, and planning responses remain SDK
fixtures. The import dialog and route-result surface are included. GPX and FPL
imports carry SDK tags immediately, survive a fresh interpreter reopening the
JSON store, support update/export, and leave zero records after deletion.
Both Python test directories pass (130 and 65 tests), and CI now runs both.
The 12 frontend tests and 591 shared SDK tests pass. Route/local/page transitions
no longer leave animated Leaflet operations targeting a removed map, and airport
viewport fitting uses the existing shared navigation bounding box.

Flight School visits 57 declared GET routes at both widths using the appropriate
admin/instructor/student role and confirmed/in-progress/completed booking fixture.
Unexpected redirects, HTTP failures, and console errors fail the sweep. Missing
legacy stylesheets and decorative images were replaced by available resources
or text. Each run writes a tagged waitlist entry, verifies its isolated row,
and removes the temporary container and storage. Desktop/mobile captures of the
changed screens were inspected. All adapters emit individual screen pass records;
optional captures retain PNGs and rendered text for review.

The retained build/test/package harness passes with adopted receipt
`sha256:61f959a4af90aed31dc6128822de602426cb1ea52f2c581598403e8e217fdc61`;
project authority, all 19 locks, and the current receipt verify. This is retained
qualification, with no native Component generation or acceptance claim.

These are local production-image results. They do not establish deployed-build
coverage. Next audit the remaining applications' routes and mutations, remove
any mocks that bypass required server persistence paths, and exercise the complete
post-deployment gate against exact deployed revisions. E2E-001 remains open.

## Acceptance contract

Each deployed app must publish a screen inventory and an executable test for every
screen. The test opens the deployed build, supplies tagged example data, verifies a
visible result, and verifies cleanup. A screen with no data mutation must still use
an isolated browser context and mocked external inputs. API-only services use an
endpoint inventory in place of a screen inventory.

Persistent apps must direct E2E writes to a separate test database or schema. The
test store must contain an `e2e_runs` record with its SDK run ID, and fixture rows
must carry `is_test_data = true` and `test_run_id`. Normal requests must never read
or write test records. An invalid or partial test credential must fail closed. The
SDK signs a short-lived, app-bound run credential; adapters in each runtime verify
it before selecting test storage. Cleanup runs on success and failure, then queries
the test store for residual records. A janitor also removes expired test runs after
worker interruption. No E2E fixture may invoke an external paid or mutating API.

The post-deployment gate must execute against the exact deployed application build
through a remote test endpoint or an isolated remote application instance. It must
retain browser traces on failure, record per-app coverage, and fail when a declared
screen or endpoint was not visited. The existing public root/health smoke remains a
fast independent gate.

## Application boundaries

| Application | State boundary | Initial E2E surface to inventory |
| --- | --- | --- |
| Accident Tracker | SQLite ingest database | List, filters, map, event detail, citations |
| Aviation Chat | Stateless API; optional gateway | Root, health, chat request validation and mocked gateway |
| Missions | H2 mission database, browser preferences | Mission list/detail, Completed, submissions, admin views |
| Flight Planner | Backend plans plus browser state | Planner, airports, weather, saved plan lifecycle |
| Flight Track Analyzer | Native flight database and uploads | Flights, detail, summary, performance, help |
| Flight Tracker | Feed data and browser state | Dashboard, flight selection, filters |
| Flight School | SQLite bookings and user data | Public, booking, instructor, admin, settings, maintenance |
| ForeFlight Dashboard | Stateless logbook processing; optional user store | Upload, results, flight detail, errors |
| G1000 Simulator | Browser plans and navigation data | Dashboard, simulator, settings, plan lifecycle |
| Meta App | Browser settings; GitHub issue endpoint | Launcher, settings, feedback using mocked GitHub |
| Preflight Check | Browser local storage | Aircraft profile, weight and balance, PAVE checklist |
| Weather Briefing | Browser stations and external weather | Briefing, station selection, forecast and alerts |

## Work sequence

1. SDK test-run identity, HMAC credential, tagged fixture catalog, cleanup protocol,
   and cross-runtime HTTP contract, with failure-path tests.
2. Storage adapters for persistent applications, using separate test databases plus
   row tags and an expired-run janitor. Add tests that prove normal reads cannot see
   test rows, and that test reads cannot see production rows.
3. Screen and endpoint inventories with reusable SDK browser actions and mocks.
   Wire every application and prove create/read/delete paths where writes exist.
4. Remote run orchestration, CI and post-deployment gate, retained receipt, and live
   evidence of full coverage and zero residual test rows.
