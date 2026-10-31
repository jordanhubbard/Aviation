# Public interface: aviation.service.health

## ADDED Requirements

### Requirement: aviation.service.health

Provide a portable JavaScript and TypeScript library for deterministic service-health semantics. Export the runtime symbols HealthReportError, createHealthReport, and normalizeHealthStatus and the TypeScript types HealthReport, HealthReportOptions, and HealthStatus. normalizeHealthStatus accepts an unknown value, treats only strings as candidates, trims ECMAScript whitespace, applies JavaScript toLowerCase, and maps ok, healthy, and up to ok; degraded and warning to degraded; and unavailable, unhealthy, and down to unavailable. Empty, non-string, or otherwise unsupported values throw HealthReportError with code health-status-invalid. createHealthReport accepts an optional options object and defaults omitted status to ok. If service is supplied, it must be a string whose trimmed value is nonempty; otherwise throw health-service-invalid, and return the trimmed value when valid. Details default to an empty object and are shallow-copied without interpretation. Own detail keys status or service throw health-details-invalid. The options object, details object, and nested detail values are never mutated. The returned report is a fresh mapping containing canonical status, optional service, and all detail fields. The library performs no network access, probing, clock access, readiness inference, routing, logging, or deployment policy. Supply a package.json whose built package is loadable from its package root by Node.js, plus deterministic unit tests for every pinned qualification case. The generated JavaScript package must be named aviation-service-health and must declare the exact public package subpath ./index, mapped to an importable CommonJS module that exports HealthReportError, createHealthReport, and normalizeHealthStatus; its adjacent TypeScript declaration must export HealthReport, HealthReportOptions, and HealthStatus as well. The package exports map must contain exactly the ./index public subpath and no undeclared symbol subpaths or other public entries. Concretely, package.json exports must equal the JSON object {"./index":"./index.js"}; use the top-level types field for ./index.d.ts and do not use a conditional export object.

#### Scenario: Preserve the reviewed public contract

- **WHEN** a consumer uses this capability
- **THEN** the implementation satisfies the reviewed contract

Evidence: `evidence:cae7c666727283f10581`, `evidence:efab8627be18cddb1df1`, `evidence:fedf05b0b693854eecd8`
