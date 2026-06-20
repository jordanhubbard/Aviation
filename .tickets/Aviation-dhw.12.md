---
id: Aviation-dhw.12
status: closed
deps: []
links: []
created: 2026-01-24T11:48:00.037052-08:00
type: epic
priority: 2
parent: Aviation-dhw
mac-task-id: task_7384b9b9a2c1469cbbbae368646bbc8f
---
# Multi-Function Display (MFD)

## Core Capabilities
- Moving map with aircraft icon and flight plan overlay
- Terrain display and alerts
- Weather overlays (NEXRAD, METARs, winds aloft, lightning)
- Traffic display (simulated or ADS-B)
- Engine page with fuel management
- Trip planning tools

## Update Frequency
- Map: 5 Hz
- Engine page: 1 Hz

## MFD Map Data Requirements
See `MFDMapData` interface from plan (position, settings, flight plan, map features, overlays).

## Map Rendering Sequence
1. Calculate visible bounds
2. Render terrain (if enabled)
3. Render airspace
4. Render flight plan
5. Render airports/navaids
6. Render weather overlay (if enabled)
7. Render traffic (if enabled)
8. Render aircraft icon
9. Render range ring
10. Render map scale

## Close Reason

Closed
