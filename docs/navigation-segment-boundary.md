# Route-segment navigation boundary

Owning work: [Aviation #442](https://github.com/jordanhubbard/Aviation/issues/442).
This is a retained realization increment. Native importer acceptance, a complete
application duplication inventory and wrapper retirement remain separate gates.

`aviation.navigation` 0.4.0 owns nearest-point projection onto a finite minor
great-circle segment. The shared SDK 0.11.0 exposes
`projectPointToSegmentNM` (TypeScript) and `project_point_to_segment_nm` (Python).
Inputs identify the query point, segment start and segment end, each as WGS-84
latitude/longitude. Results supply distance from the segment and clamped
along-segment progress in nautical miles.

Flight Planner's route-weather matching delegates spherical projection and
ambiguous-arc validation to this capability. It retains leg iteration, cumulative
route progress, `(distance, progress, leg index)` ordering, requested-airport
retention, station limits and source/forecast handling. API response shapes and
station-selection policy are unchanged.

The Component's independent acceptance adds 31 shared vectors: equatorial interior,
nearest endpoints, zero length, anti-meridian, reversed and polar arcs, invalid
coordinates, ambiguous antipodal segments and valid query points antipodal to an
endpoint of an unambiguous segment. Equatorial/polar expected values use closed-form
angles; endpoint-antipode expectations use independent three-dimensional cross/dot
angles and their supplementary distances. Both language adapters also reject every
non-finite coordinate position. Packaged vectors must match Component authority.
Existing route-weather HTTP/source tests retain their dateline, polar, bent-route,
zero-length, batching, missing-report, provenance and partial-result coverage.

Independent review found internal haversine roundoff above one for a valid
antipodal query point. Both common distance implementations now clamp that internal
intermediate after coordinate validation. This preserves invalid-input rejection
and lets the segment primitive handle the valid point. It does not allow an
ambiguous antipodal segment.

The [promoted-Component matrix](../verification/qualifications/promoted-components-20261116.json)
remains a historical baseline, including the previous navigation contract. Current
source, lock, test, retained receipt and exact-commit CI evidence belong to #442 and
the pull request for this increment; the earlier baseline does not qualify these
new operations by itself.
