# Aviation deployment on do-host1

The [application manifest](apps.json) is the list of all twelve apps, their public
names, health paths, and unique loopback ports. `make deploy-check` rejects missing
apps, missing Dockerfiles, and duplicate names or ports. The analyzer keeps its
native Python systemd service on port 18765; the other apps run as Docker images
under individual systemd units. Caddy terminates HTTPS and forwards all application hosts to Meta App. Meta App
selects the private loopback provider from its shared HTTP/MCP service registry.

Run the commands from the Aviation repository root on a machine with Docker,
Python 3, SSH access to do-host1, and enough local disk for the images:

```sh
make deploy-check
make deploy-build APP=flight-planner
DIGITALOCEAN_TOKEN_FILE=/path/to/scoped-token make deploy-dns APP=flight-planner
make deploy-app APP=flight-planner
make deploy-verify APP=flight-planner
```

Use `APP=all` to process all twelve apps serially. Building and deploying require
a clean committed worktree. Each image receives the exact Git revision in its tag
and OCI label; deployment pulls the exact CI image from GHCR on do-host1,
falling back to a local authenticated pull and SSH transfer when necessary.
It verifies the image revision on the host, then writes the systemd
unit and Caddy site, then checks the local service. The DNS command creates only
missing A records and stops if a name already points elsewhere. The verify
command checks public HTTPS, the active unit, and renders the public root in
Chromium. It rejects browser errors and visible error pages; Accident Tracker
also opens a citation disclosure. `deploy-app` runs this gate after each app
install. Install root pnpm dependencies and set
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to Chrome if managed Chromium is absent.
`.github/workflows/deploy.yml`
builds and publishes the same twelve image definitions on `main` and release tags;
the workflow does not change live services.

Application environment overrides and credentials belong in root-owned
`/etc/aviation/<app>.env` on the host. The installer creates an empty file if
needed and preserves existing files. Application state belongs under
`/var/lib/aviation/<app>/`; the manifest declares bind mounts for apps that write
data. The installer backs up the previous unit and Caddy configuration for the
current app and restores them if startup or health checking fails. Inspect failures
with `journalctl -u aviation-<app> -n 100` and `docker logs aviation-<app>`.

### FAA NMS ingestion worker

The planner mounts `/var/lib/aviation/flight-planner/nms` read-only at `/app/nms`.
Its protected `/etc/aviation/flight-planner.env` selects `FAA_NMS_ENVIRONMENT` and
`FAA_NMS_CACHE_DIR=/app/nms/<environment>`; it must not contain FAA client
credentials. Keep those credentials out of the web keystore as well. The weather
service consumes the shared read API and needs no FAA credentials.

Install a separate worker from the exact committed planner image:

```sh
python3 deploy/deploy.py nms-worker-install --environment production
python3 deploy/deploy.py nms-worker-status --environment production
```

Installation creates the environment's private cache directory, checks the image
revision and installs `aviation-nms-worker-production.service`. It does not start
or newly enable a worker, and refuses to replace an active/transitioning unit.
If an existing worker needs updating, stop it first. The worker is an internal
process, not an additional public application or gateway namespace.

Provision `/etc/aviation/nms-production.env` separately as a root-owned regular
file with mode 0600, with exactly the unquoted `FAA_NMS_CLIENT_ID` and
`FAA_NMS_CLIENT_SECRET` assignments. Neither installation nor source control
provisions or displays their values. After actual production authentication is
verified, explicitly start the worker:

```sh
python3 deploy/deploy.py nms-worker-start --environment production
python3 deploy/deploy.py nms-worker-status --environment production
# Stops and disables only this environment's worker, preserving its cache:
python3 deploy/deploy.py nms-worker-stop --environment production
```

The same commands require an explicit `staging` or `fit` selection for those
environments, with separate files/units/cache directories. Never start production
using credentials that production rejected. An active unit establishes process
state only: inspect `/api/notams/capabilities` and `/api/notams?airport=KPAO` for the
selected environment, complete snapshot, source age and warnings, then verify the
gateway, MCP and UI. Staging data may contain test notices and is not production
acceptance. Full initialization can take several cadence intervals.

