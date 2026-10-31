# `aviation.aircraft` interface

## Records

- `AircraftOperatingProfile` carries a stable profile identifier, manufacturer,
  model, display name, and an `AirspeedOperatingLimits` record.
- `AirspeedOperatingLimits` carries `vsoKias`, `vsKias`, `vfeKias`, `vaKias`,
  `vnoKias`, and `vneKias`. Every value is knots indicated airspeed.

## Operations and bundled data

- `createAircraftOperatingProfile(input) -> AircraftOperatingProfile` validates and
  returns an immutable portable profile.
- `C172S_OPERATING_PROFILE` is the bundled Cessna 172S profile declared by the
  Component acceptance vectors.

Adding an optional aircraft field or another bundled profile is backward compatible.
Removing or renaming a required field, changing its units, weakening validation, or
changing an existing bundled limit is a breaking interface change.
