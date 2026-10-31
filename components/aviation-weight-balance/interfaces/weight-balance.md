# Aviation weight and balance interface

`aviation.weight-balance` is a pure, side-effect-free capability using pounds, inches
from datum, pound-inches, and US gallons.

| Operation | Inputs | Result |
| --- | --- | --- |
| Loading-profile lookup | loading-profile ID or linked aircraft-profile ID | immutable qualified profile, or no match |
| Loading-profile validation | profile and linked `aviation.aircraft` record | immutable profile or typed failure |
| Envelope interpolation | ordered or unordered weight/forward/aft rows and weight | forward/aft limits, or no limits outside a valid envelope |
| Loading calculation | empty aircraft, maximum gross, fuel arm/density, named station arms, station weights, takeoff fuel, planned burn, envelope | takeoff and landing weight, CG, limits, problems, and within-limits state |

Envelope interpolation is linear between adjacent rows. A condition is within limits
only when its weight does not exceed maximum gross, its weight is represented by the
entered envelope, and its CG lies inclusively between the interpolated limits.

Invalid input produces a typed failure. An out-of-envelope weight is a valid calculated
condition with absent limits and an explicit problem; it is not silently clamped.

A loading profile contains stable profile and aircraft-profile IDs, display name, sample
empty weight and moment, maximum gross weight, usable fuel capacity, fuel arm and density,
ordered station definitions, optional station and group limits, and an envelope. Bundled
profile weight and fuel limits must agree with the linked `aviation.aircraft` record.
Exceeding usable fuel, station, group, maximum gross, or CG limits yields an explicit
calculated problem. Empty-aircraft values remain replaceable airframe-specific inputs.

Adding an operation is backward compatible. Removing or renaming an operation,
changing units, profile-link or interpolation semantics, or widening accepted invalid
input is a breaking interface change.
