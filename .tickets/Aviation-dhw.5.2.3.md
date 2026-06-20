---
id: Aviation-dhw.5.2.3
status: closed
deps: [Aviation-dhw.5.2.2]
links: []
created: 2026-01-25T11:05:28.259721-08:00
type: task
priority: 2
parent: Aviation-dhw.5.2
mac-task-id: task_681d493f40fc4973b5ad706c9a648bd6
---
# Task: Integrate control inputs and forces

## Description
Integrate control inputs (yoke, trim, throttle) into force/moment calculations.

## Requirements
- Map control inputs to aerodynamic forces
- Support engine thrust and prop effects
- Expose forces for diagnostics

## Deliverables
- Control input integration in physics engine

## Close Reason

Implemented SimpleForceModel mapping control inputs to aerodynamic, propulsion, and gravity forces with diagnostic breakdowns.
