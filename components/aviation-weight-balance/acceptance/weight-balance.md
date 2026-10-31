# Aviation weight and balance acceptance contract

An independent oracle loads `vectors.json` and exercises every represented operation
against the common realization.

## Requirement: Envelope interpolation is deterministic

### Scenario: Weight lies between two rows

- **WHEN** a valid weight lies between envelope rows
- **THEN** forward and aft limits are linearly interpolated from those rows

### Scenario: Weight is outside the envelope

- **WHEN** a weight lies below the first row or above the last row
- **THEN** the operation returns no limits rather than clamping to an endpoint

## Requirement: Flight conditions share one loading model

### Scenario: Fuel is burned in flight

- **WHEN** planned burn does not exceed takeoff fuel
- **THEN** takeoff and landing conditions use the same empty aircraft and station
  moments with their respective fuel quantities

## Requirement: Invalid input fails closed

### Scenario: Envelope rows are malformed

- **WHEN** an envelope has fewer than two rows, repeated weights, non-finite values,
  or a forward limit aft of its aft limit
- **THEN** the operation reports failure rather than treating the envelope as absent

### Scenario: Planned burn exceeds loaded fuel

- **WHEN** planned fuel burn is greater than takeoff fuel
- **THEN** the operation reports failure and returns no loading result

## Requirement: Bundled loading profiles are qualified

### Scenario: C172S loading data is requested

- **WHEN** the bundled profile is requested by profile ID or linked aircraft-profile ID
- **THEN** its identity, sample empty record, station arms, baggage limits, fuel data, and
  normal-category envelope match the Component vector

### Scenario: An aircraft link or profile structure is invalid

- **WHEN** a declared invalid profile mutation is applied
- **THEN** construction fails before the profile reaches an application

## Requirement: Loading limits remain visible

### Scenario: Fuel, a station, or a station group exceeds its profile limit

- **WHEN** the calculator receives an otherwise valid load above that limit
- **THEN** it returns a specific problem and marks the condition outside limits
