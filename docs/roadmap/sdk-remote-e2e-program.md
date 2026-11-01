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
dispatches all twelve adapters after the public browser smoke. Docker adapters
that require private server state use temporary containers. KMLab's native deploy
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
complete inventory. The Flight School sweep now reaches the correct booking
states and debug role, rejects HTTP/console errors, and loads the repaired static
assets, as recorded in the local completeness checkpoint. Planner still mocks
planning and external-data API responses after its real
storage lifecycle checks. Missions now uses its real temporary H2 service for
the complete browser persistence traversal.
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

## Missions persistence checkpoint

Missions now uses the SDK fixture and cleanup protocol against its signed,
temporary H2 instance. All 19 declared screens pass at desktop (1280 by 720) and
mobile (390 by 844) widths. The browser creates comments, completions and feedback,
submits missions and edits, logs in with temporary credentials, approves/rejects
requests, observes edit-status notifications, deletes a published mission, logs
out, opens API documentation, and exercises feedback with the SDK GitHub mock.
Review/rating fixtures and all other persisted records are covered by the
nine-table tag and residual inspection. SDK cleanup deletes its run record and
queries zero residual rows; the parent also removes the temporary instance and
storage. An injected failure after the delete-mission checkpoint passes the same
zero-residual and container-removal checks. No paid or external mutating API is
called. JSON exports and admin configuration remain under the run's temporary
path, and exported test rows retain their tags.

The real traversal found and fixed three product defects that the former mocks
concealed: BRIEF consumed the wrong API envelope and description field, numeric
CORS headers caused Jetty to return HTTP 500 after committing browser writes, and
floating controls covered the last mobile EDIT action. Long modal text now wraps
without hiding the close control. Desktop/mobile captures were inspected; the
runner captures settled animation states and modal viewports. The Clojure suite
passes 67 tests and 469 assertions, including servlet-compatible headers,
production/foreign-run denial, exact-expiry rejection, table ownership, and
idempotent cleanup. Deployment dispatch unit tests pass.

The retained SDK qualification passes 591 tests. The adopted receipt is
`sha256:ace37a6ab98d296d920b59953aa9e066655ce2cd148c8d73d8a18ace08ab4f96`;
`litai verify` passes authority, all 19 locks, and the current receipt. This
retained-runtime evidence does not claim native Component generation or acceptance.

Next audit the remaining applications' routes and persistence paths, audit
expired-run janitors after abrupt controller loss, and execute the complete
post-deployment gate against exact deployed revisions after all feature work
lands. Ordinary controller finally cleanup alone does not prove recovery from
worker interruption. These local results do not close E2E-001.

## Flight Tracker memory checkpoint

Flight Tracker now runs in a separate production-image process for E2E. It does
not have a durable database; its live flights, tracked aircraft and position
histories are transient service maps. The test process disables weather/feed
polling and websocket publication, admits SDK-tagged flight fixtures, and uses
SDK app-bound credentials on every request. Ordinary requests cannot reach test
state, and production instances reject test credentials and expose no fixture
controls. Partial configuration fails before listening.

The browser calls the real tracking and removal APIs. A fresh browser context
observes the same track, and SDK tags are retained on both the track and its
history. All four declared flows pass at desktop (1280 by 720) and mobile
(390 by 844) widths, with inspected captures, no document overflow, and no
console, page, request or HTTP failures. The synthetic point is inside the
initial viewport at either width; a real HTTP assertion verifies that bounds
filter out other points instead of returning a browser mock regardless of bounds.

The SDK fixture cleanup verifies zero live-flight, track, history and run counts
on success and after an injected failure following tracking. The parent removes
the temporary container. Real loopback HTTP tests cover ordinary/test separation,
missing/partial/foreign/expired/invalid credentials, invalid fixtures, foreign-row
cleanup denial and repeated cleanup without production changes or external calls.
All 49 service tests and three deployment dispatch tests pass. Application CI now
builds and runs the Flight Tracker suite independently of the SDK test job.
After seeding a real live flight, track and history, the isolated production
image handles SIGTERM with exit code zero in 0.106 seconds and is removed. Test
shutdown clears transient memory without asking the stopped background service
to perform an invalid lifecycle transition.

