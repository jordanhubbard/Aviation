# Windows Swift toolchain realization

### Requirement: Discover a supported Windows Swift toolchain

The host preflight SHALL run `swiftc.exe --version` before source generation and fail
with installation guidance when the supported native Windows toolchain is unavailable.

#### Scenario: Windows Swift is missing

- **WHEN** `swiftc.exe --version` cannot resolve a compiler
- **THEN** preflight stops before generation with native-toolchain mitigation

Installation authority: <https://www.swift.org/install/windows/>. Its Windows platform
dependencies are prerequisites of the Swift realization, not generic OS policy.
