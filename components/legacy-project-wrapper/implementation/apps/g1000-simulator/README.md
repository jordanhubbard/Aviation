# G1000 Simulator

## Current sourced procedure browser

The shipped dashboard links to `/procedures`. Enter a published airport identifier
and explicitly load FAA departure, arrival and approach records, or open a
`/procedures?airport=KSFO` handoff from charts/preflight. The browser preserves cycle
verification, effective dates, original ARINC fields, unknown values and incomplete
guidance. Results are paginated; browsing does not activate a flight plan. Tables
scroll horizontally on narrow screens. No navigation requests or polling run until
the user asks for data.

The mounted FastAPI factory exposes typed GET `/api/navigation/{airport}` and the
legacy GET `/api/procedures/{airport}` view. Both use the same sourced planning API;
the legacy response includes the complete `navigation` envelope for its page, not
a complete airport database. HTTP 503 means current coverage is unverified or
unavailable; HTTP 502 means the upstream response was invalid. Neither falls back
to sample procedures. Explicit catalog injection remains available for tests.

`AVIATION_PLANNING_BASE_URL` optionally selects an operator-controlled planning
HTTP(S) base; the default is `https://meta-app.jordanhubbard.net/api/v1/planning`.
The adapter appends `/api/navigation/<identifier>`. Keep credentials out of this
URL: public FAA reference reads require none, caller credentials are not forwarded,
and this process does not download FAA catalogs or own their freshness calculations.
See the [chart/navigation contract](../../../../../docs/architecture/charts-navigation.md).
`pnpm --filter g1000-simulator-frontend run test:procedures` exercises the shipped
browser's request ownership, invalidation, paging and explicit failure behavior.
For a built running app backed by actual current FAA data, run
`pnpm --filter g1000-simulator-frontend run test:navigation <application-origin> KSFO <absolute-evidence-directory>`.
Use an ignored evidence directory and an airport with at least two procedure pages.
This desktop/mobile gate reads real source records, checks raw-record identity,
unknown values, pagination, input invalidation and table scrolling, and rejects
runtime/request failures or document overflow. It uses the owned browser runner;
no FAA credential or provider interception is required.

## Overview
The G1000 Simulator is a comprehensive flight simulation application designed to emulate the Garmin G1000 avionics suite. It is structured to be developed in multiple phases, each focusing on different aspects of the avionics and flight simulation.

## Development Phases

### Phase 1 (Weeks 1–4) — Foundation
- **Project scaffolding**: Set up the basic structure for the flight-planner app.
- **Backend service skeleton**: Implemented using FastAPI with initial services like GPSSimulationService.
- **Frontend React app + basic canvas rendering**: To be implemented.
- **WebSocket communication established**: Basic WebSocket endpoint set up in FastAPI.
- **Basic flight state model**: Initial GPS state model implemented.
- **Initial aircraft model (Cessna 172)**: To be implemented.

### Phase 2 (Weeks 5–8) — Core Avionics
- **PFD display (attitude, airspeed, altitude, heading)**: To be implemented.
- **Basic flight physics simulation**: To be implemented.
- **AHRS/ADC simulation**: To be implemented.
- **GPS position/navigation**: Basic GPS simulation implemented.
- **Input management (mouse/keyboard)**: To be implemented.

### Phase 3 (Weeks 9–12) — Navigation & MFD
- **MFD moving map**: To be implemented.
- **Flight plan management**: To be implemented.
- **Navigation database integration**: To be implemented.
- **Map overlays (terrain, weather, traffic)**: To be implemented.
- **Softkey menu system**: To be implemented.

### Phase 4 (Weeks 13–16) — Autopilot & Advanced
- **Autopilot modes + PID controllers**: To be implemented.
- **GPS/ILS approaches**: To be implemented.
- **Alert/annunciation system**: To be implemented.
- **Demo flight scenarios**: To be implemented.

### Phase 5 (Weeks 17–20) — Polish & Docs
- **UI polish + themes**: To be implemented.
- **Performance optimization**: To be implemented.
- **Comprehensive documentation**: To be implemented.
- **Tutorial scenarios**: To be implemented.
- **User manual**: To be implemented.
- **Developer API docs**: To be implemented.

## Getting Started

Install dependencies from the monorepo root:

```bash
pnpm install
```

### Running Tests

The simulator uses **Jest** (ts-jest) for unit tests. A `jest.config.js` at the app root configures ts-jest and excludes e2e and performance test directories.

```bash
cd apps/g1000-simulator
pnpm test
# or from monorepo root:
pnpm --filter @aviation/g1000-simulator run test
```

Current passing test count: **68 tests**.

### Package Manager

This app is part of the pnpm workspace monorepo. Internal package references use `workspace:*` protocol. Backend requires `@types/express` and `@types/cors`. Frontend store files use Zustand v5 named import (`import { create } from 'zustand'`) and React Router v7 `<Routes>`/`<Route element={<X />}>` syntax.
