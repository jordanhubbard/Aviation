# Aviation navigation interface

`aviation.navigation` is a pure, side-effect-free capability. A binding may expose
idiomatic function names, but it must map the following semantic operations without
changing units or conventions.

| Operation family | Required semantic operations |
| --- | --- |
| Coordinates | validate latitude/longitude, normalize longitude, DMS conversion |
| Geodesy | great-circle distance, initial/final bearing, midpoint, destination |
| Headings | normalize, reciprocal, true/magnetic conversion, shortest difference |
| Wind | correction angle, corrected heading, ground speed, head/crosswind components |
| Time/speed/distance | solve any missing value from the other two; format duration |
| Fuel | consumption, flight fuel, range/endurance, configurable and VFR/IFR reserve, mass/volume |
| Performance altitude | pressure altitude, ISA temperature, density altitude |

## Value contract

- A coordinate is WGS-84 decimal degrees with latitude in `[-90, 90]` and longitude in
  `[-180, 180]` before calculation.
- A bearing or heading result is in `[0, 360)` degrees clockwise from true north.
- Wind direction is the direction the wind comes from. A positive headwind opposes the
  selected course; crosswind sign must be documented consistently by each binding.
- Fuel reserve operations calculate quantity only. Aircraft-specific legal dispatch
  decisions and unusable fuel are outside this capability.
- A configurable reserve accepts fuel flow in gallons per hour and reserve duration in
  minutes and returns gallons; both inputs must be finite and non-negative.
- Fuel-range inputs must be finite and non-negative, burn and speed must be positive,
  and reserve fuel must not exceed total fuel.
- Results are finite numbers. Failure is explicit and distinguishable from a numeric
  result; a successful `NaN`, infinity, or implicit clamping is forbidden.

## Compatibility

Adding an operation is backward compatible. Removing or renaming an operation, changing
its units/conventions, changing a result shape, or widening accepted invalid input is a
breaking interface change requiring a new major capability version.
