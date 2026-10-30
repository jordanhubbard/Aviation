# Aviation airports acceptance contract

An independent oracle loads `vectors.json`, normalizes its synthetic dataset, and runs
every vector against each required binding. No acceptance case depends on the large
retained cache or an external provider.

## Requirement: Normalization is deterministic

### Scenario: Invalid records are omitted

- **WHEN** records lack an ICAO identity or contain out-of-range coordinates
- **THEN** every binding reports the same valid record count

## Requirement: Identity and missing values agree

### Scenario: IATA lookup preserves elevation

- **WHEN** the lowercase IATA code `alp` is looked up
- **THEN** `KAAA` is returned with its 100-foot MSL elevation

### Scenario: Missing elevation remains missing

- **WHEN** `KBBB` is looked up
- **THEN** its elevation is represented as absent, not zero

## Requirement: Search and proximity agree

### Scenario: Exact code ranks first

- **WHEN** text search receives `KBBB`
- **THEN** `KBBB` is the first result

### Scenario: Nearby airports are sorted in nautical miles

- **WHEN** the origin is `(0, 0)` with a 65-nautical-mile radius
- **THEN** `KAAA` precedes `KBBB` and their distances match the shared tolerances

## Requirement: Common SDK CI runs

### Scenario: Airport authority or a realization changes

- **WHEN** this Component, its vectors, a binding, package metadata, or the SDK workflow
  changes
- **THEN** the TypeScript and Python conformance adapters run independently
