# Aviation NOTAM acceptance contract

An independent oracle loads `vectors.json` and evaluates every case against both SDK
language bindings. Acceptance performs no network access and requires no provider
credentials.

## Requirement: Normalization agrees

### Scenario: Provider-neutral records are canonicalized

- **WHEN** each valid vector is normalized
- **THEN** both bindings return the declared identity, ISO instants, classification,
  text, severity, and category
- **AND** neither binding mutates the supplied input

### Scenario: Required data or time ordering is invalid

- **WHEN** a record is missing required data, contains an invalid instant, or ends
  before it starts
- **THEN** normalization rejects it with the declared stable error code

## Requirement: Classification and formatting agree

### Scenario: Notice text is evaluated

- **WHEN** severity/category and formatting vectors are evaluated
- **THEN** every binding returns the declared values with identical precedence

## Requirement: Filtering and sorting agree

### Scenario: Route relevance is evaluated at an explicit instant

- **WHEN** the shared record set is filtered and sorted
- **THEN** both bindings agree on inclusive time boundaries, optional en-route
  inclusion, stable ingestion order, and critical-to-low severity order

## Requirement: Common SDK CI runs

### Scenario: Authority or realization changes

- **WHEN** this Component, its vectors, either binding, package metadata, or the SDK
  workflow changes
- **THEN** NOTAM conformance runs independently of Weather Briefing tests
