---
id: Aviation-dhw.8.2
status: open
deps: []
links: []
created: 2026-01-24T11:46:21.642607-08:00
type: task
priority: 2
parent: Aviation-dhw.8
mac-task-id: task_5c1a8731336b46588689040236ecd243
---
# Story: Navigation Service

## Responsibilities
- Flight plan management and routing
- Navigation database access
- Procedure handling (SIDs, STARs, approaches)
- Great circle and rhumb line calculations
- Cross-track error computation

## Key Modules
- `flight_plan.py`
- `nav_database.py`
- `routing.py`
- `procedures.py`
- `geo_calculations.py`

## API Endpoints
- `POST /api/flight-plan`
- `GET /api/flight-plan/{id}`
- `PUT /api/flight-plan/{id}`
- `DELETE /api/flight-plan/{id}`
- `GET /api/nav/search`
- `GET /api/procedures/{airport}`
