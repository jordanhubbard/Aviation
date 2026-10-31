---
namespace: aviation
version: 0.1.0
display_name: Aviation alert lifecycle
profiles:
  - library
  - portable
sample: false
provides:
  - name: aviation.alerts
    version: 0.1.0
    interface:
      uri: interfaces/alerts.md
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
    uri: acceptance/alerts.md
source_dependencies: []
---
# Aviation alert lifecycle

This Component owns provider-neutral alert severity normalization and priority,
stable lifecycle ordering, acknowledgement reconciliation, and highest-active-severity
selection.

It does not own alert detection thresholds, identifiers, timestamps, messages, aural
policy, persistence, events, simulator state, or rendering. Applications and UI
adapters create alerts and retain those policies while delegating common lifecycle
semantics to this capability.

The public surface is defined by `interfaces/alerts.md`. Every realization must pass
`acceptance/alerts.md` against `acceptance/vectors.json` without network access.

### Requirement: Severity is portable and fail closed

Canonical severity values SHALL be `normal`, `advisory`, `caution`, and `warning`, in
ascending priority. The application aliases `ok` and `debug` SHALL normalize to
`normal`, `info` SHALL normalize to `advisory`, and `critical` SHALL normalize to
`warning`. Unknown or empty values SHALL be rejected rather than silently downgraded.

#### Scenario: An application supplies its legacy informational level

- **WHEN** the input severity is `info`
- **THEN** normalization returns `advisory`
- **AND** the original application record is not mutated

#### Scenario: Flight Planner supplies an extended endpoint severity

- **WHEN** its adapter supplies `critical` or `debug`
- **THEN** normalization returns `warning` or `normal`, respectively
- **AND** Flight Planner may retain its private critical-before-warning tie-break

### Requirement: Lifecycle results are deterministic

Unacknowledged alerts SHALL precede acknowledged alerts, then severity SHALL descend,
then source order SHALL be retained. Acknowledgements for no-longer-active identifiers
SHALL be removed while retained identifiers preserve first occurrence order.

#### Scenario: An acknowledged warning and an active caution coexist

- **WHEN** lifecycle ordering is evaluated
- **THEN** the unacknowledged caution precedes the acknowledged warning
- **AND** equal-state, equal-severity alerts retain source order

### Requirement: Application policy remains outside the portable contract

Threshold evaluation, message formatting, acknowledgement eligibility, storage,
events, timestamps, sounds, and visibility limits SHALL remain adapter behavior.

#### Scenario: G1000 derives an overspeed alert

- **WHEN** its private telemetry policy creates that alert
- **THEN** the common lifecycle may order and summarize it
- **AND** the airspeed threshold and display text remain application-private
