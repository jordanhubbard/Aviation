# flight-planner

> Part of the [Aviation Monorepo](../../README.md)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Unified VFR flight planning app with route + local planning, terrain checks, and weather.
The VFR planning form does not request instrument departure, arrival, or approach
procedures and does not fetch instrument-procedure catalogs when airports change.

**Note**: This application is now part of the Aviation monorepo. For monorepo-wide documentation, see the [root README](../../README.md).

## Features

- **Route planning** (direct or multi-leg with fuel stops)
- **Local planning** (nearby airports within a radius)
- **Terrain profile** and optional terrain clearance enforcement (Open-Meteo by default, with bounded batches of up to 50 samples per request; optional OpenTopography provider)
- **Weather**: OpenWeatherMap current conditions + METAR enrichment + Open-Meteo forecasts
- **Map UI**: Leaflet route display + optional OpenWeatherMap tile overlays + wind markers

## Quickstart

### Prerequisites

- Python 3
- Node 18+
- Git LFS (recommended for large `backend/data/*` caches)

### Setup

1. **Navigate to the application directory**:
   ```bash
   # From the monorepo root
   cd apps/flight-planner
   ```

### Backend

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt

# Run API
.venv/bin/python -m uvicorn backend.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Vite proxies `/api` to the backend (`http://localhost:8000`) by default.

## Environment variables

Copy `.env.example` → `.env` and set any API keys you plan to use.

### Backend

- `OPENWEATHERMAP_API_KEY`: required for `GET /api/weather/{code}` and the map tile endpoints if you call OpenWeatherMap directly
- `TERRAIN_PROVIDER`: defaults to `open-meteo`; set to `opentopography` to select the optional OpenTopography provider.
- `OPENTOPOGRAPHY_API_KEY`: required only when `TERRAIN_PROVIDER=opentopography`.
- `OPENAIP_API_KEY`: server-side access to openAIP airports, airspaces, navaids, reporting points, hotspots and obstacles (CC BY-NC 4.0; attribution required)

### Frontend

- `VITE_OPENWEATHERMAP_API_KEY`: enables OpenWeatherMap tile overlays in the map UI (can be the same key as `OPENWEATHERMAP_API_KEY`)

For the combined hosted container, set both variables in its protected runtime
environment and restart the service. The backend serves `/env.js` from an explicit
allowlist with `Cache-Control: no-store`, so overlay configuration does not require
rebuilding the image. Only the explicitly set `VITE_OPENWEATHERMAP_API_KEY` is
public browser configuration; server credentials are not automatically published.

## Usage examples

Plan a route:

```bash
curl -sS -X POST http://localhost:8000/api/plan \
  -H 'Content-Type: application/json' \
  -d '{
    "mode": "route",
    "origin": "KSFO",
    "destination": "KLAX",
    "speed": 110,
    "speed_unit": "knots",
    "altitude": 5500,
    "avoid_airspaces": false,
    "avoid_terrain": false,
    "apply_wind": true
  }'
```

Find nearby airports:

```bash
curl -sS -X POST http://localhost:8000/api/plan \
  -H 'Content-Type: application/json' \
  -d '{"mode":"local","airport":"KSFO","radius_nm":25}'
```

Search airports:

```bash
curl -sS 'http://localhost:8000/api/airports/search?q=SFO&limit=10'
```

## API documentation

- Interactive OpenAPI UI: `http://localhost:8000/docs`
- Markdown reference: `docs/API.md`

## Tests

Backend:

```bash
.venv/bin/python -m pytest
```

Frontend:

```bash
cd frontend
npm run type-check
npm run lint
```

## Data files (Git LFS)

Large cache files live in `backend/data/` and are tracked via Git LFS.

To regenerate caches from the source datasets:

```bash
.venv/bin/python scripts/build_data_caches.py
```

## Docker (backend)

Build:

```bash
docker build -f backend/Dockerfile -t flight-planner-backend .
```

Run:

```bash
docker run --rm -p 8000:8000 --env-file .env flight-planner-backend
```

## Screenshots

Coming soon.

## Private aircraft manual library

Open **Aircraft library** in the navigation or `/aircraft-library`. Upload one or more
POH, AFM, PIM, maintenance or supplement PDFs, with an ICAO type and optional registrations.
The library retains original bytes, every acquisition, extracted physical/printed pages,
and extraction completeness. General references and another registration's aircraft-specific
documents remain separate in search. Metadata and associations can be corrected explicitly
without replacing originals; changes invalidate previous generated distillations.

