# C++ implementation Flavor

### Requirement: Portable C++ implementation

When `implementation.language-ecosystem=cpp` is selected, generate a C++17
standard-library application with `source/main.cpp` as its entrypoint. Its native
executable SHALL accept one UTF-8 JSON array containing the declared entrypoint
arguments as its sole command-line argument (`argv[1]`), SHALL NOT read the request from
standard input, SHALL write only the JSON result to standard output, and SHALL use no
third-party or platform-specific dependency unless the selected OS Flavor requires it.

#### Scenario: C++ application executes

- **WHEN** the generated source is compiled by the selected host C++ toolchain
- **THEN** the native executable implements the same acceptance contract as every other language Flavor selected for the application
