---
namespace: aviation
version: 0.1.0
display_name: Aviation service lifecycle
profiles:
  - library
  - portable
sample: false
provides:
  - name: aviation.service.lifecycle
    version: 0.1.0
    interface:
      uri: interfaces/lifecycle.md
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
    uri: acceptance/lifecycle.md
source_dependencies: []
---
# Aviation service lifecycle

This Component owns provider-neutral state transitions for long-running Aviation
services. It gives SDK adapters a deterministic authority for start, stop, failure,
and recovery without coupling the contract to a runtime or framework.

It does not own asynchronous hooks, clocks or uptime, error messages, logging,
configuration, automatic startup, process signals, HTTP endpoints, ports, resource
cleanup, or scheduling. Those remain SDK and application adapter policy.

The public surface is defined by `interfaces/lifecycle.md`. Every realization must
pass `acceptance/lifecycle.md` against `acceptance/vectors.json` without network
access.

### Requirement: Lifecycle transitions are explicit

Services SHALL move through `starting` and `stopping` before reaching their stable
states. Hook failures SHALL produce `failed`; recovery SHALL require an explicit
reset.

#### Scenario: A service starts successfully

- **WHEN** `start_requested` is applied to `stopped`
- **AND** `start_succeeded` is applied to the result
- **THEN** the final state is `running`

### Requirement: Invalid transitions fail closed

Events that are not valid for the current state SHALL fail with
`service-lifecycle-transition-invalid` and SHALL NOT infer a replacement state.

#### Scenario: A running service is started again

- **WHEN** `start_requested` is applied to `running`
- **THEN** the transition fails with `service-lifecycle-transition-invalid`

### Requirement: Failure recovery is deliberate

A failed start or stop SHALL enter `failed`. Only `reset` SHALL return `failed` to
`stopped`; the portable contract SHALL NOT retry hooks or cleanup resources.

#### Scenario: Startup fails and an operator resets the service

- **WHEN** `start_failed` is applied to `starting`
- **AND** `reset` is applied to the result
- **THEN** the final state is `stopped`