Configure a separate private library access key of at least 32 characters in
`AIRCRAFT_LIBRARY_TOKEN`. Unconfigured routes return unavailable and never become public.
The UI holds this key in page memory only; API clients send `Authorization: Bearer ...`.
Do not put access or provider keys in URLs. `AIRCRAFT_LIBRARY_DIR` defaults to
`/app/data/aircraft-library`; back up this whole private directory (including SQLite and
originals) consistently while stopped (or use a consistent SQLite backup), and retain the service's persistent data mount across deployments.

Text search and extractive section indexes work without a model. To enable generation, set
`AIRCRAFT_LIBRARY_LLM_BASE_URL` to an OpenAI-compatible API base,
`AIRCRAFT_LIBRARY_LLM_MODEL` to an explicit model and, when required,
`AIRCRAFT_LIBRARY_LLM_API_KEY`. `AIRCRAFT_LIBRARY_EMBEDDING_MODEL` independently enables
semantic vectors at the same endpoint. Provider keys stay server-side. Retrieved page
excerpts are sent to the configured model when requesting answers/distillations; embedding
requests send indexed passages. The service labels the configured model and validates returned
page citations, exact quotes and numeric values against quoted evidence. This validation
is not proof that a generated interpretation or aircraft applicability is correct.

Automated discovery uses `AIRCRAFT_LIBRARY_BRAVE_SEARCH_KEY`, or a SearXNG JSON
`AIRCRAFT_LIBRARY_SEARCH_URL` such as an operator-run `/search` endpoint. It runs multiple
type/model/manual queries and seeks multiple examples with per-source failures and provenance.
Without search configuration, supplied public PDF or manual-library URLs can still be acquired.
Robots restrictions, access controls and paywalls are not bypassed. Discovered examples have
unverified identity, kind, variant and applicability until reviewed; they are not silently
stamped with the requested variant/revision. Copyright/license status remains explicit and
originals stay private. Tesseract (included in the application image) and PDFium provide OCR
for scanned pages. Missing/unreadable pages and encrypted/malformed originals stay visible.

Uploads/acquisitions create persistent jobs. Use **Refresh jobs and documents** to inspect
progress; interrupted jobs can resume after their five-minute process lease expires. Individual
PDF extraction has a ten-minute deadline and Linux subprocess resource limits. Each upload is
limited to 100 MiB and 1,500 pages. Discovery batches support up to 200 examples; repeat with
more specific terms for further examples. Extraction, model and acquisition failures retain
originals and prior provenance. No extracted figure is automatically promoted to an aircraft
performance dataset or operational approval.

For asymmetric embedding providers such as NVIDIA NeMo Retriever, set
`AIRCRAFT_LIBRARY_EMBEDDING_MODE=query_passage`. Document indexing then sends
`input_type=passage`; question retrieval sends `input_type=query`. The default
`symmetric` omits this extension for OpenAI-compatible providers. Persisted vectors
are scoped to endpoint, model and mode; re-run each document's embedding job when
changing these settings or upgrading from the earlier model-name-only index.

Set `AIRCRAFT_LIBRARY_EMBEDDING_BATCH_SIZE` from 1 to 32 (default 32) when the
provider limits batching. A value of 1 still embeds every passage individually.

## Timed route hazard assessment

Open **Route assessment** at `/route-assessment`, or use the panel below a completed
route plan. Prepare an airport route or use the displayed route, explicitly review
the assumed groundspeed/altitude/departure time, then edit every waypoint's planned
UTC arrival and altitude in feet MSL for climb/descent or timing changes. Draft
profiles use constant groundspeed and altitude; they do not model aircraft climb
performance. Assess the reviewed profile to see centerline/proximity encounters,
source geometry, sampled terrain clearances and individual source coverage.

Source warnings remain beside the results: full NOTAM access is pending, TFR
geometry may be absent, schedules or altitude references may need interpretation,
and provider queries may be truncated/unavailable. No-encounter results do not
mean safe or cleared. Terrain samples do not bound intervening peaks. A local
projected corridor uses the disclosed conservative allowance; it is distinct from
centerline contact. Original source fields and timestamps remain available.

The endpoint uses existing public data providers and terrain configuration; it
does not require or provision FAA NOTAM credentials. Identical profile snapshots
are cached for 60 seconds in the bounded shared data cache, and there are two
concurrent assessment slots per process. Cached times remain original. No background
polling, persistent route storage or new private provider credentials are added.

`AIRCRAFT_LIBRARY_DISTILL_BATCH_CHARS` accepts 2000–18000 (default 18000).
Use a smaller value for limited provider contexts/token quotas. All readable
passages are still processed; changing the batch budget invalidates resumable
progress from incompatible batch identities. Partial or unresolved batches never
claim complete document distillation.

