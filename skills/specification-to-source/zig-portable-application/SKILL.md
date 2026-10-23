---
name: "zig-portable-application"
description: "Zig portable JSON application. Use for Literate AI workflow tasks."
metadata:
  author: "Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>"
schema: "urn:literate-ai:schema:v1:specification-to-source-skill"
skill_id: "zig-portable-application"
version: "1.0.2"
title: "Zig portable JSON application"
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
  - "Do not create a build.zig.zon, fetch a package, use libc unless the specification requires it, or any import outside the Zig standard library."
  - "Do not omit source/tests/litai_test.zig from any build target that compiles the entrypoint."
trust: "repository-reviewed"
---
# Zig portable JSON application

Implement the selected Zig Flavor as straightforward, auditable Zig source rooted at
`source/main.zig`, compilable by one direct `zig build-exe source/main.zig
-femit-bin=run` invocation with no package manager. Put the native generated-test
implementation at `source/tests/litai_test.zig` and dispatch the Standard `--litai-test`
and `--litai-smoke` modes before ordinary argument parsing without reading
`source/tests/manifest.json`.

`portable-application-implementation` fixes the general argument contract (one JSON
array argument). In Zig terms: parse `std.os.argv[1]` as JSON — never the raw argument
slice, which still carries the program name at index 0.

Read that one complete UTF-8 JSON arguments array from the first argument, validate
every shape and domain invariant used by the specification, perform the general
computation rather than matching examples, and write exactly one deterministic JSON
value plus a trailing newline to standard output. Keep output field ordering explicit.

Before completing generation, locate `zig` on `PATH` and compile plus run the generated
`--litai-test` mode. Repair until that command exits successfully. Treat this as a
generation-time self-check only.
