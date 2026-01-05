# flightplanner

Unified VFR flight planning app with route + local planning, terrain checks, and weather.

## Features

- **Route planning** (direct or multi-leg with fuel stops)
- **Local planning** (nearby airports within a radius)
- **Terrain profile** and optional terrain clearance enforcement (OpenTopography)
- **Weather**: OpenWeatherMap current conditions + METAR enrichment + Open-Meteo forecasts
- **Map UI**: Leaflet route display + optional OpenWeatherMap tile overlays + wind markers

## Quickstart

### Prerequisites

- Python 3
- Node 18+
- Git LFS (recommended for large `backend/data/*` caches)

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
- `OPENTOPOGRAPHY_API_KEY`: required for `/api/terrain/*` endpoints and route planning with `avoid_terrain=true`
- `OPENAIP_API_KEY`: reserved for future airspace integrations

### Frontend

- `VITE_OPENWEATHERMAP_API_KEY`: enables OpenWeatherMap tile overlays in the map UI (can be the same key as `OPENWEATHERMAP_API_KEY`)

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
docker build -f backend/Dockerfile -t flightplanner-backend .
```

Run:

```bash
docker run --rm -p 8000:8000 --env-file .env flightplanner-backend
```

## Screenshots

Coming soon.
