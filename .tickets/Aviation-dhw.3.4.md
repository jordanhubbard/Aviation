---
id: Aviation-dhw.3.4
status: open
deps: []
links: []
created: 2026-01-24T11:44:31.249116-08:00
type: task
priority: 2
parent: Aviation-dhw.3
mac-task-id: task_729ab0549a37428a9d32d16c07f5ff88
---
# Story: Autopilot controller logic

## Autopilot Core
- PID controllers for pitch, roll, altitude, and heading
- Mode logic as explicit state machines
- Autotrim simulation
- Envelope protection (pitch/bank limits, overspeed/stall protection)

## Example Controllers (from plan)
- PitchController / RollController
- AltitudeHoldController with target VS constraints
- HeadingHoldController with bank limits