Preserve the complete cache, original receipts and durable request reservations
when moving a feed between hosts. Quiesce the old worker before transfer and use
only one authoritative writable cache per account/environment. Do not start from
a fresh directory to bypass a daily full-load or three-minute delta reservation.
Deployment rollback restores unit configuration, never old cadence/data state.

The installer generates stable Flask session and CSRF keys for Flight School and
a session key for ForeFlight Dashboard on first install. Aviation Chat needs
`OPENCLAW_BASE_URL` and `OPENCLAW_API_KEY` in its protected environment file for
`/chat` to work; `/health` reports process health only. Other optional external
API integrations likewise need their own credentials and feature checks.

The shared Submit feedback control in all apps posts to Meta App's
`/api/feedback` endpoint. Set `GITHUB_ISSUES_TOKEN` in the root-owned
`/etc/aviation/meta-app.env` before deploying Meta App. The token needs issue
creation access to `jordanhubbard/Aviation`. The endpoint validates the app
origin and page, limits submissions to five per source IP per hour, and returns
the new issue URL. The browser never receives the token.

GA Preflight Check stores aircraft profiles and risk notes in the pilot's local
browser storage. It requires the aircraft's current POH/AFM figures and computes
takeoff and landing weight and longitudinal CG from entered station arms and
planned fuel burn. It does not use generic aircraft defaults for loading limits.

The deployment only binds application ports to 127.0.0.1. Public access goes
through each app's HTTPS hostname. Keep the host's memory and swap health in view
between services; stop if the host begins sustained swapping or a service exceeds
its memory limit.

Remote E2E adapters print one JSON pass record for each verified screen, including
its data mode and viewport. Set `AVIATION_E2E_VIEWPORT=mobile` to run the same
adapter at 390 by 844 pixels (the default desktop viewport is 1280 by 720).
`AVIATION_E2E_CAPTURE_DIR` optionally retains full-page PNGs and rendered body text
for the screen inventories, including Flight School's dynamic route sweep.
Browser traces are retained on failure. These are
diagnostic captures; they do not establish full acceptance without reviewing the
visible behavior and completing the deployment gate.

For a persistent-app cleanup check, set `AVIATION_E2E_FAIL_AFTER_SCREEN` to a
name in its declared inventory while using the isolated runner. It raises a
controlled failure after that screen's verification, then runs registered SDK
cleanup. Missions reports the residual count for all nine H2 data tables before
the parent destroys its temporary container and storage. Its full browser suite
requires a signed isolated instance and uses real API responses; only external
issue submission uses the SDK mock. The intentional failure must be distinguished
from an unexpected test failure by its marker and zero-residual result.

Flight Tracker uses `isolated-e2e.mjs`, rather than a public browser-only run.
Its SDK fixtures populate the temporary process's real in-memory live feed; the
browser calls real tracking APIs and checks the result from a fresh context.
Cleanup checks live, tracked, history and run counts before destroying the
container. Weather/feed polling and websocket publication are disabled in that
signed test process. Production instances never expose these controls.

Isolated Docker runs carry the Component-owned `aviation/e2e-lease@1` metadata.
Their foreground command has a private-namespace POSIX `sh`/`date`/`sleep`
deadline. Dedicated SSH forwards use independent Node supervisors with owned
child-process handles; timers are cancelled when those children exit, so no
stale host PID is retained for later signalling. The absolute lease deadline includes startup time;
timers have one-second precision and a two-second termination grace. Containers
use `--rm` and private tmpfs, and no production bind mounts are introduced. Startup
cleanup validates the full lease, application, run, canonical name and immutable
container ID; active, foreign, unowned and malformed resources are preserved.
Failure diagnostics collect logs only from a successfully created container ID.
Finally cleanup additionally verifies a per-controller owner token, so a duplicate
caller-supplied run ID cannot remove another controller's instance.

