---
name: "rust-portable-json-application"
description: "Rust portable JSON application. Use for Literate AI workflow tasks."
metadata:
  author: "Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>"
schema: "urn:literate-ai:schema:v1:specification-to-source-skill"
skill_id: "rust-portable-json-application"
version: "1.4.4"
title: "Rust portable JSON application"
stages:
  - "generate"
dependencies:
  - schema: "urn:literate-ai:schema:v1:skill-reference"
    skill_id: "portable-application-implementation"
    version: "1.8.4"
    identity:
      schema: "urn:literate-ai:schema:v1:content-identity"
      algorithm: "sha256"
      digest: "55dece8843519c6ced884d7cd9eb5d8bff04ebccef055c74c5bfcf176ccd06cd"
limitations:
  - "Without the selected Cargo build-system Flavor, do not use third-party crates, Cargo, build scripts, proc macros, unsafe Rust, or operating-system-specific APIs. With Cargo selected, defer package layout and registry dependency rules to its exact skills."
  - "Do not place the generated runtime test module behind #[cfg(test)], and do not omit source/tests/litai_test.rs from any Bazel target that compiles the crate root which includes it."
trust: "repository-reviewed"
---
# Rust portable JSON application

Implement the selected Rust Flavor as straightforward, auditable Rust 2021 source. Without a selected build-system Flavor, root it at source/main.rs and keep it compilable by one direct rustc invocation. With Cargo selected, use its conventional source/src/main.rs package layout and locked registry dependency rules instead. Put the native generated-test implementation in the location required by the selected build profile, include it unconditionally from the application through an explicit path module, and dispatch the Standard `--litai-test` and `--litai-smoke` modes before ordinary argument parsing without reading source/tests/manifest.json. Do not use `#[cfg(test)]` for this module: the exported runtime artifact must contain it.
When Bazel is selected, list both `main.rs` and `tests/litai_test.rs` in every `rust_binary` or `rust_test` that compiles `main.rs`, set `crate_root = "main.rs"` explicitly on each such rule because Bazel cannot infer the root of a multi-file `srcs` list, and recursively declare any other module sources as well. Use conventional multiline rustfmt-style structure rather than minified one-line functions, and re-read the finished source for balanced delimiters, complete match arms, and valid character/string escapes. Without Cargo, use only the Rust standard library and do not create Cargo manifests, fetch crates, or depend on serde.
Read one complete UTF-8 JSON arguments array from argv[1], validate every shape and domain invariant used by the specification, perform the general computation rather than matching examples, and write exactly one deterministic JSON value plus a trailing newline to standard output. Implement the small JSON reader and string escaper required by the selected contract inside the generated source; correctly handle JSON whitespace, escapes, Unicode escape pairs, signed integer bounds, nested arrays and objects, and rejection of trailing input. Use owned String as the single error type across parser, environment, application, and main-result chains; convert borrowed literals and system errors explicitly before combining Result values with and_then or the question-mark operator. Keep output field ordering stable where the specification makes exact comparison observable.
Send concise failures only to standard error and exit nonzero.

For extrema with deterministic string tie-breakers, do not return nested borrowed keys from `min_by_key` or `max_by_key` closures. Compare entries explicitly with `min_by` or `max_by`, or return an owned cloned key, so closure lifetimes are independent and the same source compiles on every supported Rust toolchain.

Any helper function that takes more than one reference parameter and returns a borrowed value MUST name an explicit lifetime parameter (`fn f<'a>(x: &'a T, y: &'a U) -> &'a V`) rather than relying on elision; the compiler cannot infer which parameter the return value borrows from once there is more than one reference input, and this is rejected with E0106. Prefer returning an owned value instead of a lifetime-parameterized reference whenever the caller does not need zero-copy access.

For internal/private helper functions (not the Component's `main` entry point already covered by `source/tests/manifest.json`) with a non-obvious precondition, postcondition, or invariant relied on by a caller — one whose violation would produce silently wrong output rather than an obvious crash — add an `assert!`/`assert_eq!` at the point the condition must hold, with a message identifying which invariant failed (`assert!(idx < items.len(), "idx out of range in resolve_offset");`). Rust's `assert!` compiles unconditionally into both debug and release builds, so it is the correct default for an invariant whose violation must never silently ship; use `debug_assert!`/`debug_assert_eq!` instead only when the check is O(n) or worse relative to the function's own cost and the function sits on a hot path, since `debug_assert!` compiles out under a release (non-`debug_assertions`) build. Do not use either macro to validate data that originates outside the process (the JSON arguments array from argv[1], file contents) — that is an ordinary domain-invariant failure the function must already report through its `Result<_, String>` chain (per this skill's existing "validate every shape and domain invariant used by the specification" rule), not a programmer-error assertion. Do not add an assertion for an invariant the type system already enforces (e.g. a parameter typed `NonZeroUsize` needs no runtime nonzero check). Even when Cargo is selected, do not add a third-party assertion crate; use only `assert!`/`assert_eq!`/`debug_assert!`/`debug_assert_eq!` from the standard prelude. A contract assertion that panics during `source/tests/litai_test.rs` or `--litai-test` execution is an ordinary generated-test failure, not a new failure channel; repair it the same way any other failing manifest case is repaired before completing generation.
