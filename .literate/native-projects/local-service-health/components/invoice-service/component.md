---
namespace: literate-ai
version: 1.0.1
display_name: Invoice Service
profiles:
  - application
  - portable
  - service
  - source-roundtrip
sample: false
provides:
  - name: literate-ai.invoice-service
    version: 1.0.1
    interface:
      uri: interfaces/invoice-service.md
      pin: null
  - name: sample.portable-app
    version: 1.0.0
    interface: null
requires:
  - requirement_id: money-calculation-interface
    capability: literate-ai.money-calculation
    version_range: ">=1,<2"
    dependency_kind: generation
    optional: false
    constraints: []
  - requirement_id: money-calculation
    capability: literate-ai.money-calculation
    version_range: ">=1,<2"
    dependency_kind: runtime
    optional: false
    constraints: []
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
    capability_contract: literate-ai.invoice-service
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
# Invoice Service

This independently generatable service aggregates invoice lines and delegates all
discount arithmetic to the exact-money capability. It can be reused behind carts,
quotes, subscriptions, procurement, or other billing entrypoints without exposing its
private source layout.

```mermaid
flowchart LR
    I["Invoice line items"] --> A["Aggregate lines and units"]
    A --> S["Subtotal in integer cents"]
    S --> M["Money-calculation capability"]
    M --> T["Discount and total"]
```

## Application contract

| Concern | Decision |
| --- | --- |
| Application ID | `invoice-service` |
| Kind | `invoice` |
| Entrypoint | `run` |
| Currency storage | Integer cents (`integer-cents`) |
| Discount unit | Basis points (`basis-points`) |
| Rounding | Half up (`half-up`), delegated to `literate-ai.money-calculation` |

The public process surface is defined by `interfaces/invoice-service.md`; consumers
SHALL depend on that interface rather than any generated file organization.

### Requirement: Aggregate invoice line items

The Component SHALL accept an `items` array whose entries contain `sku`, non-negative
integer `quantity`, and non-negative integer `unit_price_cents`; compute each line value
as `quantity * unit_price_cents`; and return integer `line_count`, `unit_count`, and
`subtotal_cents` fields.

#### Scenario: Two invoice lines are aggregated

- **WHEN** two widget units at 1299 cents and three cable units at 499 cents are supplied
- **THEN** the service reports two lines, five units, and a 4095-cent subtotal

### Requirement: Delegate money arithmetic

The Component SHALL require `literate-ai.money-calculation` and use that dependency to apply
the supplied `discount_basis_points`; it SHALL return the dependency's integer
`discount_cents` and `total_cents` without duplicating or changing its rounding rule.

#### Scenario: Transitive money Component is used

- **WHEN** the invoice has a 4095-cent subtotal and a 1000-basis-point discount
- **THEN** the service returns a 410-cent discount and a 3685-cent total
