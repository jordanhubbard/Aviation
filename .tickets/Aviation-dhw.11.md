---
id: Aviation-dhw.11
status: closed
deps: []
links: []
created: 2026-01-24T11:47:28.664265-08:00
type: epic
priority: 2
parent: Aviation-dhw
mac-task-id: task_ce88642323d64b8182b0fc15cd537282
---
# Primary Flight Display (PFD)

## Core Elements
- Attitude indicator (blue/brown horizon, pitch ladder ±90°, roll pointer, slip/skid)
- Airspeed indicator (tape + digital, V-speed arcs, TAS)
- Altimeter (tape + digital, altitude bug, baro setting, VSI)
- Heading indicator (compass rose, desired track, CDI/HSI, TRK vs HDG)
- Navigation data (groundspeed, track, active waypoint, bearing, distance, XTK, ETA)
- Engine/system data (RPM, MP, fuel flow, EGT/CHT, electrical, fuel qty, oil)
- Alerts and annunciations

## Update Frequency
- 20 Hz (50ms intervals)

## PFD Data Requirements
See `PFDData` interface from plan (attitude, speed, altitude, heading, nav, autopilot, alerts).

## Rendering Sequence
1. Clear canvas
2. Attitude background
3. Pitch ladder
4. Roll pointer
5. Flight director bars
6. Airspeed tape
7. Altimeter tape + VSI
8. HSI
9. Navigation data
10. Engine data
11. Alert overlay

## Close Reason

Closed
