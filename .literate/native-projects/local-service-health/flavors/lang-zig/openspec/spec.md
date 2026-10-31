# Zig implementation Flavor

### Requirement: Portable Zig implementation

When `implementation.language-ecosystem=zig` is selected, generate a Zig application
with `source/main.zig` as its compilation unit. The application SHALL compile with one
direct `zig build-exe` invocation and no package manager, network fetch, or
host-specific build option. Its native executable SHALL accept one UTF-8 JSON array
containing the declared entrypoint arguments as its sole command-line argument
(`argv[1]`), SHALL NOT read the request from standard input, and SHALL write only the
JSON result to standard output.

#### Scenario: Zig application executes

- **WHEN** the generated file is compiled by the selected host Zig toolchain
- **THEN** the native executable implements the acceptance contract for every role
  assigned to the Zig Flavor