`AIRCRAFT_LIBRARY_LLM_MIN_INTERVAL_SECONDS` accepts 0–120 (default 0) to pace
chat-completion starts across the process's questions and background work. Set it
for the provider's quota alongside the batch budget; a smaller batch can reduce
token pressure. This does not change the required evidence, and rate-limited
failures still preserve resumable partial progress.

`AIRCRAFT_LIBRARY_MODEL_READ_TIMEOUT_SECONDS` accepts 10–600 (default 120) for
slow model responses. Connect/pool waits are limited to 10 seconds and writes to
30 seconds. Timeout errors identify their category and configured read limit;
changing this setting adds no HTTP retries or citation exceptions.

## FAA charts and navigation cycles

Open **Charts / Navigation** at `/charts`. Search terminal charts by their published
ICAO/FAA airport identifier, or choose VFR/IFR and search chart names. Editions retain
UTC effective/end instants, source links, original SHA-256 and acquisition history.
Edition dates and catalog verification are displayed separately. A chart is current
only when its edition is effective and a successful catalog check is at most 24 hours
old. Failed or stale checks remain visible without removing cached originals.
PDF previews include paging/zoom; GeoTIFFs use their declared projection for map tiles.
Only the main chart body inside the FAA neatline is accurately georeferenced.

An operator first refreshes FAA catalogs and downloads selected originals. Set
`AVIATION_CHARTS_TOKEN` to at least 32 characters (or reuse `AIRCRAFT_LIBRARY_TOKEN`);
enter it in the management panel. It stays in page memory and mutation headers.
No periodic source polling runs on startup. Public readers can browse the synchronized
catalog and cached government reference files without the management credential.

`AVIATION_CHARTS_DIR` defaults to `/app/data/charts`. Back up the complete directory,
including `charts.sqlite3` and immutable `objects`, using a consistent SQLite backup
or stopping the service first. Schema version 1 is checked on startup. Restore the
whole directory at a compatible version for rollback. `AVIATION_CHARTS_CACHE_BYTES`
defaults to 4 GiB; writes preserve 2 GiB of free disk. Failed updates retain old copies.
An offline manifest pins member hashes across source updates; verify those hashes.

Current navigation browsing ingests real FAA CIFP ARINC 424-18 distributions; the
distribution readme determines cycle identity, since individual records retain older
amendment dates. The shared SDK owns catalog queries and freshness. Raw special legs,
continuations and constraints remain available; common legs are an incomplete reference,
not a flyable guidance model. The legacy procedure endpoint no longer defaults to samples.

## Local cockpit receiver bridge

The operator-run bridge accepts source-filtered GDL90 UDP and exposes typed,
authenticated status, telemetry and listener controls. It starts no UDP socket
when imported or during ordinary planner startup. Use the planner Python
environment with its declared dependencies. From the retained implementation root:

```bash
export AVIATION_COCKPIT_TOKEN="$(python -c 'import secrets; print(secrets.token_urlsafe(32))')"
PYTHONPATH=packages/g1000-avionics-sdk/python:packages/shared-sdk/python:apps/flight-planner/backend \
  python -m app.cockpit_bridge --source 192.168.10.1 \
  --allow-origin https://flight-planner.jordanhubbard.net
```

The receiver IP above is an example: configure the actual sender address or CIDR
with repeatable `--source` arguments. UDP binds to `0.0.0.0:4000`, while HTTP binds
to `127.0.0.1:18190` by default. `--udp-bind`, `--udp-port`, `--http-bind` and
`--http-port` change those addresses. Non-loopback browser access needs an
explicit reachable binding, trusted TLS via `--tls-cert`/`--tls-key`, and the exact
browser origin in `--allow-origin`. A desktop browser may also require TLS for
its local connection. Keep the token in environment/page memory, outside URLs,
command-line arguments and persistent browser storage.

Authenticated `POST /api/cockpit/start` explicitly opens the configured UDP
listener; `POST /api/cockpit/stop` releases it. CLI `--start` explicitly requests
start on launch. `GET /api/cockpit/status` and `/api/cockpit/state` require the same
bearer token. OpenAPI is at `/api/openapi.json`. A listening socket and a recent
receiver report are separate states; GPS requires fresh source-specific validity.
Traffic/ownship ages, unknown values, saturation bounds and pressure/geometric
altitude references remain visible. Weather decoding is currently unavailable;
capabilities expose that limitation rather than labelling raw bytes as weather.
No compatibility with a physical receiver is established by loopback tests.

