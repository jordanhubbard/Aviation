---
namespace: literate-ai
version: 1.0.1
display_name: Money Calculation
profiles:
  - application
  - library
  - portable
  - source-roundtrip
sample: false
provides:
  - name: literate-ai.money-calculation
    version: 1.0.1
    interface:
      uri: interfaces/money-calculation.md
      pin: null
  - name: sample.portable-app
    version: 1.0.0
    interface: null
requires: []
authoring_inputs:
  - kind: specification-to-source-skill
    uri: skills/specification-to-source/portable-application-implementation/SKILL.md
  - kind: specification-to-source-skill
    uri: skills/specification-to-source/portable-specification-planning/SKILL.md
workflow_definition:
  uri: workflows/sample-host.md
routing_policy:
  uri: routing/sample-host.json
flavor_slots:
  - slot_id: build-system
    axis: build.system
    cardinality: exactly-one
    capability_contract: literate-ai.money-calculation
  - slot_id: language
    axis: implementation.language-ecosystem
    cardinality: exactly-one
    capability_contract: sample.portable-app
  - slot_id: os
    axis: platform.os
    cardinality: exactly-one
    capability_contract: sample.portable-app
  - slot_id: toolchain
    axis: toolchain
    cardinality: zero-or-one
    capability_contract: sample.portable-app
entrypoints:
  - name: run
    kind: portable-application
    path: run
acceptance_contracts: []
source_dependencies: []
---
# Money Calculation

This independently generatable exact-money kernel applies basis-point discounts using
integer arithmetic. It is small enough to audit and reusable anywhere a service must
avoid floating-point currency drift.

```mermaid
flowchart LR
    S["Subtotal cents"] --> M["Multiply by basis points"]
    B["Discount basis points"] --> M
    M --> R["Half-up integer rounding"]
    R --> D["Discount cents"]
    D --> T["Total cents"]
```

## Application contract

| Concern | Decision |
| --- | --- |
| Application ID | `money-calculation` |
| Kind | `invoice` |
| Entrypoint | `run` |
| Currency storage | Integer cents (`integer-cents`) |
| Discount unit | Basis points (`basis-points`) |
| Rounding | Half up |

The reusable public surface is defined by `interfaces/money-calculation.md`; consumers
SHALL use that capability rather than duplicate its arithmetic.

### Requirement: Exact integer discount calculation

The Component's portable `run` entrypoint SHALL accept one UTF-8 JSON argument array
whose two ordered values are a non-negative integer subtotal in cents and a discount in
basis points from 0 through 10000, compute the discount as
`floor((subtotal_cents * discount_basis_points + 5000) / 10000)`, and return integer
`subtotal_cents`, `discount_cents`, and `total_cents` fields.

#### Scenario: Half-up discount rounding

- **WHEN** a 999-cent subtotal receives a 1250-basis-point discount
- **THEN** the discount is 125 cents and the total is 874 cents

### Requirement: Reusable money capability

The generated source SHALL expose the calculation as a reusable logical module or build
target that higher-level Components can call without duplicating its arithmetic.

#### Scenario: Invoice service consumes the capability

- **WHEN** `component://literate-ai/invoice-service` is composed with this Component
- **THEN** the service calls the `literate-ai.money-calculation` capability
