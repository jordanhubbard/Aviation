# Typescript implementation Flavor

## ADDED Requirements

### Requirement: language-binding Flavor proposal [flavor-statement:observation:language-javascript:48b71d3bdf083e90449f]

The typescript binding at src/index.d.ts declares HealthReportError, HealthReportOptions, createHealthReport, normalizeHealthStatus.

#### Scenario: Target-specific source behavior

- **WHEN** the Flavor is selected
- **THEN** The typescript binding at src/index.d.ts declares HealthReportError, HealthReportOptions, createHealthReport, normalizeHealthStatus.

### Requirement: public-api Flavor proposal [flavor-statement:observation:api-surface:d504e6aab452e2eff1f1]

The binding declares the public symbol HealthReportError.

#### Scenario: Target-specific source behavior

- **WHEN** the Flavor is selected
- **THEN** The binding declares the public symbol HealthReportError.

### Requirement: public-api Flavor proposal [flavor-statement:observation:api-surface:d334fad757f24aec4370]

The binding declares the public symbol HealthReportOptions.

#### Scenario: Target-specific source behavior

- **WHEN** the Flavor is selected
- **THEN** The binding declares the public symbol HealthReportOptions.

### Requirement: public-api Flavor proposal [flavor-statement:observation:api-surface:cc470450ad759be74d91]

The binding declares the public symbol createHealthReport.

#### Scenario: Target-specific source behavior

- **WHEN** the Flavor is selected
- **THEN** The binding declares the public symbol createHealthReport.

### Requirement: public-api Flavor proposal [flavor-statement:observation:api-surface:cb360ec0ae3b92c563e7]

The binding declares the public symbol normalizeHealthStatus.

#### Scenario: Target-specific source behavior

- **WHEN** the Flavor is selected
- **THEN** The binding declares the public symbol normalizeHealthStatus.
