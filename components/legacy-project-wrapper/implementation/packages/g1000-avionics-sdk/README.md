# G1000 Avionics SDK

This package currently contains placeholder candidates for a future avionics device
simulation library. Its methods return fixed zero values or no result and it is not a
qualified realization of `aviation.avionics`.

## Modules

- `ahrs/` — Attitude/heading computation and coordinate transforms
- `adc/` — Air data (IAS/CAS/TAS), altitude, atmosphere
- `gps/` — Position, WAAS/RAIM, accuracy modeling
- `nav-radios/` — VOR/ILS/ADF/DME simulation
- `autopilot/` — PID controllers, mode logic, envelope protection

## Qualification boundary

Do not use these classes as authoritative AHRS, ADC, GPS, radio, or autopilot models.
Each device family needs unit-explicit behavior, deterministic acceptance vectors,
invalid-input policy, and application-consumer parity before it can join the common
SDK contract.
