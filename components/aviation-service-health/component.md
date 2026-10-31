---
namespace: aviation
version: 0.1.0
display_name: Aviation service health
profiles:
  - library
  - portable
sample: false
provides:
  - name: aviation.service.health
    version: 0.1.0
    interface:
      uri: interfaces/health.md
      pin: null
requires: []
authoring_inputs:
  - kind: specification-to-source-skill
    uri: skills/specification-to-source/portable-application-implementation/SKILL.md
  - kind: specification-to-source-skill
    uri: skills/specification-to-source/portable-specification-planning/SKILL.md
workflow_definition:
  uri: workflows/production/staging/dev/workflow.md
routing_policy:
  uri: routing/production/staging/dev/routing.json
flavor_slots: []
entrypoints: []
acceptance_contracts:
  - kind: acceptance-contract
    uri: acceptance/health.md
source_dependencies: []
---
# Aviation service health

This Component owns portable service-health status normalization and deterministic
health-report construction. It gives independently deployed Aviation applications one
small, stable contract while allowing each application to retain its own operational
details.

It does not own HTTP routes or status codes, clocks, dependency probes, startup
policy, scheduler state, Kubernetes or Railway configuration, logging, metrics, or
readiness/liveness decisions. Those remain application and deployment adapter policy.

The public surface is defined by `interfaces/health.md`. Every realization must pass
`acceptance/health.md` against `acceptance/vectors.json` without network access.

### Requirement: Status vocabulary is portable and fail closed

Canonical status values SHALL be `ok`, `degraded`, and `unavailable`. Common legacy
aliases SHALL normalize deterministically. Unknown and empty statuses SHALL be
rejected rather than reported as healthy.

#### Scenario: A legacy service reports healthy

- **WHEN** the input status is `healthy`
- **THEN** normalization returns `ok`

### Requirement: Common reports preserve adapter-owned details

Reports SHALL contain a canonical `status`, an optional normalized `service`, and a
shallow copy of adapter-owned detail fields. Detail fields SHALL NOT replace the
reserved `status` or `service` keys.

#### Scenario: Flight Planner exposes startup configuration issues

- **WHEN** its adapter builds a report with `startup_issues`
- **THEN** the field is retained unchanged
- **AND** the common status and optional service identity remain authoritative

### Requirement: Operational probing remains outside the portable contract

The common contract SHALL NOT contact dependencies or infer readiness from timestamps,
schedulers, databases, weather providers, or AI services.

#### Scenario: Accident Tracker publishes scheduler state

- **WHEN** its health adapter includes the last ingestion result
- **THEN** the scheduler payload remains application-owned detail
- **AND** the Component performs no scheduler or dependency probe
