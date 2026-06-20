---
id: Aviation-dhw.3
status: open
deps: []
links: []
created: 2026-01-24T11:44:09.635902-08:00
type: epic
priority: 2
parent: Aviation-dhw
mac-task-id: task_27702d26f438461da38642716d04ac93
---
# G1000 Avionics SDK

## Purpose
Core avionics simulation library providing AHRS, ADC, GPS, NAV radios, and autopilot control logic.

## Modules
- `ahrs/` — attitude/heading computation and coordinate transforms
- `adc/` — air data (IAS/CAS/TAS), altitude, atmosphere
- `gps/` — position, WAAS/RAIM, accuracy modeling
- `nav-radios/` — VOR/ILS/ADF/DME simulation
- `autopilot/` — PID controllers, mode logic, envelope protection
