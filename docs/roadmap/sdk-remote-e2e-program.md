# SDK remote E2E program

- **Status:** active
- **Owning queue item:** [E2E-001](active-work.md#e2e-001)
- **Completion / archival evidence:** pending while E2E-001 remains open

## Current checkpoint

The SDK run contract, signed credentials, tagged fixtures, network mocks, browser
inventory helper, and failure cleanup are implemented and unit tested. Accident
Tracker uses a separate SQLite file for each run; its event, citation, and run
rows carry explicit test tags. A local production build passed remote-style
browser traversal of the list, filters, citations, detail, and map, followed by
zero-residual cleanup. Preflight Check passed profile, loading, risk, and
reference screens in an isolated browser with storage cleanup. Meta App passed
launcher destination and settings traversal in an isolated browser. The other
nine applications, remote credential provisioning, post-deployment integration,
and retained harness receipt remain open.

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
