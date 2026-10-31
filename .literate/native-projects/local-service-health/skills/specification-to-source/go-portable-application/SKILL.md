---
name: "go-portable-application"
description: "Go portable JSON application. Use for Literate AI workflow tasks."
metadata:
  author: "Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>"
schema: "urn:literate-ai:schema:v1:specification-to-source-skill"
skill_id: "go-portable-application"
version: "1.1.5"
title: "Go portable JSON application"
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
  - "Do not create a go.mod, fetch a module, use cgo, unsafe, build tags, or any package outside the Go standard library."
  - "Do not place the generated runtime test file behind a build tag, and do not omit source/tests/litai_test.go from any build target that compiles the entrypoint."
trust: "repository-reviewed"
---
# Go portable JSON application

Implement the selected Go Flavor as straightforward, auditable Go source rooted at
`source/main.go`, `package main`, compilable by one direct `go build source/main.go`
invocation with no `go.mod` and no import outside the standard library. Put the native
generated-test implementation at `source/tests/litai_test.go` as `package tests`,
include it unconditionally from the application through an explicit import, and dispatch
the Standard `--litai-test` and `--litai-smoke` modes before ordinary argument parsing
without reading `source/tests/manifest.json`. Do not gate this file behind a
`//go:build` tag: the exported runtime artifact must contain it.

`portable-application-implementation` fixes the general argument contract (one JSON
array argument, spread as positional arguments). In Go terms: parse `os.Args[1]` with
`encoding/json` — never the raw `os.Args` slice, which still carries the program name at
index 0 — and unwrap the array's first element when a specification describes "one JSON
object as the argument" rather than passing the array itself to object-field code.

Read that one complete UTF-8 JSON arguments array from `os.Args[1]`, validate every
shape and domain invariant used by the specification, perform the general computation
rather than matching examples, and write exactly one deterministic JSON value plus a
trailing newline to standard output using `encoding/json`. Keep output field ordering
stable where the specification makes exact comparison observable — use an ordered
struct with `json` tags rather than a bare `map[string]any` whenever field order is
externally observable. Send concise failures only to standard error and exit nonzero
via `os.Exit`.

Use only `errors`/`fmt`-wrapped standard-library error values; do not introduce a
third-party error-handling package. Keep every exported behavior traceable to the
selected specification; do not add defensive branches for scenarios the specification
does not describe.

For internal/private helper functions (not the Component's exported entry point already
covered by `source/tests/manifest.json`) with a non-obvious precondition, postcondition,
or invariant relied on by a caller — one whose violation would produce silently wrong
output rather than an obvious crash — check the condition explicitly at the point it must
hold and `panic()` with a message identifying which invariant failed
(`if idx >= len(items) { panic("resolveOffset: idx out of range") }`), matching Go's own
standard-library and style-guide convention that `panic` is reserved for programmer error
and broken invariants, not for ordinary or expected failure. Never use `panic` for data
that originates outside the process (the JSON arguments array from `os.Args[1]`, file
contents) or for any condition a caller could reasonably trigger and recover from — that
case must keep returning an `errors`/`fmt`-wrapped `error` value per this skill's existing
error-handling rule; reserve `panic` exclusively for conditions that indicate this
Component's own generated code has a bug, never for validating input. Do not add a check
for an invariant Go's type system already enforces structurally. Do not gate a contract
check behind a flag, build tag, or environment variable — an unreachable check provides no
evidence. A `panic` raised during `source/tests/litai_test.go` or `--litai-test` execution
is an ordinary generated-test failure, not a new failure channel; repair it the same way
any other failing manifest case is repaired before completing generation.
