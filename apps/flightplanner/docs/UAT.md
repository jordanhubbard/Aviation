# User Acceptance Testing (UAT)

This document captures the high-level UAT scenarios for the unified **flightplanner** app.

## Prerequisites

- Backend + frontend running (e.g. `make dev-up`)
- Optional: set API keys in `.env` for live weather/terrain data

## Scenarios

### 1) Cross-country route planning workflow

- [x] Select **Route** mode
- [x] Enter origin + destination airports (autocomplete)
- [x] Plan route successfully
- [x] Route renders on map (line + markers)
- [x] Route legs table renders and shows per-leg distances
- [x] Elevation profile renders
- [x] Weather panels render for waypoints

### 2) Local flight planning workflow

- [x] Select **Local** mode
- [x] Enter a center airport (autocomplete)
- [x] Plan local flight successfully
- [x] Nearby airports list renders

### 3) Weather overlays

- [x] Overlay controls render
- [x] When OpenWeatherMap API key is missing, overlays are disabled (UI indicates requirement)
- [x] When API key is present, overlays can be enabled and show tiles

### 4) Error handling

- [x] Failed API request shows an error state
- [x] Retry uses the previous request parameters

## Automated Coverage

The Playwright suite covers the primary end-to-end workflows:

- `e2e/weather.spec.ts`
- `e2e/flight-planner.spec.ts`
