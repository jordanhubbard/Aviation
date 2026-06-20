---
id: Aviation-dhw.2.6
status: closed
deps: []
links: []
created: 2026-01-24T11:43:49.534517-08:00
type: task
priority: 2
parent: Aviation-dhw.2
mac-task-id: task_f2842a126c434091b34d3acddabc114f
---
# Story: Frontend component structure and rendering architecture

## Description
Define the frontend component structure and rendering architecture for PFD/MFD displays and shared UI elements.

## Component Structure
```
frontend/
├── src/
│   ├── displays/
│   │   ├── PFD/
│   │   │   ├── PFDCanvas.tsx
│   │   │   ├── AttitudeIndicator.tsx
│   │   │   ├── AirspeedTape.tsx
│   │   │   ├── AltimeterTape.tsx
│   │   │   ├── HSI.tsx
│   │   │   └── AlertOverlay.tsx
│   │   ├── MFD/
│   │   │   ├── MFDCanvas.tsx
│   │   │   ├── MapDisplay.tsx
│   │   │   ├── TerrainDisplay.tsx
│   │   │   ├── WeatherDisplay.tsx
│   │   │   ├── EngineDisplay.tsx
│   │   │   └── MenuSystem.tsx
│   │   └── Shared/
│   │       ├── SoftkeyBar.tsx
│   │       ├── Bezel.tsx
│   │       └── AlertAnnunciator.tsx
│   ├── controls/
│   │   ├── KnobController.tsx
│   │   ├── ButtonPanel.tsx
│   │   ├── AudioPanel.tsx
│   │   └── TransponderPanel.tsx
│   ├── services/
│   │   ├── websocket-client.ts
│   │   ├── flight-plan-api.ts
│   │   ├── weather-api.ts
│   │   └── scenario-api.ts
│   ├── stores/
│   │   ├── flightStore.ts
│   │   ├── navStore.ts
│   │   ├── autopilotStore.ts
│   │   ├── systemStore.ts
│   │   └── uiStore.ts
│   ├── rendering/
│   │   ├── canvas-utils.ts
│   │   ├── drawing-primitives.ts
│   │   ├── color-schemes.ts
│   │   └── fonts.ts
│   ├── utils/
│   │   ├── aviation-math.ts
│   │   ├── formatters.ts
│   │   └── validators.ts
│   └── App.tsx
```

## Rendering Approach
- Canvas 2D API for PFD/MFD elements
- Optional WebGL for terrain/3D synthetic vision
- Separate canvas per display for isolation
- React for bezel controls and overlays

## Close Reason

Closed
