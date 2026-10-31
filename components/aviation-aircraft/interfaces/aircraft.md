# `aviation.aircraft` interface

## Records

- `AircraftOperatingProfile` carries a stable profile identifier, manufacturer,
  model, display name, ICAO type designator, and unit-explicit operating records.
- `AirspeedOperatingLimits` carries `vsoKias`, `vsKias`, `vfeKias`, `vaKias`,
  `vnoKias`, and `vneKias`. Every value is knots indicated airspeed.
- `AircraftFuelLimits` carries total and usable capacity in U.S. gallons.
- `AircraftWeightLimits` carries maximum takeoff weight in pounds.
- `AircraftDimensions` carries length, height, and wingspan in feet.
- `AircraftReferencePerformance` carries maximum cruise speed in KTAS, maximum climb
  rate in feet per minute, service ceiling, takeoff and landing ground roll, and
  takeoff and landing distance over a 50-foot obstacle in feet. These are published
  sea-level reference figures, not aircraft-specific performance calculations.

## Operations and bundled data

- `createAircraftOperatingProfile(input) -> AircraftOperatingProfile` validates and
  returns an immutable portable profile.
- `findAircraftOperatingProfile(identifier) -> AircraftOperatingProfile | none`
  resolves a bundled profile by stable profile ID or case-insensitive ICAO designator.
- `matchAircraftOperatingProfile(manufacturer, model) -> AircraftOperatingProfile |
  none` resolves an exact manufacturer/model pair after case and repeated-whitespace
  normalization. Both fields are required; partial, model-only, and unknown matches
  return no profile.
- `C172S_OPERATING_PROFILE` is the bundled Cessna 172S profile declared by the
  Component acceptance vectors.
- `C182T_OPERATING_PROFILE` is the bundled Cessna 182T NAV III profile.
- `SR22_PERSPECTIVE_3600_OPERATING_PROFILE` is the bundled Cirrus SR22 Perspective
  3,600-pound profile.

Adding an optional aircraft field or another bundled profile is backward compatible.
Removing or renaming a required field, changing its units, weakening validation, or
changing an existing bundled value without correcting its cited authority is a breaking
interface change.