`AVIATION_E2E_LIFETIME_MS` can reduce the default fifteen-minute budget. It must be
positive and no greater than fifteen minutes. `AVIATION_E2E_SWEEP_ONLY=1` runs the
safe expired-resource sweep without creating an instance. For controlled failure
qualification, supply both `AVIATION_E2E_RUN_ID` and `AVIATION_E2E_SECRET` and set
`AVIATION_E2E_HOLD_AFTER_READY=1`: the controller emits a ready record without the
secret and waits only until lease expiry. This diagnostic mode never reports a
successful browser run. It permits a test owner to seed actual data and kill only
its own controller before checking independent expiration.

The Docker recovery tests in `test_deploy.py` run when
`AVIATION_E2E_LEASE_TEST_IMAGE` names the official Flight Tracker image. Application
CI builds that image and requires the tests. They verify real state before SIGKILL,
independent expiration, active-run preservation, and safe handling of foreign,
legacy, malformed, mismatched and colliding resources. Ordinary dispatch unit tests
remain available without Docker qualification. SDK request headers are refreshed
with five-minute lifetimes under the unchanged fifteen-minute verification limit,
leaving headroom for small client/server clock differences.

Native KMLab requires a running Linux user systemd manager. Its helper launches
an app/run-bound transient service with `RuntimeMaxSec`, a two-second stop grace,
`KillMode=control-group`, and a private `RuntimeDirectory` under `/run/user/<uid>`.
The directory is manager-owned and is not preserved after the service exits.
Normal EOF still stops the worker. The manager independently terminates children
and removes data after helper SIGKILL or controller loss; `/run/user` is volatile
on the deployed host. The wrapper verifies both directory absence and inactive
unit state. This leaves the production service and legacy unleased directories
outside cleanup authority.

`test_e2e_instance.py` runs three real manager regressions when
`AVIATION_E2E_NATIVE_MANAGER_TESTS=1`. They create a private transient unit, tagged
SQLite state and a child that ignores TERM, then check EOF, helper SIGKILL and
allocating-controller SIGKILL. Native CI starts its ephemeral runner's user
manager and requires these tests. This explicit manager mode is separate from
the portable worker suite rather than adding unavailable cases as skipped tests.
The six portable worker tests remain available without a user manager.


Preflight's optional `isolated-e2e.mjs preflight-check` path runs its exact image
in a private leased static server for qualification. Its seven browser flows
include profile reload and Clear Profile, with separate risk-review persistence
and zero-residual cleanup. Public deployment dispatch still needs only a fresh
browser context for this stateless service.

KMLab's eight browser flows include multipart file upload, a read from a fresh
context, and actual UI deletion. The native launcher passes its run identity to
the adapter. `AVIATION_E2E_FAIL_AFTER_SCREEN=upload` therefore exercises SDK and
physical store cleanup for that same allocated run. The HTTP regression also
checks tags, foreign-run denial, SQLite reopening and raw-file deletion.


G1000 settings use the shared configuration HTTP adapter and a compiled keystore
provider packaged in its Python runtime image. Normal deployment mounts the app
data volume at `/app/data`, with `KEYSTORE_PATH=/app/data/.keystore`. Preserve the
store path and `KEYSTORE_ENCRYPTION_KEY` across restarts because the encrypted
format derives its salt from the path. Settings writes are disabled unless the
master key and `AVIATION_SETTINGS_TOKEN` are each at least 32 characters; the
operator enters the token in the settings panel for authorized writes. The token
is held only in browser memory.

G1000's `isolated-e2e.mjs` path starts its exact image with SDK-signed app/run
credentials, a synthetic encryption key and a private run-owned encrypted store.
No production data volume is attached. Five flows cover dashboard, save, a fresh
browser read, field deletion and mocked feedback. The SDK fixture ledger and
field records are inspected for ownership before cleanup, including after
`AVIATION_E2E_FAIL_AFTER_SCREEN=settings`. The physical private store and leased
container are removed by the runner.

## Central ingress rollout

Deploy the qualified Meta App image first. Its generated unit uses host networking,
binds only `127.0.0.1:18774`, and derives explicit private bindings for every other
application from `apps.json`. The existing `/etc/aviation/meta-app.env` is preserved;
remove stale overrides of `PORT`, `LISTEN_HOST`, `AVIATION_GATEWAY_APP_HOSTS` or
`AVIATION_GATEWAY_BINDINGS` before rollout if they conflict with the generated unit.

