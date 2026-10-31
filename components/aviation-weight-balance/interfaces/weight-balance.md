# Aviation weight and balance interface

`aviation.weight-balance` is a pure, side-effect-free capability using pounds, inches
from datum, pound-inches, and US gallons.

| Operation | Inputs | Result |
| --- | --- | --- |
| Envelope interpolation | ordered or unordered weight/forward/aft rows and weight | forward/aft limits, or no limits outside a valid envelope |
| Loading calculation | empty aircraft, maximum gross, fuel arm/density, named station arms, station weights, takeoff fuel, planned burn, envelope | takeoff and landing weight, CG, limits, problems, and within-limits state |

Envelope interpolation is linear between adjacent rows. A condition is within limits
only when its weight does not exceed maximum gross, its weight is represented by the
entered envelope, and its CG lies inclusively between the interpolated limits.

Invalid input produces a typed failure. An out-of-envelope weight is a valid calculated
condition with absent limits and an explicit problem; it is not silently clamped.

Adding an operation is backward compatible. Removing or renaming an operation,
changing units or interpolation semantics, or widening accepted invalid input is a
breaking interface change.
