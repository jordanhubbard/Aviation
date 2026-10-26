# ZIP package provider

### Requirement: Preserve accepted lifecycle authority

The public package plan, build and verify commands SHALL select this portable
provider from package-zip without imposing a language or OS constraint. Construction
SHALL consume only the accepted lifecycle artifact closure and bind its exact
Component revision, lock, target, artifact graph, entrypoints, runtime requirements,
native-library metadata and packager identity. Target portability SHALL NOT imply
ABI portability. Missing accepted custody or host execution acknowledgment SHALL
stop construction. Publication remains separately authorized by the release lifecycle.

#### Scenario: Current accepted closure is packaged

- **WHEN** the selected lifecycle succeeds with exact immutable inputs
- **THEN** construction writes one ZIP beneath OBJ_DIR with the planned relative
  payload paths, authored Component specification and both source and resolved
  CycloneDX SBOMs, each bound to its source identity

### Requirement: Reproduce the complete archive

The packager SHALL bind its ZIP implementation and compression runtime identity,
normalize timestamps, regular-file modes and member ordering, preserve executable
entrypoints and include no undeclared members. It SHALL reject reserved resource
collisions, symbolic links and changed or missing materialized inputs. It SHALL
not install tools or packages, run install hooks, or publish during construction.

#### Scenario: Identical inputs are packaged twice

- **WHEN** the exact plan and tool identity are unchanged
- **THEN** every output byte and the typed PackageResult identity are identical

### Requirement: Verify without trusting construction custody

Verification SHALL independently check the typed plan/result bindings, artifact
hash and size, complete unique member table, canonical metadata, executable modes
and every member hash and size. Missing, stale, wrong-target, duplicate, extra,
corrupt or changed archive evidence SHALL fail; no extraction or execution is needed.

#### Scenario: Archive bytes or membership drift

- **WHEN** an archive is altered, including a recomputed outer digest
- **THEN** independent verification rejects the altered member closure or metadata
  and release preparation cannot treat it as accepted evidence
