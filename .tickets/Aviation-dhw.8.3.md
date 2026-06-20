---
id: Aviation-dhw.8.3
status: open
deps: []
links: []
created: 2026-01-24T11:46:28.894557-08:00
type: task
priority: 2
parent: Aviation-dhw.8
mac-task-id: task_cbc294d7ad1d4c0aac74dd62c2ba1e83
---
# Story: Weather Service Integration

## Responsibilities
- METAR/TAF integration
- NEXRAD radar imagery
- Winds aloft interpolation
- Weather overlay data for MFD

## Key Modules
- `weather-api.ts`
- `metar-parser.ts`
- `nexrad-service.ts`
- `winds-aloft.ts`

## API Endpoints
- `GET /api/weather/metar/:icao`
- `GET /api/weather/taf/:icao`
- `GET /api/weather/nexrad/:tile`
- `GET /api/weather/winds/:lat/:lon/:alt`

## Integration
- Reuse existing weather-briefing services
- Extend for real-time streaming as needed
