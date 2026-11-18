---
namespace: legacy-adoption
version: 1.0.0
display_name: Legacy Project Pipeline Wrapper
profiles:
  - application
  - adoption-shim
sample: false
provides:
  - name: legacy.pipeline
    version: 1.0.0
requires: []
authoring_inputs:
  - kind: specification-to-source-skill
    uri: skills/specification-to-source/legacy-project-shim/SKILL.md
workflow_definition: workflows/legacy-adoption/workflow.md
routing_policy: routing/legacy-adoption.json
flavor_slots:
  - slot_id: build-system
    axis: build.system
    cardinality: exactly-one
    capability_contract: legacy.pipeline
entrypoints:
  - name: run
    kind: portable-application
    path: litai.harness.mk
acceptance_contracts: []
source_dependencies: []
---
# Legacy Project Pipeline Wrapper

This Component exposes the quarantined project's proven pipeline through the
top-level `litai.harness.mk` boundary. Proven stages (direct baseline ran) are
`build`, `test`, `package`; recorded but not executed are none; missing stages are
none and fail loudly rather than becoming silent no-ops.

### Requirement: Preserve the direct baseline

Every proven wrapper stage SHALL exit successfully and produce the same observed
legacy-tree identity as the corresponding direct Phase 1 baseline stage recorded in
`.literate/legacy-harness-baseline.json`. Recorded stages that were not executed
(host-heavy or missing driver) have no baseline identity to match.

#### Scenario: Wrapper stage matches direct execution

- **WHEN** a proven stage is invoked through `litai.harness.mk`
- **THEN** its exit status and resulting legacy-tree identity match the direct baseline

The retained application API requirements are specified in [General aviation API and MCP](../../docs/architecture/general-aviation-api.md).

### Requirement: Retain distinct reviewed aircraft-document source channels

The private aircraft-document service SHALL preserve originals and distinguish
native extraction, unchanged reviewed machine OCR and explicitly reviewed
original-page transcriptions as specified in the
[aircraft-library contract](../../docs/architecture/aircraft-library.md).
Each source channel SHALL retain verifiable provenance and expose synchronized
typed HTTP/MCP, SDK and desktop/mobile behavior without weakening numeric evidence
checks or source-generation history.

#### Scenario: Review page text that machine recognition misreads

- **WHEN** an authenticated operator explicitly transcribes a retained original
  page image and attests that its literal text matches
- **THEN** the service retains image/source pins and the named reviewer in a
  distinct transcription ledger without editing native text or machine OCR
- **AND** HTTP/MCP, SDK and desktop/mobile clients expose that same provenance,
  pending indexing, history and failure state
- **AND** earlier summaries remain historical unless explicit recovery validates
  complete unchanged scopes; neither the transcript nor its review approves
  aircraft performance data

### Requirement: Retained GA domain data is discoverable through HTTP and MCP

The retained planner SHALL expose weather, airport details and facilities, terrain,
GeoJSON mapping, aircraft references, navigation logs and performance/loading
calculations through typed HTTP operations. Meta App SHALL expose the same operations
through its MCP request tool and make their full schemas discoverable. Provider
provenance, unknown values and failures SHALL remain explicit; reference figures and
caller-supplied POH/loading data SHALL not become invented aircraft-specific results.

#### Scenario: An LLM discovers and calls a GA domain operation

- **WHEN** an integrating client requests the planner operation schema through MCP
- **THEN** it receives the typed public HTTP paths and input/output schemas
- **AND** invoking those paths through MCP returns the same domain data, provenance,
  missing-value semantics and error status as the corresponding HTTP operation

### Requirement: Feedback completion is distinct from cancellation

After an acknowledged successful feedback submission, the shared feedback widget
SHALL show Close, retain the created issue link and prevent submitting that same
completed form again. Closing SHALL leave the created issue unchanged. Opening
feedback again is an explicit new form. In-flight and failed submissions SHALL
not fabricate success or automatically retry.

#### Scenario: A pilot closes a completed feedback form

- **WHEN** the feedback service acknowledges a created issue
- **THEN** the dialog exposes Close and no enabled submit action
- **AND** closing and reopening offers a fresh empty feedback form

### Requirement: Retain private browser-local aircraft planning preferences

Flight Planner SHALL let a user save an aircraft registration with explicit
cruise speed in knots, fuel burn in US gallons/hour and fuel on board in US
gallons. Selecting it SHALL populate those flight inputs. Records SHALL persist
in that browser only, remain distinct from manufacturer/POH reference data, and
never be written to a shared unauthenticated server. Invalid, corrupt or failed
storage SHALL not become a successful save or silently erase previous records.

#### Scenario: Reuse saved aircraft planning inputs

- **WHEN** the pilot selects a saved registration after reopening the application
- **THEN** its three validated planning values populate the form
- **AND** changes are saved only on an explicit save, with per-flight fuel verification visible

Browser-local aircraft writers SHALL serialize the complete fresh-read, expected-record comparison and write across tabs using an origin-wide writer lock. Unsupported browsers SHALL explain why saving is unavailable while retaining editable flight inputs. Pending saves SHALL protect the submitted form against further edits until completion.

### Requirement: Maintain a resolvable dependency and test toolchain

Dependency update automation SHALL target the retained workspace's real manifest
and lockfile paths, including its pnpm workspace and Python application manifests.
All declared severity scanning SHALL remain enabled. Unsupported automatic security
updates SHALL be resolved with supported dependency releases or removal of the
unpatched dependency chain, preserving the affected application test assertions.
The remaining TypeScript service/model suites SHALL use the common Vitest runner;
provider/network isolation and signed loopback HTTP lifecycle coverage SHALL remain.

#### Scenario: An obsolete test dependency has no patched release

- **WHEN** a transitive test dependency cannot be securely updated
- **THEN** its owning runner is replaced with the supported common runner and all
  existing service/model/HTTP assertions pass without skipped suites
