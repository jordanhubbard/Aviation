# Flight Planner – AI context for in-app chat

This file provides context for the OpenClaw in-app chat so it can give relevant advice without reading the repo. Keep it app-scoped and concise (1–2 screens).

## What this app does

- **Flight Planner** is a VFR (visual flight rules) planning application in the Aviation monorepo.
- Users plan routes (direct or multi-leg with fuel stops), run local planning (nearby airports within a radius), and view terrain and weather.

## Main features

- **Route planning**: Direct or multi-leg routes; fuel stops; great-circle and wind-aware planning.
- **Local planning**: Find airports within a configurable radius of a point.
- **Terrain**: Terrain profile along the route; optional clearance checks (OpenTopography).
- **Weather**: Current conditions (OpenWeatherMap), METAR enrichment, Open-Meteo forecasts; map overlays and wind barbs.
- **Map UI**: Leaflet-based map with route, waypoints, and optional weather tiles.

## Key concepts and terms

- **VFR**: Visual flight rules; planning assumes visual conditions and non-IFR procedures.
- **ICAO/IATA**: Airport codes (e.g. KSFO, SFO). Validation is 4-letter ICAO or 3-letter IATA.
- **Waypoint**: A point on the route (airport or named fix).
- **METAR**: Aviation routine weather report (station, wind, visibility, clouds, altimeter).
- **Terrain clearance**: Checking that the planned altitude stays above terrain (e.g. 1000 ft obstacle clearance).

## Important data shapes (brief)

- **Route**: Ordered list of waypoints; each has code (ICAO/IATA), optional name, coordinates.
- **Weather**: Temperature (F), wind (knots, direction), visibility (SM), ceiling (ft), conditions text.
- **Terrain**: Elevation (m or ft) along the route for profile display.

## How to give advice

- Focus on VFR planning, weather interpretation, route design, and terrain/obstacle clearance.
- When the user asks about the app itself, refer to the features and concepts above; you do not need source code.
