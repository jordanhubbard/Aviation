# Aviation weather acceptance contract

An independent oracle loads `vectors.json` and runs every synthetic case against each
required binding. Acceptance never contacts an external weather provider.

## Requirement: METAR parsing agrees

### Scenario: Common observation fields are normalized

- **WHEN** a METAR contains gusting wind, fractional visibility, temperature, and
  multiple ceiling layers
- **THEN** every binding returns the same normalized fields and lowest ceiling

### Scenario: Variable wind remains directionless

- **WHEN** a METAR reports `VRB`
- **THEN** direction is absent while speed is retained

## Requirement: Categories and warnings agree

### Scenario: Threshold boundaries are stable

- **WHEN** the shared visibility and ceiling cases are classified
- **THEN** every binding returns the declared category

### Scenario: Operational warnings are deterministic

- **WHEN** visibility, ceiling, and wind cross warning thresholds
- **THEN** every binding returns identical warning text in identical order

## Requirement: Provider normalization agrees

### Scenario: OpenWeatherMap data is converted

- **WHEN** a synthetic provider payload is normalized
- **THEN** units, rounding, airport identity, conditions, and missing METAR agree

## Requirement: AWC JSON acquisition preserves product fidelity

Shared vectors SHALL independently cover all six exact product/parameter plans,
normalization, forty-station compatibility, unknown/missing keys, invalid products,
station syntax and numeric boundaries. Invalid requests SHALL invoke no transport.
Populated, empty and nested/null/unknown-field report vectors SHALL preserve all
records and ordering. Non-list and non-record responses SHALL fail; transport
failure SHALL invoke once without retry and expose no transport error detail.
Application integration SHALL preserve source/status envelopes, full raw TAFs and
mixed route-batch failures. Existing raw-METAR cache/fallback tests SHALL still pass.

## Requirement: Pressure-level provider semantics agree

Independent shared vectors SHALL cover all eight pressure levels, first-occurrence
deduplication, exact variable/request ordering, numeric/boolean/range failures,
aligned raw results including nulls and unknown fields, every unit mismatch,
missing/misaligned arrays, empty/oversized time arrays and bad UTC offsets.
Supplemental binding checks SHALL reject nonfinite/huge numbers before transport.
One-call transport failures SHALL not retry or retain private exception details.
Application integration SHALL use actual integer enum levels, preserve cache
equivalence/envelopes and exercise existing timeout/post-download byte bounds.

## Requirement: Common SDK CI runs

### Scenario: Weather authority or a realization changes

- **WHEN** this Component, its vectors, a binding, package metadata, or the SDK workflow
  changes
- **THEN** the TypeScript and Python conformance adapters run independently
