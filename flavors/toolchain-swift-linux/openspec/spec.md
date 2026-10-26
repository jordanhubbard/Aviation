# Linux Swift toolchain realization

### Requirement: Discover a supported Linux Swift toolchain

The host preflight SHALL run `swiftc --version` before source generation and fail with
installation guidance when no Swift toolchain supported by the selected Linux host is
available.

#### Scenario: Linux Swift is missing

- **WHEN** `swiftc --version` cannot resolve a compiler
- **THEN** preflight stops before generation with distribution-specific mitigation

Installation authority: <https://www.swift.org/install/linux/>. The selected
distribution and architecture must appear in Swift's current support matrix.
