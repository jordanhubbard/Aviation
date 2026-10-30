# G1000 Avionics SDK

This package realizes the deterministic, portable device-model portion of
`aviation.avionics` in TypeScript and Python. AHRS, ADC, and GPS models share one
acceptance-vector set and reject invalid inputs. G1000 and Flight Planner consume the
Python realization through thin compatibility exports.

## Modules

- `src/devices.ts` and `python/aviation_avionics/` — qualified AHRS, ADC, and GPS models

## Qualification boundary

The pure `computeAhrs`/`computeAdc`/`computeGps` functions and equivalent Python
functions are authoritative for their declared contracts. Radio and physical-device
models, autopilot policy, and simulator orchestration remain outside this package until
qualified by their own contracts and acceptance vectors.
