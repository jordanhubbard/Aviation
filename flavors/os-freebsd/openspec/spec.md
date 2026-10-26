# FreeBSD host Flavor

### Requirement: Native FreeBSD execution

The application SHALL use portable filesystem, temporary-storage and UTF-8 APIs
on FreeBSD unless its own specification requires native interfaces. Linux procfs,
GNU utilities and Linux ABI compatibility SHALL NOT be presumed available.
Native extensions SHALL target the selected FreeBSD architecture and userland.
Snapshot-replication conformance SHALL select the native FreeBSD Flavor for
versioned FreeBSD host names, retain unsupported-host refusal, and execute the
same replay and negative custody checks as other supported hosts.
GNU Make requirements SHALL resolve to `gmake`, distinct from the base BSD make.
Native installation SHALL read the FreeBSD `pkg` realization for the exact supported
architecture. Package provenance and behavioral probes must both pass. Coding-agent
providers without a native realization remain unavailable; Linux agent binaries
SHALL NOT substitute for native support. A missing or older package remains missing
until an authorized declared installation provides the required version.

#### Scenario: Physical or virtual FreeBSD worker

- **WHEN** `platform.os=freebsd` is selected for a physical machine or a guest
- **THEN** build and acceptance execute in that FreeBSD environment
- **AND** the virtualization host's OS does not substitute for guest identity

### Requirement: Exclusive directory publication

Native directory publication SHALL use FreeBSD's `renameat2` with
`AT_RENAME_NOREPLACE`, preserving descriptor-bound parent and source custody.
A destination created after prechecks SHALL remain untouched. Missing native
support or an unsupported filesystem SHALL refuse without a replacing fallback.

#### Scenario: Concurrent publication destination

- **WHEN** another writer creates the destination before the native rename
- **THEN** publication refuses and preserves both that destination and its stage

### Requirement: Retained-harness native routing

Retained-harness SSH execution SHALL admit an explicitly selected FreeBSD worker
and preserve its actual OS identity. The receiver SHALL reject a different OS or
configured CPU architecture before executing harness commands. Optional packaged
runtime tools SHALL bind OS and architecture; a missing native provider SHALL
refuse before transfer, and a foreign tool archive SHALL refuse at the receiver.
Source-only harnesses SHALL NOT require an unused optional runtime provider.
Repository child lifecycle declarations SHALL admit `freebsd-x86_64` and
`freebsd-aarch64` native targets. Execution SHALL require the declared target to
match the actual host OS and architecture before creating execution outputs or
reservations. Unknown target identities SHALL remain unsupported.

#### Scenario: FreeBSD retained harness without optional runtime tools

- **WHEN** an authorized retained harness selects an explicit FreeBSD SSH worker
- **THEN** its source-only command graph can execute with native platform evidence
- **AND** Linux tool binaries cannot substitute for a missing FreeBSD provider

#### Scenario: Native repository child lifecycle target

- **WHEN** a pinned child lifecycle declaration selects a canonical FreeBSD target
- **THEN** read-only planning preserves that target and reports the actual host
- **AND** a foreign host or architecture refuses execution before any writes
- **AND** child ordering, current pins, retained logs and cancellation remain bound

### Requirement: Truthful native capability evidence

Worker observations SHALL use named bounded FreeBSD queries. An unsupported GPU,
quota, paging or pressure observation SHALL remain explicitly unsupported or
unavailable and SHALL NOT become proof of capacity or successful acceptance.
Hardware acceptance SHALL require the actual target hardware where specified.

Native ELF dependency evidence SHALL bind the FreeBSD inspector, hints, library
maps and selected library bytes. Inspection SHALL NOT execute target binaries.
Unsupported loader controls and ambiguous mappings SHALL refuse qualification;
Linux loader-cache semantics SHALL NOT substitute for FreeBSD loader evidence.

#### Scenario: Unsupported capability

- **WHEN** a required native observation cannot be measured
- **THEN** its status states that limitation and the requiring gate cannot claim
  qualification from a fabricated successful measurement

### Requirement: Loader context is distinct from native file identity

Program-specific filter and auxiliary observations SHALL bind explicit image,
program and target references in a context-identified loader record. Shared native
file records SHALL retain their exact file identity. SDK relocation SHALL rebind
portable context paths and references without losing filter facts. Actual file
identity conflicts SHALL still refuse.

#### Scenario: SDK and consumer observe the same system library

- **WHEN** different programs produce distinct potential filter observations
- **THEN** both contexts remain represented alongside the shared exact file
- **AND** relocation preserves every image, program and target relationship

### Requirement: Split Python SQLite runtime

FreeBSD host installation SHALL compose a Python SQLite capability from the OS
Flavor and map it to the native `py312-sqlite3` package. Package registration and
a successful in-memory SQLite query through the current interpreter SHALL both
be required. An installed Python command alone SHALL NOT prove this capability.

#### Scenario: Python runs without its SQLite extension

- **WHEN** Python is available but importing or using `sqlite3` fails
- **THEN** host bootstrap reports the SQLite capability missing
- **AND** an authorized repair installs the declared native package and re-probes
