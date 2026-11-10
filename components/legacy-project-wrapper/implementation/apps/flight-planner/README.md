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
- `OPENAIP_API_KEY`: reserved for future airspace integrations

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
