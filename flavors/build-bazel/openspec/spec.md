# Bazel build-system Flavor

### Requirement: Bazel is a removable build-system preference

When `build.system=bazel` is selected, source generation SHOULD create a
portable Bazel rule graph that compiles, tests, and packages the complete generated
application. This is a strong default preference, not framework enforcement: explicit Component
requirements and other selected Flavor requirements take precedence. Removing the
Flavor with the ordered `-bazel` selector removes both this fragment and its exact build
skill before the generation recipe is formed.

#### Scenario: Default applies without an override

- **WHEN** the Component declares a compatible build-system slot
- **AND** the project default selects `+bazel`
- **AND** no later selector removes or replaces it
- **THEN** the exact generation recipe includes the Bazel Flavor and build skill

#### Scenario: Explicit subtraction removes the default

- **WHEN** a later selector is `-bazel`
- **THEN** the generation recipe contains neither the Bazel Flavor fragment nor its
  build skill

#### Scenario: Explicit alternative replaces the default

- **WHEN** a later positive selector chooses another Flavor for the exclusive
  build-system slot
- **THEN** the weaker project Bazel preference is replaced before prompt assembly
- **AND** the generation recipe contains neither the Bazel Flavor fragment nor its
  build skill

### Requirement: Preference selection is not a built-with assertion

The exact Flavor lock records selection of a `bazel` policy. It MUST NOT be
interpreted as evidence that the resulting application was built with Bazel. The
generated build graph, guarded build execution, and build evidence identify the build
system actually used.

#### Scenario: Explicit native authority wins

- **WHEN** the Bazel-preferred policy is selected
- **AND** an exact Component or selected Flavor requires a native build system
- **THEN** the Flavor lock remains evidence of the preference only
- **AND** guarded build evidence identifies the native system that actually ran

### Requirement: Build integration is described honestly

Generated build definitions SHALL distinguish native fine-grained Bazel rules from a
coarse Bazel action that wraps an ecosystem-native build. A wrapper MUST NOT be
described as providing fine-grained dependency tracking. When the Component or another
selected Flavor explicitly requires a native build system, that authority SHALL win.

#### Scenario: Bazel wraps an ecosystem-native build

- **WHEN** Bazel invokes an ecosystem-native build as one action
- **THEN** the integration is identified as a coarse wrapper
- **AND** it is not represented as a fine-grained native Bazel rule graph

### Requirement: Caches are disposable optimization layers

Bazel output roots and caches SHALL remain outside the specification repository and
outside the generated source tree. A binary cache hit never becomes specification or
acceptance authority; the exact source and rule graph remain the source-to-binary input.

#### Scenario: Cache begins empty

- **WHEN** no Bazel cache entry exists for the exact source, rules, and toolchain
- **THEN** the application can still be built from those declared inputs
- **AND** newly created cache data is written outside both source trees

### Requirement: Selected Bazel applications expose one portable target contract

When the Bazel Flavor is selected and no stronger build-system requirement overrides
it, generated source SHALL contain a Bzlmod workspace with a runnable `//:run` target
and real test targets. `bazel test //...` SHALL compile and execute those tests, and
`bazel run //:run -- <application arguments>` SHALL run the complete application using
the selected language's supported Bazel ruleset. Required language rulesets SHALL be
declared with exact compatible versions in `MODULE.bazel`, including `rules_cc` and
`rules_python` when Bazel 9 has removed their former native rule symbols.

#### Scenario: Bazel 9 builds a generated application

- **WHEN** Bazel 9 no longer supplies the selected language rule as a native symbol
- **THEN** `BUILD.bazel` loads that rule from an exact module declared in `MODULE.bazel`
- **AND** generation does not rely on an undefined legacy native symbol

#### Scenario: C++ headers use supported rules_cc attributes

- **WHEN** generated C++ source contains a `cc_binary` or `cc_test`
- **THEN** that executable rule does not declare the unsupported `hdrs` attribute
- **AND** target-private headers are listed in `srcs`, or shared headers belong to a
  package-local `cc_library` consumed through `deps`
- **AND** the executable rule does not use `includes = ["."]` to expose the workspace
  root as an include directory

#### Scenario: Python entrypoints are explicit

- **WHEN** a generated target uses `py_binary` or `py_test` from `rules_python`
- **THEN** the target sets `main` to an executable Python source also listed in `srcs`
- **AND** the build does not rely on target-name-based entrypoint inference

#### Scenario: JavaScript entrypoints use the rules_js API

- **WHEN** a generated target uses `js_binary` or `js_test` from `aspect_rules_js`
- **THEN** the target sets `entry_point` to its executable JavaScript source
- **AND** the target does not pass the unsupported `srcs` attribute

#### Scenario: Rust module inputs are complete

- **WHEN** a generated `rust_binary` or `rust_test` compiles a crate root that reaches
  another Rust file through `mod` or `#[path]`
- **THEN** every reachable Rust source file is declared in that target's `srcs`
- **AND** the target does not depend on undeclared source visibility outside Bazel's
  sandbox

### Requirement: Bzlmod resolution is authorized and evidence-bound

A literal `bazel_dep` version in generated `MODULE.bazel` SHALL be treated as a
requested version subject to Minimal Version Selection, not as a final resolution.
Source generation SHALL NOT run Bazel or fabricate `MODULE.bazel.lock`. The authorized
Bazel builder SHALL resolve dependencies in an external projection, preserve the
generated source bytes, capture the public lock, raw public module graph, and raw public
repository evidence, independently derive the normalized dependency observation from
those bytes, and replay the build with lockfile error mode before tests.

#### Scenario: A ruleset introduces transitive build dependencies

- **WHEN** generated `MODULE.bazel` declares a supported literal `bazel_dep`
- **THEN** the source SBOM records the direct requested module and marks only the
  unresolved third-party closure incomplete
- **AND** the resolved SBOM contains every selected module and dependency edge from
  the authorized Bazel evidence before generated or acceptance tests execute
- **AND** Bazel writes no lock, output, cache, or convenience symlink into the
  admitted generated source tree
