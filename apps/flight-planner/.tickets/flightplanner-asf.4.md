---
id: flightplanner-asf.4
status: closed
deps: []
links: []
created: 2025-12-17T13:26:40.083506-05:00
type: task
priority: 0
parent: flightplanner-asf
mac-task-id: task_eecaae95a19649d882143ab1db83496c
---
# Add terrain analysis and avoidance

Integrate OpenTopography SRTM API for elevation data, minimum safe altitude calculations, and terrain clearance warnings

## Close Reason

Added OpenTopography-backed terrain service + /api/terrain endpoints; route planning now checks terrain clearance when avoid_terrain=true
