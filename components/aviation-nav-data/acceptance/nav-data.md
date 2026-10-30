# Aviation navigation-data acceptance contract

An independent oracle loads `vectors.json` and runs every synthetic case against each
required binding. Acceptance never downloads operational navigation data.

## Requirement: Records normalize consistently

### Scenario: Provider casing and whitespace vary

- **WHEN** the synthetic navaid and procedure records are ingested
- **THEN** every binding returns the declared canonical records

## Requirement: Catalog query agrees

### Scenario: A navaid is searched by name

- **WHEN** a case-insensitive substring query is evaluated
- **THEN** every binding returns the same identifiers in stable ingestion order

### Scenario: Procedures are selected by airport, type, and runway

- **WHEN** a filtered procedure query is evaluated
- **THEN** every binding returns the same procedure identifiers

## Requirement: Provenance freshness agrees

### Scenario: Effective dates bracket the reference time

- **WHEN** current, expired, future, and undated metadata are classified
- **THEN** every binding returns the declared status

## Requirement: Airspace ingestion agrees

### Scenario: A collection contains valid and malformed features

- **WHEN** it is normalized
- **THEN** only valid GeoJSON Features with geometry and properties remain

## Requirement: Common SDK CI runs

### Scenario: Authority or a realization changes

- **WHEN** this Component, its vectors, a binding, package metadata, or the SDK workflow
  changes
- **THEN** the TypeScript and Python conformance adapters run independently

## Requirement: Provider adapters converge on the SDK

The TypeScript provider adapter suite SHALL load `provider-adapters.json` without
network access and pass its result through the common airport and navigation-data
normalizers and catalog.

### Scenario: Provider formats are ingested together

- **WHEN** the synthetic OurAirports, openAIP, and CIFP fixtures are adapted
- **THEN** their declared records, combined provenance, and common catalog query match
  the vector and no duplicate database/search exports exist
