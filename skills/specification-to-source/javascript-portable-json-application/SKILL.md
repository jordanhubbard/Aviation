---
name: "javascript-portable-json-application"
description: "JavaScript portable JSON application. Use for Literate AI workflow tasks."
metadata:
  author: "Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>"
schema: "urn:literate-ai:schema:v1:specification-to-source-skill"
skill_id: "javascript-portable-json-application"
version: "1.4.10"
title: "JavaScript portable JSON application"
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
  - "Do not declare or depend on an npm package unless the `package-npm` Flavor is selected. Without that Flavor, use only Node.js built-in modules; with it, use only the exact package closure admitted by `javascript-ecosystem`."
  - "Do not detect, install, or update Node.js, npm, package dependencies, or any other host tool during generation; tool discovery and dependency replay belong only to the authorized lifecycle."
  - "Do not use network access, standard input, a shell, eval, dynamic code loading, timers, locale-sensitive ordering, or operating-system-specific APIs."
  - "Do not emit logs or presentation text alongside the single JSON result on standard output."
  - "Do not embed acceptance-oracle values or special-case known invocation payloads."
  - "Do not import a generated sibling file through a bare specifier such as `main` or `litai_main_module`. A bare specifier names an npm package and resolves from node_modules; every generated local module must be imported through an explicit relative path with its file extension, such as `./main.js` or `./tests/litai_test.js`."
  - "Do not complete generation after only a direct-source `--litai-test` when the deliverable is a single-file bundle; the bundled artifact must also pass `--litai-test` and `--litai-smoke` with non-empty JSON."
trust: "repository-reviewed"
---
# JavaScript portable JSON application

Implement the selected JavaScript Flavor as direct, auditable JavaScript for Node.js 20 or newer. Without `package-npm`, use built-in modules only. With `package-npm`, use a package only when the exact manifest, complete matching lockfile, and CycloneDX source SBOM describe the same enumerated dependency closure and the authorized lifecycle admits that closure; never invent package or lockfile authority. Unless the Component declares a role-specific path, write the complete application to source/main.js and put the native generated-test implementation at source/tests/litai_test.js. Dispatch the Standard `--litai-test` and `--litai-smoke` modes before parsing exactly one UTF-8 JSON array containing the application arguments from process.argv[2]; keep the test implementation independent of source/tests/manifest.json. Validate every shape used by the specification, compute with deterministic integer and string semantics, and write exactly one JSON result to standard output. When a Component explicitly declares a multi-toolchain frontend role, honor its source path and CLI contract exactly; use child_process.spawnSync without a shell when that contract requires invoking a separately compiled backend, validate the backend exit status and JSON response, and keep application arguments distinct from infrastructure paths. Keep all ordering explicit before JSON.stringify and report exceptional failures only on standard error.

When a Component requires Unicode code-point ordering, do not use default `sort`, `<`,
`>`, or `localeCompare`: JavaScript's relational/default-sort behavior compares UTF-16
code units, while `localeCompare` is locale-sensitive. Implement an explicit comparator
that iterates complete code points, compares each `codePointAt(0)` integer, and places a
shorter exhausted sequence before its longer prefix extension. Use that same comparator
for output ordering and minimum/maximum tie-breaks. Add a generated native test whose
operands distinguish the domains—for example, U+E000 must sort before U+1F600 (`😀`) by
code point even though JavaScript's default UTF-16 comparison orders them oppositely.

For a dependency-free composition without `package-npm`, run `node source/main.js --litai-test` directly before completing generation, then build the selected single-file artifact and run `node --check` plus the bundled `--litai-test` and `--litai-smoke` commands. `--litai-test` must emit `literate-ai/generated-test-results@1` with at least one case; `--litai-smoke` must emit JSON. Do not first search for, locate, probe, or install Node.js; the lifecycle supplies and authorizes the toolchain. Repair until those commands succeed. Materialize every `require` match before recursing in a generated bundler — do not share a `/g` regular expression across recursive `collect()` calls. Strip leading shebangs from wrapped module bodies so the artifact begins with exactly one process shebang. Dispatch the exported CLI after registry load; `require.main === module` is false inside `__litaiRequire`. When `package-npm` is selected, do not run a package manager or install dependencies during generation; the lifecycle validates and replays the exact lock before its build and test phases. A generation-time self-check never weakens, replaces, or bypasses a later lifecycle phase.

Import every generated sibling module through an explicit relative specifier that
includes the file extension — `./main.js`, `./tests/litai_test.js` — never a bare
specifier. Node resolves a bare specifier such as `main` or `litai_main_module` from
`node_modules`, so it both fails at runtime for a dependency-free application and is
reported as an undeclared external package by the dependency evidence the lifecycle
requires before it will authorize a build.
