---
namespace: aviation
version: 0.1.0
display_name: Aviation remote E2E contract
profiles:
  - library
  - portable
sample: false
provides:
  - name: aviation.testing.e2e
    version: 0.1.0
    interface:
      uri: interfaces/e2e.md
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
    uri: acceptance/e2e.md
source_dependencies: []
---
# Aviation remote E2E contract

This Component owns the provider-neutral trust and isolation contract used by remote
end-to-end test runs across Aviation applications. It defines valid run identities,
application-bound short-lived HMAC credentials, safe run-owned path derivation, and
immutable test-record tagging.

It does not own random identity generation, secret sourcing, HTTP middleware or
routes, database creation or schemas, fixture formats, browser orchestration, network
mocks, cleanup timing, residual-row queries, deployment policy, or test-run scheduling.
Those remain SDK and application adapter behavior.

The public surface is defined by `interfaces/e2e.md`. Every realization must pass
`acceptance/e2e.md` against `acceptance/vectors.json` without network access.

### Requirement: Test credentials are app-bound and fail closed

Credentials SHALL bind an exact application identifier, run identifier, and
millisecond expiry with HMAC-SHA256. Missing test headers mean ordinary traffic;
partial, malformed, expired, excessive-lifetime, foreign-app, and invalid-signature
credentials SHALL fail closed.

#### Scenario: A valid credential reaches its intended application

- **WHEN** a credential is signed for `flight-planner` and a valid run identity
- **AND** verification occurs before its expiry and within the maximum lifetime
- **THEN** verification returns that run identity
- **AND** verification for a different application fails

### Requirement: Test storage identities cannot escape their root

Run identities SHALL match `e2e_` followed by exactly 32 lowercase hexadecimal
characters. Directory and SQLite paths SHALL be derived only after validating the
identity and SHALL remain direct children of the caller-owned root.

#### Scenario: A traversal-shaped identity is supplied

- **WHEN** an adapter requests an isolated path for `../production`
- **THEN** derivation fails with `e2e-run-id-invalid`
- **AND** no path is returned

### Requirement: Test records carry immutable isolation fields

Tagging SHALL return a new record with `is_test_data: true` and the exact run identity.
Existing isolation fields SHALL be rejected, and assertion SHALL reject production or
foreign-run records without mutating caller data.

#### Scenario: An untagged fixture is admitted

- **WHEN** a caller tags the fixture for a valid run
- **THEN** the returned record contains both isolation fields
- **AND** the original fixture remains unchanged

