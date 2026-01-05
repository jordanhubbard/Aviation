# Architecture

This document describes the high-level architecture of the unified **flightplanner** application: major components, data flow, integration points, and the design decisions that shaped the current structure.

## Goals

- Provide a single UI and API for both **local (single-airport)** and **cross-country (two-airport)** flight planning.
- Keep core planning logic server-side (backend) with a thin UI client.
- Integrate multiple weather sources and present them consistently.
- Keep the backend modular, with shared schemas and routers.
- Prefer simple caching and deterministic testability over complex stateful infrastructure.

## Repository Layout

- `backend/`
  - FastAPI app, routers, schemas, services
  - `backend/data/` (cached datasets, Git LFS)
- `frontend/`
  - React/Vite app (MUI, Leaflet)
  - `frontend/e2e/` Playwright tests
- `tests/`
  - Backend unit + API/integration tests (pytest)
- `scripts/`
  - Data cache generation utilities
- `docs/`
  - `API.md`, `USER_GUIDE.md`, this file

## System Overview

### Runtime Components

1. **Frontend (React/Vite)**
   - Collects user inputs
   - Calls the backend via `/api/*`
   - Renders maps, tables, and weather panels

2. **Backend (FastAPI)**
   - Implements planning endpoints
   - Loads/caches datasets (airports/airspace)
   - Calls external weather/terrain services (with caching)

### Request/Response Model

- The frontend uses JSON APIs exclusively.
- A unified planning endpoint (`POST /api/plan`) uses a discriminated union request body with `mode`:
  - `mode=route`: cross-country route planning
  - `mode=local`: local planning around a single airport

## Backend Architecture

### App Initialization

- The FastAPI app is assembled with an application factory pattern.
- Global middleware includes:
  - CORS configuration
  - SlowAPI rate limiting (coarse protection of public endpoints)

### Routers

Routers live in `backend/app/routers/` and are mounted under `/api`.

Key routers:

- `plan.py`: dispatches `mode=route` vs `mode=local`
- `route.py`: route planning and enrichment
- `local.py`: local planning around a center airport
- `weather.py`: point weather, forecast, and route sampling
- `terrain.py`: point and profile elevation
- `airports.py`: search endpoints

### Schemas

Pydantic models live under `backend/app/schemas/` and are used by routers/services.

Design decision: schemas were centralized to keep request/response compatibility consistent across endpoints and to avoid per-router inline models drifting over time.

### Services

Services live under `backend/app/services/` and are responsible for:

- **Route planning**: waypoint generation, A* fuel-stop planning, constraint application
- **Weather**:
  - OpenWeatherMap (current)
  - Open-Meteo (forecast + route sampling)
  - METAR fetching/parsing (aviationweather.gov)
  - Flight category + recommendation computation
- **Terrain**:
  - OpenTopography SRTM requests (when enabled) and profile generation

### Caching

- **Dataset caching**: airport/airspace caches are local JSON files in `backend/data/`.
- **HTTP result caching**: weather and terrain lookups use in-process caching (TTL/LRU patterns) to reduce repeat calls.

Design decision: in-process caches are intentionally simple (no external Redis) to keep local development friction low.

### External Integrations

- OpenWeatherMap: current conditions and map tile overlays
- Open-Meteo: forecast and route-point sampling
- AviationWeather (NOAA): METAR raw text
- OpenTopography: SRTM/DEM elevation (optional; API-key gated)

For test stability, e2e runs may disable METAR fetch via `DISABLE_METAR_FETCH=1`.

## Data Layer

### Airports

- Primary cached dataset: `backend/data/airports_cache.json` (built from OurAirports).
- Search and filtering logic:
  - text search with scoring
  - proximity filtering (`lat/lon/radius_nm`)

### Airspace

- Cached datasets exist under `backend/data/`.
- Airspace avoidance is applied during route planning when enabled.

### Build/Refresh

- `scripts/build_data_caches.py` builds/refreshes caches from source data.

## Frontend Architecture

### UI Stack

- React + TypeScript
- Vite for local dev/build
- Material UI (MUI) for layout and controls
- Leaflet (`react-leaflet`) for route visualization and weather overlays

### Data Fetching

- Services under `frontend/src/services/` wrap HTTP calls (`axios` via `apiClient`).
- Hooks under `frontend/src/hooks/` encapsulate request state (React Query).

### Key Pages and Components

- `FlightPlannerPage.tsx`
  - Collects planning inputs via `FlightPlanningForm`
  - Renders results (route or local)
  - Renders `RouteMap`, `ElevationProfile`, weather panels, alternates

- `WeatherPage.tsx`
  - Weather lookup + recommendations

### Weather Overlays

- Map overlays are implemented as conditional tile layers.
- They require a frontend env var: `VITE_OPENWEATHERMAP_API_KEY`.

## Testing Strategy

### Backend

- `pytest` in `tests/`
- Focus: deterministic unit tests + API integration tests
- External HTTP calls are mocked/monkeypatched.

### Frontend

- Vitest + React Testing Library for component tests
- Playwright for end-to-end flows, including server startup via `webServer` config

## Design Decisions (Summary)

1. **Unified planning endpoint (`/api/plan`)** with discriminated union (`mode`) to keep frontend integration simple.
2. **Centralized Pydantic schemas** to reduce drift and duplication.
3. **In-process caching** (TTL/LRU) to avoid additional infrastructure while still protecting external APIs.
4. **Leaflet overlays** rendered client-side for responsiveness and simplicity (tiles).
5. **Playwright e2e** stubs network calls where appropriate to keep tests deterministic and fast.
