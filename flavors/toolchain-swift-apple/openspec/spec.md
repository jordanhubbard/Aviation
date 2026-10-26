# Apple Swift toolchain realization

### Requirement: Discover Apple developer tools before generation

The host preflight SHALL run `xcrun swiftc --version` before source generation. If the
probe fails, it SHALL stop and explain that Apple Command Line Tools or Xcode must be
installed or repaired; it SHALL NOT invoke an installer without authorization.

#### Scenario: Apple developer tools are missing

- **WHEN** `xcrun swiftc --version` cannot resolve a compiler
- **THEN** preflight stops before generation with Command Line Tools mitigation
