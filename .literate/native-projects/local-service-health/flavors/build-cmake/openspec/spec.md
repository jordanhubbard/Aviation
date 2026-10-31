# CMake build-system Flavor

### Requirement: CMake is a removable build-system preference

When `build.system=cmake` is selected, source generation SHOULD create a self-contained,
portable `CMakeLists.txt` that configures, builds, tests, and cleans the complete
generated application out-of-source. This is a strong default preference, not framework
enforcement: explicit Component requirements and other selected Flavor requirements take
precedence. Removing the Flavor with the ordered `-cmake` selector removes both this
fragment and its exact build skill before the generation recipe is formed.

#### Scenario: Default applies without an override

- **WHEN** the Component declares a compatible build-system slot
- **AND** the project default selects `+cmake`
- **AND** no later selector removes or replaces it
- **THEN** the exact generation recipe includes the CMake Flavor and build skill

#### Scenario: Explicit subtraction removes the default

- **WHEN** a later selector is `-cmake`
- **THEN** the generation recipe contains neither the CMake Flavor fragment nor its
  build skill

#### Scenario: Explicit alternative replaces the default

- **WHEN** a later positive selector chooses another Flavor for the exclusive
  build-system slot
- **THEN** the weaker project CMake preference is replaced before prompt assembly
- **AND** the generation recipe contains neither the CMake Flavor fragment nor its
  build skill

### Requirement: Generated CMakeLists.txt files are self-contained and portable

Generated `CMakeLists.txt` files MUST be self-contained: they declare a `cmake_minimum_required`
version and a `project()` call, and make no assumptions about the invoker's environment
beyond the selected language toolchain and a compatible CMake generator.

#### Scenario: CMakeLists.txt configures on a fresh clone

- **WHEN** a generated `CMakeLists.txt` is configured on a machine with only the
  selected language toolchain and CMake installed
- **THEN** `cmake -S source -B build` succeeds without any additional setup step

### Requirement: The build is always out-of-source

Generated CMake projects MUST support and SHOULD require an out-of-source build
directory. Configuration output, object files, and other derived artifacts MUST NOT be
written into the source tree.

#### Scenario: Build output is confined to the build directory

- **WHEN** the operator runs `cmake -S source -B build && cmake --build build`
- **THEN** all new files are written under the declared build directory
- **AND** the source tree contains no new or modified files after the build

### Requirement: One root executable target and a discoverable test suite

When the CMake Flavor is selected and no stronger build-system requirement overrides it,
generated `CMakeLists.txt` SHALL declare exactly one root `add_executable` target that
builds the complete generated application, and SHALL register the generated test suite
with CTest via `enable_testing()` and `add_test()` so that `ctest --test-dir build` runs
every generated test case.

#### Scenario: cmake --build builds the application

- **WHEN** the operator runs `cmake --build build` after configuring
- **THEN** the declared root executable target is produced

#### Scenario: ctest runs the full test suite

- **WHEN** the operator runs `ctest --test-dir build`
- **THEN** every generated test case executes and any failure exits non-zero

### Requirement: Dependencies use standard CMake idioms

Generated `CMakeLists.txt` files MUST declare third-party and system dependencies
through `find_package` and link them with `target_link_libraries` using the modern
imported-target form. Generated projects MUST NOT hand-roll compiler or linker flags
that a `find_package` result or `target_link_libraries` usage would otherwise provide.

#### Scenario: A dependency is declared

- **WHEN** generated source requires a third-party library
- **THEN** `CMakeLists.txt` locates it with `find_package`
- **AND** the consuming target links it with `target_link_libraries` using the
  imported target the package exports, not a hand-written `-l`/`-I` flag

### Requirement: Shell recipes compose with the selected operating system

Any custom commands added with `add_custom_command` or `add_custom_target` MUST use
commands available on every selected OS Flavor and language toolchain, or MUST use
`${CMAKE_COMMAND} -E` portable file operations instead of a platform-specific shell
utility.

#### Scenario: Custom commands run on the selected host

- **WHEN** the same Component is generated for Linux, macOS, or Windows
- **THEN** any custom CMake commands use `${CMAKE_COMMAND} -E` or another portable
  invocation
- **AND** `cmake --build build` and `ctest --test-dir build` require no undeclared
  shell utility
