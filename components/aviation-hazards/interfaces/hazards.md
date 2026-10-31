# `aviation.hazards` interface

## Canonical record

- `id`: required canonical identifier.
- `kind`: `SIGMET`, `AIRMET`, or `TFR`.
- `subType`: required canonical subtype.
- `summary`: required trimmed display summary.
- `geometry`: a bounded point or a polygon with at least three distinct bounded
  vertices. A repeated closing polygon vertex is removed during normalization.
- `altitudeBandFt`: nullable floor and ceiling in feet MSL; values are finite,
  non-negative, and non-inverted when both are present.
- `validFrom` and `validTo`: valid timezone-qualified ISO-8601 instants with an
  inclusive, non-inverted window.
- `severity`: derived `advisory`, `watch`, `warning`, or `emergency` value.
- `rawText` and `sourceUrl`: optional trimmed provenance fields.

Python exposes the same record as `Hazard` with snake-case field names.

## Operations

- `normalizeHazardRecord(input)`: validate and canonicalize a provider-neutral input,
  deriving severity without mutating the input.
- `deriveSeverity(kind, subType)`: apply stable kind/subtype severity rules.
- `isHazardActive(record, instant)`: test the inclusive effective window.
- `altitudeOverlaps(record, routeFloorFt, routeCeilingFt)`: test inclusive altitude
  overlap, treating a null floor as surface and a null ceiling as FL600.
- `pointInPolygon(point, polygon)`: test planar containment, including the boundary.
- `hazardIntersectsLeg(...)`: require active time and altitude overlap, then test a
  point on the leg or any polygon containment/edge contact exactly in planar space.
- `findRouteHazardsInBand(waypoints, floor, ceiling, hazards, instant)`: return hits
  in leg-major, input-hazard order.
- `findRouteHazards(waypoints, cruiseAltitude, hazards, instant)`: compatibility
  wrapper using a cruise band of plus or minus 500 feet.

Provider clients MAY expose idiomatic adapters around these operations. Changing
validation, boundary inclusion, severity rules, geometry intersection, or result
ordering is a breaking interface change.
