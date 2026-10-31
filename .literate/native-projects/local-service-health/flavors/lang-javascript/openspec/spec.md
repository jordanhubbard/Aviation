# Javascript implementation Flavor

## ADDED Requirements

### Requirement: language-binding Flavor proposal [flavor-statement:observation:language-javascript:c4abdda38014e97b61cc]

The javascript binding at src/index.js declares HealthReportError, createHealthReport, normalizeHealthStatus.

#### Scenario: Target-specific source behavior

- **WHEN** the Flavor is selected
- **THEN** The javascript binding at src/index.js declares HealthReportError, createHealthReport, normalizeHealthStatus.

### Requirement: public-api Flavor proposal [flavor-statement:observation:api-surface:4890d3d9b0083cd871b2]

The binding declares the public symbol HealthReportError.

#### Scenario: Target-specific source behavior

- **WHEN** the Flavor is selected
- **THEN** The binding declares the public symbol HealthReportError.

### Requirement: public-api Flavor proposal [flavor-statement:observation:api-surface:0608c7b4960e7eeb98d8]

The binding declares the public symbol createHealthReport.

#### Scenario: Target-specific source behavior

- **WHEN** the Flavor is selected
- **THEN** The binding declares the public symbol createHealthReport.

### Requirement: public-api Flavor proposal [flavor-statement:observation:api-surface:017d86da5f32fe8baefe]

The binding declares the public symbol normalizeHealthStatus.

#### Scenario: Target-specific source behavior

- **WHEN** the Flavor is selected
- **THEN** The binding declares the public symbol normalizeHealthStatus.

### Requirement: language-binding Flavor proposal [flavor-statement:observation:language-javascript:8c2c2b94ad6b5c6fc06d]

The javascript binding at tests/service-health.test.js declares no statically public symbols.

#### Scenario: Target-specific source behavior

- **WHEN** the Flavor is selected
- **THEN** The javascript binding at tests/service-health.test.js declares no statically public symbols.
