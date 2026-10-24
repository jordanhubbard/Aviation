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
