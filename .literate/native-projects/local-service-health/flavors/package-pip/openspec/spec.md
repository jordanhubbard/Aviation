# pip wheel package provider

### Requirement: pip packaging requires Python

When `packaging=pip` is selected, the Component SHALL also select
`implementation.language-ecosystem=python`. Selecting `package-pip` without Python,
or alongside a conflicting language Flavor as the only language, SHALL fail closed.

#### Scenario: pip without Python is rejected

- **WHEN** a Component selects `package-pip` and does not select Python on the
  language axis
- **THEN** Flavor resolution fails closed with an unsatisfied target constraint

### Requirement: Bind package construction to exact accepted authority

The packager SHALL consume an exact PackagePlan that binds the Component lock, target,
artifact graph, authored specification closure, source and resolved CycloneDX SBOMs,
entrypoints, runtime requirements, and packager identity. It SHALL write package outputs
only beneath OBJ_DIR and SHALL NOT publish them.

#### Scenario: Current package is constructed

- **WHEN** every planned input is present with its exact content identity
- **THEN** Build a standards-compliant wheel and source distribution only when the Component exposes a Python package. Include the authored Component specification closure beneath package metadata and retain the exact accepted products and CycloneDX documents as package data or adjacent bound release artifacts.

### Requirement: Detect native tooling before use

The package phase SHALL detect Python build frontend (`python -m build`) and a wheel verifier on PATH before construction and return a concrete
host prerequisite when unavailable. It SHALL not install a system or global package tool
without separate authorization.

#### Scenario: Provider tool is unavailable

- **WHEN** the selected provider tool cannot be resolved or its version cannot be bound
- **THEN** package construction stops before executing any packaging command

### Requirement: Verify without publishing or installing

Package verification SHALL inspect the produced bytes, metadata, file closure, declared
entrypoints, and checksums against the exact PackagePlan. It SHALL not install, upload,
submit, tap, or push the package.

#### Scenario: Package bytes drift

- **WHEN** a package output or embedded manifest differs from its recorded identity
- **THEN** verification fails and release preparation cannot consume the result
