---
name: "portable-application-implementation"
description: "Portable application implementation. Use for Literate AI workflow tasks."
metadata:
  author: "Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>"
schema: "urn:literate-ai:schema:v1:specification-to-source-skill"
skill_id: "portable-application-implementation"
version: "1.8.4"
title: "Portable application implementation"
stages:
  - "generate"
dependencies:
  - schema: "urn:literate-ai:schema:v1:skill-reference"
    skill_id: "portable-specification-planning"
    version: "1.1.0"
    identity:
      schema: "urn:literate-ai:schema:v1:content-identity"
      algorithm: "sha256"
      digest: "7bfdd0ddf52d2ddf5d6ac5ed6536b999da474323978937e72f4e4d3b1dface38"
limitations:
  - "Do not hard-code the acceptance input or its expected result."
  - "Do not download dependencies, invoke package managers, or read another source tree."
  - "Do not write plans, caches, binaries, or prose into the generated source tree."
  - "Do not scatter fungible generated application source at the host repository root or treat _build as mandatory for load-bearing project authority."
  - "Do not read, preserve, or treat a prior generated test manifest as authoritative, and do not turn generated implementation tests into acceptance evidence or a verifier oracle."
  - "Do not read the request from standard input or emit logs or presentation text alongside the single JSON result."
  - "Do not place any generated source file in a directory whose name source indexers conventionally ignore: build, dist, out, target, obj, bin, coverage, vendor, node_modules, or any dot-prefixed cache directory. Name a directory holding generated helper source for its role instead, such as source/tools/ or source/scripts/."
  - "Do not expand the framework-supplied LITAI_LANGUAGE_TOOL unquoted in a generated Make recipe; invoke it as the exact double-quoted `\"$(LITAI_LANGUAGE_TOOL)\"` executable token."
trust: "repository-reviewed"
---
# Portable application implementation

Implement the approved plan as a complete, deterministic application using only the selected Flavor requirements and explicitly allowed dependencies. Treat `acceptance/execution.json` as public interface authority: implement its entrypoint, positional argument array, nested argument shapes, and complete result shape exactly, while treating its concrete invocation values as verifier-owned values that must not appear in generated implementation tests. Keep platform-neutral behavior in portable code, compute results from runtime arguments, emit the exact specified JSON-compatible result, and keep fungible generated application source beneath the required `source/` directory of the generation workspace (see `repository-layout` for the advisory-cache-prefix rule governing `BUILD_DIR`/`_build`).
For every major rebuild, generate a fresh disposable implementation-test manifest at source/tests/manifest.json using schema urn:literate-ai:schema:v1:generated-test-suite. Bind it to the exact recipe_identity and generation_mode major-rebuild; generate 3 through 256 cases with unique case_id and arguments values; include example, boundary, and invariant categories; give every case exactly case_id, category, specification_refs, arguments, and expected_result; and cite only current non-acceptance recipe documents. Write the manifest as compact canonical JSON with lexicographically sorted object keys and no insignificant whitespace. Canonical JSON v1 forbids floating-point numbers at every depth: represent a fractional domain value as a decimal string, or as an integer with a scale defined by a cited specification, without rounding or changing its semantics.
Each specification_refs entry is one of those document paths copied byte for byte, never a path decorated with a heading anchor, section title, requirement ID, line number, or #fragment, and never a requirement name standing in for its document path. Derive expected results from those cited specifications and use argument vectors distinct from every acceptance/execution.json invocation. Every manifest case must have a corresponding language-native behavior test which invokes the application logic with the same arguments and asserts the same complete expected result. Make every such native test reachable from the generated build system's ordinary test target, including bazel test //... when Bazel is selected. Recalculate every manifest expectation independently before encoding it in both places.
Never read, embed, include, or parse the manifest from application or test code at compile time or runtime; it is lifecycle metadata, while the matching native tests are executable evidence.

The runnable artifact SHALL take exactly one command-line argument: a complete UTF-8 JSON array of the application's arguments, and SHALL spread that array's elements as the application's positional arguments. A specification describing "one JSON object as its first argument" therefore receives `[{...}]` on the command line and passes the single object through, rather than receiving the bare object. This is the same contract the independent acceptance verifier uses to invoke the built artifact, so an implementation that accepts the bare object will pass its own generated tests and still fail acceptance. In a composite application, this wrapper belongs only at the externally invoked artifact boundary. An internal role invoked by the trusted host runner SHALL parse exactly the role-specific value that the Component contract says the runner passes;
for example, a frontend receiving a canonical backend object as its sole application argument parses that bare object and MUST NOT require or unwrap an additional JSON array. Give the runnable artifact two framework-owned, non-product modes before normal JSON argument parsing. `--litai-test` SHALL run every current generated native behavior case and emit exactly `{"schema":"literate-ai/generated-test-results@1","cases":[...]}` with one unique `{"case_id":"...","outcome":"passed"}` entry for every and only manifest case; a failed case SHALL exit nonzero and never be reported as passed. `--litai-smoke` SHALL execute one current non-acceptance generated example through the real application logic and emit its ordinary JSON result. Runtime-dependency capabilities (the `LITAI_CAPABILITY_*` bindings for `dependency_kind: runtime` edges) are not guaranteed to be bound during `--litai-test`;
the Standard lifecycle binds them when it executes `--litai-smoke` with the real providers running. Generated tests SHALL therefore be hermetic: exercise the consumer's logic against an in-test stub of the provider's public process contract, and never require, locate, or launch the real provider or read its capability variable. Keep the mode dispatcher thin, delegate to generated test code rather than reading the manifest, and do not expose either mode as product behavior. These modes let the Standard lifecycle test and execute the built artifact after source custody is gone without turning verifier data into generated authority.

When Bazel and Rust are selected, every generated `rust_binary`, `rust_library`, and `rust_test` rule SHALL declare `srcs` as an inline string-list literal. Do not assign the source list to a Starlark variable, use `glob()`, concatenate expressions, or otherwise make `srcs` indirect. Include the crate root and every statically named `mod` or `#[path]` source reachable from it in each compiling rule's literal `srcs` list so the framework can prove the complete sandbox input closure before admitting the candidate. When that list names more than one Rust file, also set `crate_root` explicitly (for example `crate_root = "main.rs"`); the framework rejects a multi-file rule whose root Bazel cannot infer.

Every file written into `source/` is indexed as generated source before the build is
authorized. Source indexers skip directories whose names conventionally hold derived
output — `build`, `dist`, `out`, `target`, `obj`, `bin`, `coverage`, `vendor`,
`node_modules`, and dot-prefixed caches — so a generated file placed in one is declared
by the source tree but never indexed, and the lifecycle fails closed before it builds.
Name a directory for the role its contents play, not for the phase that consumes them:
put a generated bundler, packager, or cleanup helper under `source/tools/` or
`source/scripts/`, never `source/build/`. This constrains only where generated *source*
lives; the build may still write its derived artifacts to `OBJECT_ROOT`/`OUT` beneath
`_build`.

When the selected build system emits a Makefile, treat `LITAI_LANGUAGE_TOOL` as one
opaque executable path supplied by the framework. Every recipe or helper invocation of
that tool must begin with the exact double-quoted expansion
`"$(LITAI_LANGUAGE_TOOL)"`; never emit an unquoted `$(LITAI_LANGUAGE_TOOL)` command.
This common portable-application rule applies to every language descendant because a
framework-selected executable may contain spaces on Windows even when the generator's
local default is a single command word.
