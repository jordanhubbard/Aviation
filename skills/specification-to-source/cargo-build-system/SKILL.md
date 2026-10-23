---
name: "cargo-build-system"
description: "Cargo build-system generation for locked Rust applications."
metadata:
  author: "Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>"
schema: "urn:literate-ai:schema:v1:specification-to-source-skill"
skill_id: "cargo-build-system"
version: "1.0.1"
title: "Cargo build-system generation"
stages:
  - "generate"
dependencies: []
limitations:
  - "Generate source/Cargo.toml but never Cargo.lock; the authorized lifecycle derives and freezes the lock in an external build projection. Never write Cargo target output into the generated source tree."
  - "Use only registry dependencies with exact checksums in Cargo.lock; path, Git, workspace, build, target-specific, and development dependencies are outside this profile."
  - "Name the binary litai_artifact and retain the exported runtime --litai-test and --litai-smoke modes; do not rely on cargo test for Standard acceptance."
  - "Do not weaken --locked or mutate the framework-derived Cargo.lock after dependency resolution."
trust: "repository-reviewed"
---
# Cargo build-system generation

Treat Cargo as the selected build system for the Rust Component. Generate a conventional
package rooted at `source/Cargo.toml`, with Rust sources beneath `source/src/` and one
`[[bin]]` named `litai_artifact`. Do not write `source/Cargo.lock`; declare registry intent
in the manifest and source SBOM, and let the authorized lifecycle generate the complete
lock in a disposable build projection. Keep the package compatible with
`cargo metadata --locked --format-version=1` and
`cargo build --locked --bin litai_artifact` after that resolution.

The framework supplies `CARGO_TARGET_DIR` outside the admitted generated tree. Do not set
a target directory in project configuration, vendor package caches into source, add path
or Git dependencies, or run a command that rewrites the lock. The produced binary is the
Standard artifact and must implement `--litai-test` and `--litai-smoke`; this bounded
executable profile does not require a separate `cargo test` invocation. For a
`kind: library` Component, the package is the exported artifact and the binary is
its attributable test driver. Its generated targets must also pass
`cargo test --locked --all-targets` before the Standard `--litai-test` check;
passing native targets is additional evidence, not independent library acceptance.
