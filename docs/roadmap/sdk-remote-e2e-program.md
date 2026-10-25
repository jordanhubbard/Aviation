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

This remains a **partial checkpoint**: the G1000's currently shipped UI has
only dashboard and settings routes; its simulator components and plan store
are not exposed through those routes. Other product surfaces still need a
complete inventory. Planner and Missions browser fixtures still mock some
API responses after the real storage lifecycle checks.
Remote credential provisioning, independently declared complete
screen inventories, post-deployment gate integration, and full deployed-build
evidence remain open. The retained harness receipt must be renewed after each
source checkpoint.

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
