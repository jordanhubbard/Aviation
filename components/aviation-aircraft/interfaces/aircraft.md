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
- `AircraftTypeDesignatorRecord` carries a supported code and the bundled
  manufacturer, model, and broad application category attached to that snapshot entry.

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
- `isSupportedAircraftTypeDesignator(code) -> boolean` tests case-insensitive
  membership in the qualified bundled snapshot.
- `findAircraftTypeDesignator(code) -> AircraftTypeDesignatorRecord | none` returns
  detailed metadata when the snapshot contains it. Additional-only codes remain
  supported but intentionally have no invented metadata.
- `suggestAircraftTypeDesignators(code, maximum) -> code[]` returns deterministic
  prefix-first suggestions.
- `aircraftTypeDesignatorsByManufacturer(manufacturer) -> code[]` returns sorted exact
  case-insensitive manufacturer matches.
- `aircraftTypeDesignatorCatalogSummary() -> summary` reports detailed, additional,
  category, and manufacturer counts.
- `aircraftTypeDesignatorValidationMessage(code) -> string` points unknown codes to
  ICAO's official Doc 8643 search.
- Python exposes the same operations in `snake_case`.

The bundled snapshot is an offline application-support catalog, not an exhaustive or
current assertion of ICAO validity. Consumers requiring authoritative current status
must consult ICAO Doc 8643.

Adding an optional aircraft field, another bundled profile, or a qualified designator
is backward compatible.
Removing or renaming a required field, changing its units, weakening validation, or
changing an existing bundled value without correcting its cited authority is a breaking
interface change.