Deploy Flight Tracker once with the new unit to publish its separate socket listener
on loopback port 18777; other existing app processes can stay running.
After Meta App's exact-image and browser gates pass, update the ingress of every
installed application without restarting its process:

```sh
python3 components/legacy-project-wrapper/implementation/deploy/deploy.py ingress --app all
```

The command first checks every native-host health route through Meta App and verifies
its namespace header. It then updates each installed site's loopback proxy target and transport
advertisement, including the native analyzer's legacy inline Caddy block when present. It retains
configuration backups under `/etc/caddy/aviation-ingress-*`, validates the complete
configuration, and reloads Caddy. Validation or reload failure restores the previous
files and reloads them. Unknown proxy configurations fail before any edits. Repeating
the command is safe. A normal subsequent app deployment emits the same central route.

Aviation sites send `Alt-Svc: clear`. On the deployed Caddy 2.6.2, a reload can
leave HTTP/3 accepting QUIC handshakes but never answering script streams. A fresh
Chrome navigation then stalls module evaluation and deferred controls despite
healthy application HTTP endpoints. Clear the HTTP/3 advertisement per Aviation
host, retaining HTTP/2 and HTTP/1.1 and leaving unrelated sites alone. Ingress
reconciliation applies the same policy to existing sites, with its normal backup
and rollback. Re-enable HTTP/3 only after a qualified proxy upgrade passes repeated
first-navigation browser checks immediately after reload. Preserve browser
readiness assertions and deadlines; a warm retry is not cold-start evidence.

Verify public health responses carry `X-Aviation-Gateway: v1` and the expected
`X-Aviation-Namespace`. Check native login/forms and live sockets as well as the
single public `/api/v1/services` catalog and `/mcp` endpoint on Meta App. This cutover
makes Meta App an availability dependency for all public apps; the private providers
continue to listen on their original loopback ports. Local standalone app development
is unchanged. No provider credentials are injected by the central gateway.

Planner image builds must supply `GIT_SHA` and `REPO_URL` as Docker build arguments
in both CI and the local fallback. Deployment verification checks the planner's
public `/api/meta` revision as well as the running image label; an empty or stale
application revision fails before browser traffic. Meta App lifecycle qualification
compares its public catalog and MCP tool schemas to the current checked-in contract,
including declared additive discovery tools, rather than a fixed version/count.

Browser qualification launches a dedicated Playwright browser server and connects
its driver explicitly. After contexts and traces close, allow five seconds for
native graceful shutdown, then kill only that server's owned process tree and
await exit for up to five seconds. A confirmed forced exit is reported as recovered;
a failed kill fails the run. SIGINT/SIGTERM/SIGHUP close the same owner and retain
nonzero interruption status. Structured `aviation/browser-lifecycle@1` records
include trace, context, process shutdown and connection phase durations. Existing
screen assertions, fixture residual checks, signed run leases and the 180-second
isolated controller deadline still apply. Run `node --test deploy/browser-runner.test.mjs`
for deterministic graceful-stall, kill-failure and connection-failure coverage.

Browser workers require Node 22 or 24 LTS. Entry points reuse a supported current
runtime or select an installed LTS binary (`node24`, `node22`, or Homebrew's
versioned installation). Set `AVIATION_E2E_NODE` to select an executable explicitly
when the current Node is unsupported. Bootstrap forwards interruption signals and
preserves worker status; isolated children reuse `process.execPath`. Node 26.8.1
reproducibly stalled large Playwright 1.59.1 trace archives; the same Missions
lifecycle completed under Node 22.23.4. An unavailable LTS runtime fails with an
actionable error before creating a run lease or browser.

### Connected browser shutdown

The owned-browser helper must close the connected client's contexts/transport before
requesting graceful shutdown of its owned browser server. Both phases retain bounded
deadlines; stalled cleanup uses the existing exact-owner kill path and verifies its
completion. A protocol/cleanup failure remains a failure. Concurrent closes and
signals share the same cleanup promise. Browser-process exit alone does not establish
that its streams or descendants have been reaped. Use managed Playwright Chromium for
qualification; optional system Chrome retains the separate limitations recorded in #479.
