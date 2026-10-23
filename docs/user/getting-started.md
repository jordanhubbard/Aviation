# Getting started with Aviation

[Project guide](../README.md) → getting started

Aviation is a monorepo of flight planning, tracking, simulation, and analysis applications. Its existing applications run from the retained workspace at `components/legacy-project-wrapper/implementation`; repository-root `apps/`, `packages/`, manifests, and Make targets preserve their familiar paths. The Flight Track Analyzer is available at `apps/flight-track-analyzer` and processes ForeFlight and Garmin KML flight logs locally.

## Prerequisites and checkout

Use a Git checkout with Python 3.11 or newer, Node.js, pnpm 10, Go, and GNU Make for the aggregate development tests. Individual applications may need additional services or credentials; see their own READMEs before starting them. The retained workspace remains the source for the existing applications. There is no single installable artifact or service registration for the full monorepo; deployment is handled by each application. [ADOPT-003](../roadmap/active-work.md) tracks the integrated analyzer and retained qualification.

```console
git clone https://github.com/jordanhubbard/Aviation.git
cd Aviation
make test
```

`make test` installs the pnpm workspace dependencies and runs the available Node, Go, and Flight Track Analyzer suites. Other Python and Clojure suites have explicit `make test-python`, `make test-clojure`, and `make test-docker` targets and dedicated CI jobs. These require their own runtimes and application dependencies.

## Flight Track Analyzer

Start the analyzer from the repository root:

```console
make run-flight-track-analyzer
```

The target creates an isolated Python environment under `_build/venv/flight-track-analyzer` and serves the UI at `http://127.0.0.1:8010`. Check readiness with:

```console
curl http://127.0.0.1:8010/api/health
```

The expected response is `{"status":"ok"}`. Upload a ForeFlight or Garmin KML file through the UI to inspect takeoffs, landings, go-arounds, and field elevations. The analyzer reads the bundled Aviation airport cache for nearby airport MSL elevations. Airport elevation only supplies a calibrated ground reference; touchdown still requires the track's motion and altitude evidence. See `apps/flight-track-analyzer/README.md` for its API and deployment details.

## Contributor workflow

Run `litai project validate` for project authority and `litai verify` for authority, locks, and the current retained test receipt. Changes to the retained workspace that affect its harness require `litai project retained-harness readmit` and a new retained receipt before landing. The current receipt proves retained legacy parity; it does not claim native Component generation or acceptance.
