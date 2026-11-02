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
protocol; native hard-crash recovery is qualified separately below.

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

#332 remains open for the remaining inventories and complete exact-build
deployed gate after feature work. #176 remains a release
prerequisite as well.

## Native crash recovery checkpoint

KMLab's isolated runtime now runs in an app/run-bound transient user service.
The independent user manager owns its full process group, a bounded runtime,
a two-second stop grace and a private runtime directory. Cleanup also occurs
when the SSH controller or application helper is killed. On the deployed host
`/run/user/1001` is tmpfs; this storage is volatile rather than retained across
host reboot. Unit and directory identities derive from a validated SDK run ID.
Existing unleased legacy directories grant no cleanup authority. The production
unit and its data were not modified.

All nine tests in `test_e2e_instance.py` pass on the actual Linux user manager,
including three real transient-unit tests with tagged SQLite state and children
that ignore TERM. The native CI job enables these cases and fails if its user
manager cannot run. Local macOS qualification selects and passes the six portable worker tests;
the three Linux manager cases belong to the explicitly enabled qualification
mode. The retained portable harness admits no skipped selected tests.

An additional isolated qualification uses the deployed KMLab application revision
`77012f20dff756cf8755911b38876696674a7082`, the candidate helper and common SDK
fixtures. All three cases seed actual tagged flight data and verify removal of
the directory and application children: normal EOF (0.21 seconds), helper SIGKILL
(0.22 seconds), and controller SIGKILL followed by independent expiry (19.18
seconds). The last case confirms that the unit survives its allocating controller
until its deadline. Browser compatibility also passes all six declared flows
at desktop and mobile widths through the candidate manager-owned instance, with
SDK row cleanup and subsequent
physical directory removal. These checks do not replace final exact-release
post-deployment acceptance or claim that a host reboot was exercised.

The final retained harness passes 631 tests with adopted receipt
`sha256:d0b6ac70b1a709a420859a36a15e990d14da6efc09fbbfbae4e7edd6a2273566`.
`litai verify` passes authority, all nineteen locks and receipt freshness; source
intelligence and HTML gates are named configuration skips. This remains retained
parity evidence without native Component generation or acceptance. Linux manager
qualification remains separately mandatory in native CI.

## Persistence inventory follow-up

Preflight now verifies persisted aircraft fields after reload, verifies the risk
review after a second reload, and exercises Clear Profile while preserving that
separate risk review. All seven declared flows pass at desktop and mobile widths
against the exact-main `b961b75cebe8d8ea73cafdda8db91ecb7297dafe` production image
in a private leased container on Linux. An injected failure after the risk step
also reports zero profile/risk storage residuals and removes the container and
SSH forward. The clear check explicitly waits for the reload's DOM initialization.
The optional isolated-image runner now supports this stateless Preflight image;
ordinary deployment dispatch remains the public build with private browser state.

KMLab now uploads a second synthetic KML through its actual multipart UI, reads
both flights from a fresh browser context, exercises detail/summary/performance,
then deletes both flights through the UI and checks an empty fresh context and
server response. All eight declared flows pass at desktop and mobile widths.
The browser run is bound to its allocated native run identity, enabling an
injected failure after upload; SDK cleanup and the native controller's physical
directory/unit checks pass on that failure as well. These browser checks use the
candidate runner against deployed application revision
`77012f20dff756cf8755911b38876696674a7082`; they are compatibility evidence, not
final exact-release deployed acceptance. Desktop/mobile captures were inspected.

The eight focused native worker/HTTP tests pass. The new signed multipart
regression uses SDK signing/tagging, reopens the application to read SQLite,
rejects foreign-run deletion, verifies all seven data tables retain their run
tags after metadata and POH writes, checks deletion cascades and raw-file removal,
and physically removes the run database without changing the separate production
fixture. Three deployment dispatch unit tests pass; the two optional Docker lease
tests were not selected in that unit invocation and remain required in CI.

The G1000 settings mock conceals a confirmed runtime defect: exact-main image
`6a6fc48d96deadf7df4850b0b6783a07469d7581` has no npm executable, and its Python
settings save route returns failure when attempting the npm keystore CLI.
Resolve this through the common configuration/keystore path and an isolated real
persistence test; synthetic browser success alone is insufficient. No production
secret was read or changed during the private, network-disabled image probe. The
common ConfigPanel currently checks only HTTP status before optimistically marking
a secret configured, and G1000's private field keys differ from the shared catalog.
The common SDK save path and its runtime packaging need qualification together;
keep storage/HTTP adapter behavior separate from the portable catalog contract.

