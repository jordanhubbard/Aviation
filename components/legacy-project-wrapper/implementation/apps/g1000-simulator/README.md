# G1000 Simulator

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