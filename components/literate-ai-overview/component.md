---
namespace: literate-ai
version: 1.0.0
display_name: Literate-AI Application Foundry Overview
profiles:
  - documentation
  - terminal
sample: false
provides: []
requires:
  - requirement_id: document-pair
    capability: literate-ai.document-pair
    version_range: ">=1,<2"
    dependency_kind: generation
    optional: false
    constraints: []
authoring_inputs:
  - kind: specification-to-source-skill
    uri: skills/specification-to-source/document-pair/SKILL.md
workflow_definition:
  uri: workflows/sample-host.md
routing_policy:
  uri: routing/sample-host.json
flavor_slots:
  - slot_id: documentation-ecosystem
    axis: documentation.ecosystem
    cardinality: exactly-one
    capability_contract: literate-ai.document-pair
entrypoints: []
acceptance_contracts: []
source_dependencies: []
---
# Literate-AI Application Foundry Overview

This is the Literate-AI project's own manager and engineering overview. It consumes the
`literate-ai.document-pair` capability and realizes both the `presentation` and
`narrative` members: a succinct Google Slides deck addressed to engineering, product, and
program managers, and a comprehensive Google Doc narrative that describes the codebase and
its behavior in multi-page form for readers who need the fuller technical account.

**This Component is terminal.** It provides no capability, exports no interface, and is
deliberately absent from the project template. Its content is specific to Literate-AI:
its claims describe this repository's implementation state, its factual ledger is bound
to this repository's architecture documents, and its investment argument is addressed to
this project's owners. It is not a starting point for another project's overview.

Terminal does not mean private. This Component is citable by
`component://literate-ai/literate-ai-overview`, and its published locations are
linkable. What it forbids is inheritance: forking this package to produce a different
project's deck would carry Literate-AI's claims into a context where the factual ledger
no longer holds.

## Cited authoring method

Generation authority is `skills/specification-to-source/document-pair/SKILL.md`. Two
further skills are cited rather than pinned:
`skills/agent/author-presentations-and-documents/SKILL.md` for the general authoring and
depth-review method, and `docs/presentations/literate-ai-manager-overview/SKILL.md` for
this package's local regeneration procedure.

## Authoring package

The durable authoring package is `docs/presentations/literate-ai-manager-overview/`. It
holds the narrative specification, the factual claim ledger, the generation prompts, the
build source, the owned image assets, the regeneration entry point, the current
deliverable links, and the QA ledger — the eight elements the document-pair interface
requires.
The primary regeneration entry point is
`docs/presentations/literate-ai-manager-overview/regenerate_python.sh`.

## Declared realization

| Concern | Decision |
| --- | --- |
| Members declared | `presentation`, `narrative` |
| Surface geometry | 1280 × 720 (presentation) |
| Heading hierarchy | unskipped, starting at H1 (narrative) |
| Access audience | `organization` |
| Permission | `view` |
| Link sharing | organization-restricted |
| Publication | authorized per revision, never standing |

The declared audience was widened from `named-principals` to `organization` by explicit
owner decision on 2026-08-08, before the corresponding publication. Under
`interfaces/document-pair.md` a provider may narrow but never widen the declared
audience, so the declaration changes first and the realization follows it. The `narrative`
member was added to the declaration by explicit owner decision on 2026-08-16, ahead of
its own first realization; the same narrow-not-widen rule governs its audience going
forward.

### Requirement: The overview realizes both members of the document pair

The Component SHALL declare both the `presentation` and `narrative` members of the
document pair. Under `interfaces/document-pair.md`, declaring both members means both
SHALL be realized whenever a publication is authorized.

#### Scenario: Ecosystem resolves to Google Workspace

- **WHEN** the `documentation.ecosystem` axis resolves to `google-workspace`
- **THEN** a Google Slides presentation is realized from the exported deck, and a Google
  Doc is realized from the narrative specification, and both are cited from this
  package's README

#### Scenario: Only one member's authoring source has changed

- **WHEN** a regeneration is triggered and only the deck specification or only the
  narrative specification has changed since the last realization
- **THEN** both members SHALL still be re-verified against the current factual ledger,
  because a shared ledger claim can invalidate either artifact independently of which
  authoring source was edited

### Requirement: Claims trace to the repository's current authority

Every consequential claim SHALL trace to an entry in
`docs/presentations/literate-ai-manager-overview/source-notes.md`, which in turn traces
to current specifications, current implementation, or an explicitly labeled future
assumption.

#### Scenario: A roadmap outcome is presented as implemented

- **WHEN** a page presents a two-week horizon outcome or a portfolio-scale concurrency
  figure as a measured current result
- **THEN** acceptance fails, because the ledger records both as unmeasured

### Requirement: The technical sequence is present

The realized presentation SHALL carry a labeled mechanism sequence that shows the
durable authority as a real specification excerpt, states the generation-key binding
boundary and its invalidation consequences, explains ordering and cost, covers the
failure path, and names the model-egress trust boundary. The realized narrative SHALL
cover the same mechanism sequence in prose, at the greater depth its multi-page form
allows, without skipping the failure path or the model-egress trust boundary.

#### Scenario: The deck states outcomes without mechanism

- **WHEN** no page shows a real specification, plan, or receipt artifact
- **THEN** acceptance fails against the authoring skill's depth review

#### Scenario: The narrative omits the failure path

- **WHEN** the narrative describes the generation sequence but does not describe what
  happens when a step fails
- **THEN** acceptance fails against the authoring skill's depth review

### Requirement: Publication is authorized per revision

Publication of this Component's artifacts to any external destination SHALL require
explicit authorization for that specific revision. Prior authorization of an earlier
revision SHALL NOT carry forward.

#### Scenario: A revision is regenerated but not authorized

- **WHEN** either or both members are regenerated and no publication authorization is
  supplied
- **THEN** the local exports (PowerPoint, and Word or equivalent for the narrative) are
  updated, the previously published locations are recorded as stale, and no external
  destination is contacted
