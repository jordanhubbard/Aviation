# Aviation deployment on do-host1

The [application manifest](apps.json) is the list of all twelve apps, their public
names, health paths, and unique loopback ports. `make deploy-check` rejects missing
apps, missing Dockerfiles, and duplicate names or ports. The analyzer keeps its
native Python systemd service on port 18765; the other apps run as Docker images
under individual systemd units. Caddy terminates HTTPS and proxies to loopback.

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
leaving headroom for small client/server clock differences. The native KMLab SSH
session is also bounded and preserves stdin, so its remote EOF cleanup remains in
use; native host-crash storage recovery still needs separate qualification.
