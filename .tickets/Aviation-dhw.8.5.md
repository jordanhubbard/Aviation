---
id: Aviation-dhw.8.5
status: open
deps: []
links: []
created: 2026-01-24T11:46:39.962225-08:00
type: task
priority: 2
parent: Aviation-dhw.8
mac-task-id: task_1af2c868e2e2424b9ddb67a0cfc895d6
---
# Story: Demo flight service

## Responsibilities
- Pre-recorded flight scenarios
- Training scenarios (pattern, approaches, cross-country)
- Recording and playback

## Key Modules
- `scenario_manager.py`
- `flight_recorder.py`
- `scenario_generator.py`

## API Endpoints
- `GET /api/demo/scenarios`
- `POST /api/demo/load/:id`
- `POST /api/demo/record`
- `GET /api/demo/download/:id`
