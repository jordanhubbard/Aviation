---
id: Aviation-dhw.6
status: closed
deps: []
links: []
created: 2026-01-24T11:45:34.020431-08:00
type: epic
priority: 2
parent: Aviation-dhw
mac-task-id: task_daa6bb288439450b8dc3be51bb43aad6
---
# Navigation Data SDK

## Purpose
Navigation database for airports, navaids, airways, procedures, airspace, and obstacles.

## Data Sources
- OurAirports
- FAA CIFP
- OpenAIP
- Custom curated data

## Core Content
- Airports (ICAO/IATA, runways, frequencies)
- VORs, NDBs, intersections
- Airways (Victor/Jet routes)
- Procedures (SIDs, STARs, approaches in ARINC 424)
- Airspace boundaries
- Obstacles

## Close Reason

Completed nav data ingestion, storage schema, query API, procedure parsing, and caching.
