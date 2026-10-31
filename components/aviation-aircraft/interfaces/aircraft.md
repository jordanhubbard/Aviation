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
  rate in feet per minute, service ceiling and takeoff/landing distance in feet. These
  are published reference figures, not aircraft-specific performance calculations.

## Operations and bundled data

- `createAircraftOperatingProfile(input) -> AircraftOperatingProfile` validates and
  returns an immutable portable profile.
- `findAircraftOperatingProfile(identifier) -> AircraftOperatingProfile | none`
  resolves a bundled profile by stable profile ID or case-insensitive ICAO designator.
- `C172S_OPERATING_PROFILE` is the bundled Cessna 172S profile declared by the
  Component acceptance vectors.

Adding an optional aircraft field or another bundled profile is backward compatible.
Removing or renaming a required field, changing its units, weakening validation, or
changing an existing bundled value without correcting its cited authority is a breaking
interface change.