Report ages include observed suspend gaps and never decrease after a clock
correction. Only newly received reports can restore freshness. Clock disagreements
over one second increment the `clock_discontinuities` diagnostic counter.

Optional local HTTP/MCP access reuses the Meta gateway engine:

```bash
node apps/meta-app/cockpit-gateway.mjs
```

It binds `127.0.0.1:18191`, publishes only the cockpit service at
`/api/v1/cockpit`, and exposes `/mcp`, `v1.cockpit.request`,
`v1.cockpit.describe` and `aviation://v1/cockpit/openapi`. Callers pass bridge
credentials explicitly in service request headers; the gateway does not store
them. `AVIATION_COCKPIT_BRIDGE_ORIGIN`, `AVIATION_COCKPIT_GATEWAY_BIND` and
`AVIATION_COCKPIT_GATEWAY_PORT` configure this explicitly launched profile.
The normal hosted gateway keeps its existing service list.

## Offline flight packages

Open **Offline packages**, or use **Prepare offline flight package** on a planned
route. Select airport codes or an existing saved route, and choose already acquired
chart members. Prepare the package to review its exact byte count, selected PDF
pages and raster bounds/zoom before downloading. Charts must be acquired through
the existing chart operator flow first; package preparation cannot use private
library documents or bypass chart acquisition.

An explicitly selected saved plan retains all serialized flight data, metadata and
authored notes in the private manifest/browser package. Those bytes never enter
the public chart object store.

Downloaded packages stay in IndexedDB in that browser. Installation verifies every
asset before publishing a complete package record, and opening verifies retained
bytes again. The production build includes a hash-inventoried service worker for
reopening `/offline` after a browser restart without a connection. API responses,
credentials and private aircraft documents are excluded from the shell cache.
HTTPS or localhost, IndexedDB, Web Crypto, service workers and browser writer locks
are required. Development-mode Vite does not generate the production shell.

PDF originals and selected page images remain available; GeoTIFF packages include
the original and their declared tiles. Requested bounds and actual tile-grid
extent are separate. Tiles outside the declared zoom/coverage are unavailable.
Station METARs/TAFs retain original text, observation/issue/validity times, provider
retrieval times, missing-report and partial-coverage states. Airport references
retain the suite catalog snapshot with explicitly unknown source revision.
Opening offline does not refresh any source or establish current chart/weather
coverage. Stale/expired/future and unverified source states remain visible.

Limits are 128 MiB per package, 512 MiB/32 complete packages per browser, four chart
members, 128 PDF previews and 512 raster tiles. The browser reports storage estimates
and download progress; cancellation, interrupted installs and failed integrity/quota
checks cannot publish a partial package. A refreshed revision keeps selected chart
editions and creates a new package ID; select replacement members to change editions.
The old package remains until explicitly deleted. Browser data clearing or eviction
can remove saved material, so verify it before relying on it disconnected.

`POST /api/offline/prepare` exposes the typed manifest over native HTTP and the
normal planning gateway/MCP discovery. Rendered PNG transfer uses
`GET /api/offline/assets/{sha256}`; original members keep their hash-pinned chart
URLs. PNG content hashes identify PNG bytes, with original-source identity retained
separately. Provider URLs and retrieval times remain bound to the matching
acquisition receipt even after a forced refresh changes the current original.
Inline route/airport/weather snapshots are returned privately and never
written into the public chart object store. The object store's existing disk quota
and reserve apply to derived chart bytes as well as originals.

Repeatable browser acceptance lives in `frontend/e2e/offline-acceptance.mjs` and
`offline-failures.mjs`. Use an isolated running production build with the FAA KSFO
airport diagram and San Francisco TAC already acquired. From `frontend`, run:

```bash
AVIATION_OFFLINE_BASE_URL=http://127.0.0.1:8769 npm run test:offline
```

The runner prints its evidence directory and writes screenshots, accessible page
structure, source manifests and desktop/mobile restart results. It creates new,
isolated browser profiles and retains them for diagnosis. It never files or saves
a flight plan. For controlled corruption/quota/cancellation/concurrency tests,
reuse its `desktop-manifest.json`:

```bash
AVIATION_OFFLINE_BASE_URL=http://127.0.0.1:8769 \
AVIATION_OFFLINE_FIXTURE_MANIFEST=/path/to/evidence/desktop-manifest.json \
  npm run test:offline-failures
```

Set `AVIATION_OFFLINE_EVIDENCE_DIR` to choose the retained output location. These
runners require the installed Playwright Chromium build; they do not install or
launch a system browser. Source acquisition/availability and controlled failure
injection are recorded as separate evidence, and neither proves receiver hardware.
