---
name: "swift-portable-json-application"
description: "Swift portable JSON application. Use for Literate AI workflow tasks."
metadata:
  author: "Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>"
schema: "urn:literate-ai:schema:v1:specification-to-source-skill"
skill_id: "swift-portable-json-application"
version: "1.0.6"
title: "Swift portable JSON application"
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
  - "Use only the Swift standard library; do not require Foundation, SwiftPM, third-party packages, or platform-specific APIs."
trust: "repository-reviewed"
---
# Swift portable JSON application

Implement the selected Swift Flavor as direct, auditable source rooted at
`source/main.swift` and compilable by one `swiftc` invocation. Put generated runtime
tests at `source/tests/litai_test.swift` and dispatch the Standard `--litai-test` and
`--litai-smoke` modes before normal argument parsing. Use only the Swift standard
library. Read one complete UTF-8 JSON arguments array from `CommandLine.arguments[1]`,
validate all specified shapes and invariants, perform the general computation, and
write exactly one deterministic JSON value plus a newline to standard output. Implement
the required JSON parser and escaping locally with correct Unicode escape-pair,
integer-bound, nesting, and trailing-input handling. Write concise failures only to
standard error and exit nonzero.

Keep every API available without importing Foundation. In particular, decode UTF-8 byte
collections with `String(decoding: bytes, as: UTF8.self)` when replacement is acceptable,
or `String(validating: bytes, as: UTF8.self)` when invalid UTF-8 must be rejected. Do not
emit Foundation-only `String(bytes:encoding:)` calls. When assembling generated-test JSON,
concatenate the `outcomes.joined(separator: ",")` value between literal prefix and suffix
strings; do not escape the separator literal inside string interpolation. Compile
`source/main.swift` together with `source/tests/litai_test.swift` using the selected
`swiftc` realization before returning the tree.

Treat toolchain installation as selected realization policy, not source-generation
policy. For missing prerequisites, defer to <https://www.swift.org/install/macos/>,
<https://www.swift.org/install/linux/>, or
<https://www.swift.org/install/windows/> according to the locked OS/toolchain pair.
