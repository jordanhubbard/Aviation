# G1000 Avionics SDK

This package realizes the deterministic, portable device-model portion of
`aviation.avionics` in TypeScript and Python. AHRS, ADC, GPS, ADF, and DME models share
one acceptance-vector set and reject invalid inputs. G1000 and Flight Planner consume
the Python realization through thin compatibility exports.

## Modules

- `src/devices.ts` and `python/aviation_avionics/` — qualified AHRS, ADC, and GPS models
- `src/radios.ts` and `python/aviation_avionics/radios.py` — qualified ADF/DME station
  selection, bearing, range, service-volume, and signal models

## Qualification boundary

The pure `computeAhrs`/`computeAdc`/`computeGps`/`computeAdf`/`computeDme` functions and
equivalent Python functions are authoritative for their declared contracts. Station
catalogs remain explicit inputs; radio hardware I/O, autopilot policy, and simulator
orchestration remain outside this package.