The fresh retained harness passes 631 tests with adopted receipt
`sha256:c9b42f9afdb6890154cce15bdcd1e43b4b93d1aa8a623b7d5d98666aa3ebd33b`.
`litai verify` passes authority, all nineteen locks and receipt freshness. Source
intelligence and HTML gates are named configuration skips. This is retained
parity evidence without native Component generation or acceptance.

## Shared settings runtime repair

A two-instance probe also reproduces loss of the first writer's unrelated key.
Serialize provider writes, reload under the lock and publish atomically before
using the new runtime for concurrent settings requests.

Move Python runtime keystore calls to a compiled SDK Node bridge with a bounded
stdin/stdout JSON protocol, preserving the existing encrypted format and operator
CLI path. Add real cross-runtime roundtrip/ownership tests, reject writes after
failed decryption, and require explicit successful field confirmation in the
shared settings UI. The portable configuration catalog contract remains unchanged.

A current G1000 frontend build also fails at startup with `Buffer is not defined`:
browser consumers import the SDK root barrel, pulling in server-side Redis code.
Use the existing pure navigation/aircraft/loading/dynamics and alert leaf modules
from G1000 and the shared UI framework, then verify the actual rendered settings
failure and success states at desktop and mobile widths. This replaces the stale
image's apparent browser health with current-source evidence.

The SDK implementation now has passing targeted checks: 15 TypeScript keystore
cases, nine Python cases using actual compiled Node subprocesses, and 24 settings
configuration/client cases. The built G1000 consumer passes desktop and mobile
failure/success browser checks. Those browser requests use a private HTTP fixture;
they do not establish G1000 backend persistence or deployment-image readiness.
The existing SQLite dependency also required a patched `tar` resolution after a
fresh production audit found three high/critical archive-processing advisories.
The first full retained run exposed ts-jest's forced legacy Node resolution,
which ignores conditional package exports. Publish matching SDK `typesVersions`
for the existing public subpaths rather than weakening test diagnostics. All 79
G1000 Jest tests now pass without cache. Final retained build, test and package
qualification passed with adopted receipt `sha256:aacce94e68d28d724e67fe96c9c716557f1fd9977ce43bd61b0c181a11cf545f`. `litai verify` passes
authority, all nineteen locks and receipt freshness; source intelligence and
HTML remain named configuration skips. Exact-commit CI is required before landing.

## G1000 settings persistence integration

The SDK settings HTTP adapter now requires canonical app-scoped fields and
explicit operator authorization for normal writes. Private requests require
app/run-bound SDK credentials, an explicit run-owned store, and tagged
`e2e_runs` metadata before field persistence. Production fallback is disabled;
normal providers also reject test-tagged files. Cleanup validates every owner
and field before removing records, including expired runs without renewing them.

Local qualification passes 46 Python configuration/keystore cases, 36 G1000
application cases, TypeScript keystore/configuration suites, and rendered
operator-token/read-only/failure/success states at desktop and mobile widths.
The shared panel summary counts actual configured fields rather than optional
service readiness; browser checks cover empty, saved and deleted summaries.
The actual Docker testing target also built and passed all 36 backend tests
with its packaged provider, read-only root and no network access.
The deployed G1000 adapter no longer mocks the settings API: its five declared
flows cover dashboard, save, fresh-context reload, deletion and mocked feedback,
with standard fixture cleanup and residual counts. All five flows passed against
the private working-tree image at desktop and mobile widths. An injected failure
after settings also passed cleanup with zero residual records. Each run removed
its owned container, private filesystem and SSH tunnel. Exact-commit execution
remains required before deployed-build acceptance.

The image packages Node 24 and a compiled provider, and persists normal settings
under the app data volume. A local packaging probe found a workspace link in
legacy isolated-node-linker output; hoisted deployment produces a closed
artifact and passes real set/get/delete operations without npm or a compiler.
The private working-tree runtime image
also passed real HTTP writes, a fresh Python process read, normal-mode rejection
of test state, foreign-request denial and zero-residual cleanup. Its production
store remained absent. These runs used synthetic credentials and no production
volumes. This is not final deployed-build acceptance; both #176 and #332 remain
open.

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
