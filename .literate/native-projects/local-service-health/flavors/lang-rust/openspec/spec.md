# Rust implementation Flavor

### Requirement: Portable Rust implementation

When `implementation.language-ecosystem=rust` is selected, generate a Rust 2021
standard-library application with `source/main.rs` as its crate root. The application
SHALL compile with one direct `rustc` invocation and no Cargo manifest, external crate,
build script, unsafe block, or platform-specific API. Its native executable SHALL accept
one UTF-8 JSON array containing the declared entrypoint arguments as its sole command-line
argument (`argv[1]`), SHALL NOT read the request from standard input, and SHALL write only
the JSON result to standard output.

#### Scenario: Rust application executes

- **WHEN** the generated crate root is compiled by the selected host Rust toolchain
- **THEN** the native executable implements the acceptance contract for every role assigned to the Rust Flavor