The retained SDK qualification passes 591 tests with adopted receipt
`sha256:bd67cf5fa92be17eafddbfdf415189049f030f83b79bcc5df4fbb353b69d66aa`.
`litai verify` passes authority, all 19 locks and the current receipt. This is
retained-runtime evidence, without native Component generation or acceptance.

These local results advance #332. Interrupted-controller expiry recovery, the
remaining inventory audit and exact deployed-build evidence remain open.

## Independent lease recovery checkpoint

The `aviation.testing.e2e` Component now owns bounded lease identities and pure
active/expired/unowned classification. Its TypeScript and Python bindings evaluate
the same authored cases for exact expiry, foreign applications, malformed tags,
invalid identities, future issue times, boolean/fractional timestamps, safe-integer
overflow and canonical integer-valued numeric representations. Newline-shaped
identities fail consistently. Runtime process scheduling remains outside that
portable contract.

The SDK foreground-command wrapper preserves literal argv and stdin and observes
both a relative lifetime and an absolute lease deadline, including startup delay.
Private-namespace timers and separate host supervisors survive controller loss
and escalate termination after a bounded grace. Host supervisors use owned child
handles and cancel timers on exit rather than later signalling a saved host PID.
Docker test instances auto-remove their private storage on exit. Dedicated SSH
forwards disable connection sharing and have their own independent deadlines.
Startup cleanup validates full lease metadata, app/run identity, canonical name
and immutable container ID, and ignores active, foreign, legacy, malformed and
mismatched resources. Finally cleanup also checks the creating controller's token.
A caller run-ID collision cannot authorize deletion of another instance or
collection of its logs. The integration test uses a private log marker to check
that diagnostic isolation as well as resource preservation.

Focused tests pass: 69 TypeScript tests, 55 Python conformance tests, five deployment
unit/integration tests, and two native EOF/revision tests. The Docker integration
writes an actual live flight, track and history, confirms an active sweep preserves
all four counted records, kills its controller with SIGKILL, and observes independent
container removal. Six protected resources survive the expired-resource sweep,
including a caller run-ID collision. These recovery tests are now blocking in
Flight Tracker CI. Native KMLab forwarding is bounded and preserves the stdin EOF
protocol; native host-crash residual storage remains an explicit audit item.

Five cached application-image adapters pass with the leased controller: Flight
Tracker, Chat, Missions, Planner and Flight School. The old cached Accident Tracker
image correctly failed the feedback context check because it reported a stale app
identifier. Its exact-main image at `ab21227a6528ab21a999936dcd37b4a3295adc12`
passes all five flows through a dedicated remote SSH forward. A remote SIGKILL
qualification with real tagged SQLite state also verifies independent removal of
both that container and the SSH forward. Production instances were not changed.
These are compatibility and recovery observations, not the final all-service
post-deployment proof.

Live diagnosis found an independent clock-boundary problem: a sample signed at
the fifteen-minute verifier ceiling rejected three of fifty requests, while all
fifty five-minute requests succeeded. SDK run headers now refresh five-minute
credentials below the unchanged ceiling; a deterministic regression verifies a
one-second client/server offset. Feedback mismatch diagnostics expose only which
context fields failed, without recording submitted messages.

The final retained harness passes 631 tests. Receipt `sha256:b66d967b0c1270b0f298a26341bc9039531e4a6a0fe24d3d9d96382d4e511747`
is adopted, and `litai verify` passes authority, all nineteen component locks
and receipt freshness. Source intelligence and HTML observability are named skips
because this checkout selects provider `none` and declares no HTML artifacts.
This retained parity evidence does not establish native Component generation
or native Component acceptance.

#332 remains open for the remaining inventories, native crash-storage audit and
complete exact-build deployed gate after feature work. #176 remains a release
prerequisite as well.

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
