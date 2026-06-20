---
id: Aviation-dhw.17.3
status: open
deps: []
links: []
created: 2026-01-24T11:50:35.053253-08:00
type: task
priority: 2
parent: Aviation-dhw.17
mac-task-id: task_72a1ed35b522410b8512f5488c1fa95a
---
# Story: External API and hardware integration

## REST API Endpoints
- `POST /api/control/autopilot/engage`
- `POST /api/control/autopilot/set-mode`
- `POST /api/control/heading/set`
- `POST /api/control/altitude/set`
- `POST /api/control/flight-plan/load`
- `GET /api/state/flight`
- `GET /api/state/navigation`
- `GET /api/state/systems`

## WebSocket
- `/ws/telemetry`
- `/ws/commands`

## Hardware Integration Targets
- Saitek/Logitech yokes and throttles
- VR headsets
- Button boxes and multi-function panels
