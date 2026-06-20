---
id: flightplanner-1nn.1
status: closed
deps: []
links: []
created: 2025-12-17T13:26:20.218788-05:00
type: task
priority: 0
parent: flightplanner-1nn
mac-task-id: task_fa7b286f537f421ebbcc04e8e548cd24
---
# Consolidate airport database files

Merge airports.csv and airports_us.json from both apps, eliminate duplicates, create unified airport index with ICAO/IATA/GPS codes

## Close Reason

Generated unified backend/data/airports_cache.json from OurAirports (airports.csv) with normalized ICAO/IATA fields and deduping
