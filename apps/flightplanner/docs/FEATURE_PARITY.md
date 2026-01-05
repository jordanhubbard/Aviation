# Feature Parity Checklist

This checklist is used to verify that the unified **flightplanner** app preserves the key functionality of the legacy apps:

- `xctry-planner` (cross-country routing + map UI)
- `vfr-flightplanner` (modular FastAPI backend, weather integrations, overlays)

## Backend (FastAPI)

- [x] Health endpoint: `GET /api/health`
- [x] Unified plan endpoint: `POST /api/plan` (discriminated union: local vs route)
- [x] Airport search: `GET /api/airports/search?q=...` (+ optional proximity filtering)
- [x] Route planning: `POST /api/route`
  - [x] Airspace avoidance support
  - [x] Terrain avoidance support
  - [x] Fuel stop planning / multi-leg routing (A* constraints)
- [x] Local flight planning: `POST /api/local`
- [x] Weather: `GET /api/weather/{code}`
  - [x] OpenWeatherMap current conditions (when API key present)
  - [x] METAR enrichment/override (aviationweather.gov)
- [x] Forecast: `GET /api/weather/{code}/forecast?days=...`
- [x] Route weather sampling: `POST /api/weather/route`
- [x] Terrain endpoints
  - [x] `GET /api/terrain/point`
  - [x] `GET /api/terrain/profile`

## Frontend (React)

- [x] Mode selection UI (Local vs Route)
- [x] Flight planning form
  - [x] Airport autocomplete for origin/destination/center
  - [x] Avoidance toggles (airspace/terrain/weather overlays)
  - [x] Speed/altitude inputs
- [x] Route map visualization (Leaflet)
  - [x] Origin/destination markers
  - [x] Route polyline
  - [x] Fit bounds to route
- [x] Weather overlay controls (OpenWeatherMap tiles)
- [x] Route legs table
- [x] Elevation profile chart
- [x] Weather panels (current + METAR + forecast)
- [x] Loading/error/retry UX

## Automated Verification

- [x] Backend unit/integration tests: `pytest`
- [x] Frontend unit tests: `npm run test`
- [x] End-to-end tests (Playwright): `npm run e2e`
