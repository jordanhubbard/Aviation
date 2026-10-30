# G1000 Avionics SDK

This package realizes the deterministic, portable device-model portion of
`aviation.avionics` in TypeScript and Python. AHRS, ADC, GPS, ADF, DME, marker-beacon,
audio-panel, and transponder models share one acceptance-vector set and reject invalid
inputs. G1000 and Flight Planner consume the Python realization through thin
compatibility exports.

## Modules

- `src/devices.ts` and `python/aviation_avionics/` — qualified AHRS, ADC, and GPS models
- `src/radios.ts` and `python/aviation_avionics/radios.py` — qualified ADF/DME station
  selection, bearing, range, service-volume, and signal models
- `src/controls.ts` and `python/aviation_avionics/controls.py` — qualified marker
  geometry, audio-panel levels, squawk normalization, and IDENT transitions

## Qualification boundary

The pure device, radio, marker, audio-panel, and transponder functions and equivalent
Python functions are authoritative for their declared contracts. Station and marker
catalogs remain explicit inputs; audio playback, radio hardware I/O, autopilot policy,
physical transponder I/O, and simulator orchestration remain outside this package.
