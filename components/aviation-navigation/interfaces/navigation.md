# Aviation navigation interface

`aviation.navigation` is a pure, side-effect-free capability. A binding may expose
idiomatic function names, but it must map the following semantic operations without
changing units or conventions.

| Operation family | Required semantic operations |
| --- | --- |
| Coordinates | validate latitude/longitude, normalize longitude, DMS conversion, reversible local tangent-plane projection |
| Geodesy | great-circle distance, initial/final bearing, midpoint, destination |
| Headings | normalize, reciprocal, true/magnetic conversion, shortest signed difference, weighted circular mean, runway designator |
| Wind | correction angle, corrected heading, ground speed, head/crosswind components from wind-from direction/speed or east/north wind velocity |
| Time/speed/distance | solve any missing value from the other two; format duration; planning IAS/TAS and ISA Mach conversion |
| Fuel | consumption, flight fuel, range/endurance, configurable and VFR/IFR reserve, mass/volume |
| Performance altitude | pressure altitude, ISA temperature, density altitude |

## Value contract

- A coordinate is WGS-84 decimal degrees with latitude in `[-90, 90]` and longitude in
  `[-180, 180]` before calculation.
- A bearing or heading result is in `[0, 360)` degrees clockwise from true north.
  A shortest signed heading difference is in `[-180, 180)`, with an exact half-turn
  represented as `-180`. Circular means reject empty, zero-weight, non-finite, or
  directionally ambiguous samples. Runway designators round headings to the nearest
  ten degrees using half-up ties and return `01` through `36`.
- Local tangent-plane coordinates use metres east/north of a valid WGS-84 origin and
  the WGS-84 semi-major axis of 6,378,137 metres. The origin cannot be a pole. The
  inverse operation normalizes longitude and rejects results outside the latitude
  domain. This is a local equirectangular projection, not a replacement for geodesic
  distance over long routes.
- Wind direction is the direction the wind comes from. A positive headwind opposes the
  selected course; a positive crosswind comes from the right of the selected course.
  East/north wind-vector inputs describe the direction toward which the air mass moves,
  using the same speed unit as the returned components.
  True airspeed must be positive and wind speed non-negative. A wind triangle fails
  when the requested course cannot be maintained or positive along-course progress is
  impossible.
- Fuel reserve operations calculate quantity only. Aircraft-specific legal dispatch
  decisions and unusable fuel are outside this capability.
- A configurable reserve accepts fuel flow in gallons per hour and reserve duration in
  minutes and returns gallons; both inputs must be finite and non-negative.
- Fuel-range inputs must be finite and non-negative, burn and speed must be positive,
  and reserve fuel must not exceed total fuel.
- Performance-altitude inputs must be finite; an altimeter setting must be positive.
  Altitudes use feet, pressure uses inches of mercury, and temperature uses Celsius.
- Planning airspeed inputs use knots and pressure altitude in feet. IAS, TAS, and Mach
  must be finite and non-negative; outside-air temperature must be above absolute zero,
  and the requested altitude must remain inside the formula's positive-temperature
  domain. The IAS/TAS operation is a planning approximation, not a calibrated ADC.
- Results are finite numbers. Failure is explicit and distinguishable from a numeric
  result; a successful `NaN`, infinity, or implicit clamping is forbidden.

## Compatibility

Adding an operation is backward compatible. Removing or renaming an operation, changing
its units/conventions, changing a result shape, or widening accepted invalid input is a
breaking interface change requiring a new major capability version.
