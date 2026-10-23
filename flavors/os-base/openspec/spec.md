# Universal host-toolchain Flavor

### Requirement: One universal host capability authority

Every supported Literate AI host SHALL compose this Flavor's exact logical SBOM with
one exact concrete OS/architecture/accelerator realization. Installers and worker
bootstraps SHALL NOT maintain independent copies of the universal capability set.

#### Scenario: Two entrypoints inspect one host

- **WHEN** `make install` and remote-worker bootstrap inspect the same host and coding
  agent selection
- **THEN** they resolve the same base capability IDs, probes, version constraints, and
  selected coding-agent provider

### Requirement: Exact coding-agent alternative

The coding-agent capability SHALL be satisfied by one supported provider. An explicit
provider selection SHALL require that exact provider and SHALL NOT fall back to another
installed provider. Without an explicit selection, an installed provider SHALL be
chosen in declared order; when none exists, the declared default MAY be installed only
after the installation-consent boundary.

#### Scenario: Selected provider is absent

- **WHEN** a worker is routed with `CODING_CLI=claude` and only Codex is installed
- **THEN** preflight reports Claude missing or installs the declared Claude realization
  after consent
- **AND** generation does not begin through Codex

### Requirement: Authentication remains separate

Host-toolchain installation SHALL NOT create, copy, migrate, print, or claim coding
agent credentials. Readiness for a live generation SHALL check authentication after
the executable and version capability is satisfied.

#### Scenario: Fresh provider installation

- **WHEN** a missing coding agent is installed successfully
- **THEN** the host-toolchain report records its executable and version
- **AND** reports no authentication claim
