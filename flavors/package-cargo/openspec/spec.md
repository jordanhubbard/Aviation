# Cargo crate package provider

### Requirement: Cargo packaging requires Rust

When `packaging=crates` is selected, the Component SHALL also select
`implementation.language-ecosystem=rust`. Selecting `package-cargo` without Rust,
or alongside a conflicting language Flavor as the only language, SHALL fail closed.

#### Scenario: Cargo packaging without Rust is rejected

- **WHEN** a Component selects `package-cargo` and does not select Rust on the
  language axis
- **THEN** Flavor resolution fails closed with an unsatisfied target constraint

### Requirement: Enumerated lockfile-pinned closure

When `package-cargo` is selected, generated Rust MAY declare an enumerated crate
dependency closure in `Cargo.toml`. Every declared package SHALL be pinned by a
complete `Cargo.lock` beside that manifest. The authorized lifecycle SHALL derive
or replay that lockfile in a disposable projection. Generation SHALL NOT invent
lockfile bytes or unpinned registry ranges.

#### Scenario: Manifest without a lockfile is rejected

- **WHEN** generated source declares crate dependencies in `Cargo.toml` and no
  matching `Cargo.lock` is present
- **THEN** dependency observation fails closed before install or build

### Requirement: Detect before install

The crate install phase SHALL detect `cargo` on PATH before any fetch and return
a concrete host prerequisite when unavailable. It SHALL not install Cargo or a
global crate without separate authorization. When the toolchain is present, it
SHALL use `--locked` into `OBJ_DIR`, never into admitted generated source.

#### Scenario: Host cargo is absent

- **WHEN** `package-cargo` is selected and `cargo` cannot be resolved on PATH
- **THEN** the lifecycle stops before executing any cargo package command

### Requirement: Bind package construction to exact accepted authority

The packager SHALL consume an exact PackagePlan that binds the Component lock, target,
artifact graph, authored specification closure, source and resolved CycloneDX SBOMs,
entrypoints, runtime requirements, and packager identity. It SHALL write package outputs
only beneath OBJ_DIR and SHALL NOT publish them to a registry.

#### Scenario: Current package is constructed

- **WHEN** every planned input is present with its exact content identity
- **THEN** Build a standards-compliant crate package only when the Component exposes a
  Rust package. Include the authored Component specification closure and retain the
  exact accepted products and CycloneDX documents as bound package data.
