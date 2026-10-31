# Aviation hazard acceptance contract

An independent oracle loads `vectors.json` and evaluates every case against both SDK
language bindings. Acceptance performs no network access and requires no provider
credentials.

## Requirement: Normalization agrees

- Valid provider-neutral records are canonicalized without mutating their inputs.
- Missing identity, invalid coordinates, degenerate polygons, invalid instants, and
  inverted time or altitude ranges fail with the declared stable error code.

## Requirement: Evaluation agrees

- Severity, inclusive effective windows, and inclusive altitude overlap produce the
  declared results in both bindings.
- Point containment includes polygon boundaries.
- Leg intersection detects endpoint containment, polygon edge crossing even when the
  midpoint is outside, boundary contact, and exact point-on-leg contact.

## Requirement: Route ordering agrees

- Explicit-band route evaluation returns leg-major, input-hazard order and does not
  mutate waypoints or hazards.

## Requirement: Common SDK CI runs

- Changes to this Component, its vectors, either binding, package metadata, or the SDK
  workflow run hazard conformance independently of application tests.
