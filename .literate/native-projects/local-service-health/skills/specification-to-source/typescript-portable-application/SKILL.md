---
name: "typescript-portable-application"
description: "TypeScript portable JSON application. Use for Literate AI workflow tasks."
metadata:
  author: "Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>"
schema: "urn:literate-ai:schema:v1:specification-to-source-skill"
skill_id: "typescript-portable-application"
version: "1.0.2"
title: "TypeScript portable JSON application"
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
  - "Do not use npm packages, network access, standard input, a shell, eval, dynamic code loading, timers, locale-sensitive ordering, or operating-system-specific APIs."
  - "Do not emit logs or presentation text alongside the single JSON result on standard output."
  - "Do not embed acceptance-oracle values or special-case known invocation payloads."
  - "Do not import a generated sibling file through a bare specifier. Every generated local module must be imported through an explicit relative path with its file extension, such as `./main.ts` or `./tests/litai_test.ts`."
trust: "repository-reviewed"
---
# TypeScript portable JSON application

Implement the selected TypeScript Flavor as direct, auditable TypeScript for Node.js 20
or newer using built-in modules only. Unless the Component declares a role-specific
path, write the complete application to source/main.ts and put the native generated-test
implementation at source/tests/litai_test.ts. Dispatch the Standard `--litai-test` and
`--litai-smoke` modes before parsing exactly one UTF-8 JSON array containing the
application arguments from process.argv[2]; keep the test implementation independent of
source/tests/manifest.json. Validate every shape used by the specification, compute with
deterministic integer and string semantics, and write exactly one JSON result to
standard output.

Before completing generation, locate `npx` or `tsc` on `PATH` and run `tsc --noEmit`
against the generated tree, then run `node --experimental-strip-types source/main.ts
--litai-test` (or an equivalent TypeScript-capable Node invocation) directly. Repair the
implementation and generated-test protocol until that command exits successfully and
reports every selected case exactly once. Treat this as a generation-time self-check
only; do not weaken, replace, or bypass any later lifecycle phase.

Import every generated sibling module through an explicit relative specifier that
includes the file extension — `./main.ts`, `./tests/litai_test.ts` — never a bare
specifier.
