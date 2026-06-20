---
id: Aviation-dhw.4.2.2
status: closed
deps: [Aviation-dhw.4.2.1, Aviation-dhw.4.1.2]
links: []
created: 2026-01-25T10:33:37.90659-08:00
type: task
priority: 2
parent: Aviation-dhw.4.2
mac-task-id: task_b0a6456e7e4847c88932338dd1a70a8f
---
# Task: Implement PFD layout renderer

## Description
Implement the PFD layout renderer using shared primitives.

## Requirements
- Render core PFD layout regions (airspeed, attitude, altitude, HSI)
- Wire data bindings for live updates
- Ensure layout scales with screen size

## Deliverables
- PFD renderer implementation ready for UI integration

## Close Reason

Added a PFD layout renderer that computes scaled regions and renders attitude, tapes, and HSI with live telemetry bindings.
