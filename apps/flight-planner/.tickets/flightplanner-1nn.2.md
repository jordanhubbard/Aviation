---
id: flightplanner-1nn.2
status: closed
deps: []
links: []
created: 2025-12-17T13:26:20.401953-05:00
type: task
priority: 0
parent: flightplanner-1nn
mac-task-id: task_2c838e02230a4e93ab2e3183e84fedb2
---
# Merge airspace data from both applications

Combine airspace.geojson, airspaces_ch.geojson, airspaces_us.json into unified format with proper GeoDataFrame structure

## Close Reason

Generated backend/data/airspaces_us.json (simplified) plus backend/data/airspace_cache.json (merged GeoJSON, incl. CH feature collection) for unified airspace loading
