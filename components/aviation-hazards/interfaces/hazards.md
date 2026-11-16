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

## Additive interval operations

`segmentGeometryIntervals(start, end, geometry)` takes bounded `{lat, lon}` endpoints
and a provider-neutral GeoJSON Point, MultiPoint, LineString, MultiLineString,
Polygon, MultiPolygon or GeometryCollection (WGS84 `[lon,lat]` coordinates). It returns
sorted, disjoint, inclusive `[entryFraction, exitFraction]` pairs in [0,1], merging
contacting intervals. Holes remain excluded except their boundaries, which are contacts.
The caller supplies valid simple polygon topology. Coordinate boundary tolerance is
1e-10 degrees; orientation tests scale with segment length so small holes and
off-leg polygons are not collapsed by an absolute determinant tolerance. Malformed coordinates/rings,
unsupported geometry and excessive nesting/coordinate counts fail with
`hazard-geometry-invalid`; endpoint coordinates use `hazard-coordinate-invalid`.
Longitudes are unwrapped along the shortest arc relative to the leg; a leg whose
longitude change is exactly 180 degrees is ambiguous and rejected. This is planar
clipping of already constructed segments, not a geodesic intersection approximation
chosen by the Component. Maximum recursion depth is 16, geometry node count is 50,000 and coordinate count is 50,000.

`linearConstraintInterval(start, end, lower, upper)` returns the inclusive parameter
interval where the linearly interpolated finite value lies inside the finite or
explicitly null/unbounded limits, or null for no overlap. Inverted/nonfinite limits
or values fail with `hazard-constraint-invalid`. No pressure/AGL/MSL conversion or
provider time interpretation occurs here. Time can be supplied as numeric epoch seconds.

Python exposes `segment_geometry_intervals` and `linear_constraint_interval` with
the same semantics and list-of-pairs / optional-pair JSON representation.

`segmentsGeometryIntervals(segments, geometry)` / Python `segments_geometry_intervals` accepts 1–1000 pairs of endpoint coordinates and returns interval lists in matching order, exactly as independent segment operations. One call may reuse validated coordinate sequences for the same longitude unwrap across segments. Reuse is local to that call, never stale across calls or source mutation, and retains each segment's coordinate/node/depth limits. Invalid segment batches fail with `hazard-segments-invalid`; any endpoint or geometry failure rejects the batch. Input objects remain unchanged. Conformance covers repeated/reversed segments and changing dateline anchors, invalid batches and limits.
