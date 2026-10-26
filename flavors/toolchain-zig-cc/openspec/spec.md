# Zig C/C++ toolchain realization

### Requirement: Discover Zig before using it as a C/C++ compiler

The host preflight SHALL run `zig version` before source generation. If the probe fails,
it SHALL stop and explain that Zig must be installed; it SHALL NOT invoke an installer
without authorization. This Flavor does not replace a selected language Flavor.

#### Scenario: Zig is missing

- **WHEN** `zig version` cannot resolve a compiler
- **THEN** preflight stops before generation with Zig installation mitigation
