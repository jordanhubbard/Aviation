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

## FAA charts and navigation cycles

Open **Charts / Navigation** at `/charts`. Search terminal charts by their published
ICAO/FAA airport identifier, or choose VFR/IFR and search chart names. Editions retain
UTC effective/end instants, source links, original SHA-256 and acquisition history.
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
