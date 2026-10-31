---
namespace: aviation
version: 0.1.0
display_name: Aviation UI pane lifecycle
profiles:
  - library
sample: false
provides:
  - name: aviation.ui.panes
    version: 0.1.0
    interface:
      uri: interfaces/panes.md
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
    uri: acceptance/panes.md
source_dependencies: []
---
# Aviation UI pane lifecycle

This Component owns deterministic pane ordering, initial selection, relative
navigation, closeability, reordering, and active-pane selection after close for shared
Aviation application shells.

It does not own React renderers, application URLs, icons, themes, CSS, focus behavior,
iframe policy, persistence, or application layout. UI adapters supply those values and
delegate only portable pane-state transitions to this capability.

The public surface is defined by `interfaces/panes.md`. The TypeScript realization must
pass `acceptance/panes.md` against `acceptance/vectors.json` without network access or an
application runtime.

### Requirement: Ordering and selection are deterministic

Panes SHALL sort by ascending explicit order, with unordered panes after ordered panes
and title as the stable secondary key. Initial selection SHALL use the first source-order
pane marked default-open, otherwise the first source-order pane, otherwise no pane.

#### Scenario: A shell mixes ordered and unordered panes

- **WHEN** the pane list is sorted
- **THEN** explicitly ordered panes precede unordered panes
- **AND** equal-order panes sort by title
- **AND** the caller-owned list and records are not mutated

### Requirement: Navigation and mutation results are portable

Relative navigation SHALL use sorted pane order and wrap in either direction. Reordering
SHALL move one pane by one position without wrapping and renumber successful results from
one. Closing an active pane SHALL prefer its next source-order neighbor, then its previous
neighbor, and SHALL return normalized remaining order values.

#### Scenario: The active middle pane closes

- **WHEN** panes `a`, `b`, and `c` are open and active pane `b` closes
- **THEN** panes `a` and `c` remain
- **AND** pane `c` becomes active
- **AND** their orders normalize to one and two

### Requirement: Rendering remains application policy

The Component SHALL treat pane identity and title as opaque application data. Component
renderers, icons, URLs, styling, persistence, and layout SHALL remain adapter behavior.

#### Scenario: G1000 publishes an embeddable pane

- **WHEN** G1000 supplies its React renderer and presentation metadata
- **THEN** the common contract may type and order that pane
- **AND** the Component does not interpret or execute the renderer
