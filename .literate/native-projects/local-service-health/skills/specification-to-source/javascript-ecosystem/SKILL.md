---
name: "javascript-ecosystem"
description: "Conventional JavaScript package layout and dependency authority."
metadata:
  author: "Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>"
schema: "urn:literate-ai:schema:v1:specification-to-source-skill"
skill_id: "javascript-ecosystem"
version: "1.0.1"
title: "JavaScript ecosystem layout"
stages:
  - "plan"
  - "generate"
dependencies:
  - schema: "urn:literate-ai:schema:v1:skill-reference"
    skill_id: "repository-layout"
    version: "1.1.0"
    identity:
      schema: "urn:literate-ai:schema:v1:content-identity"
      algorithm: "sha256"
      digest: "39f0145075f349d8dac3bf0f00484c73a8588a3e9f3dd983240bac5dc4854a33"
limitations:
  - "Keep node_modules, coverage output, and package-manager caches outside generated source under framework-owned object storage."
  - "Do not use a package unless an exact package.json manifest, its complete matching package-lock.json, and the CycloneDX source SBOM describe the same dependency closure and the authorized lifecycle admits it."
  - "Do not detect, install, or update Node.js, npm, package dependencies, or any other host tool during generation; tool discovery and lockfile replay belong only to the authorized lifecycle."
  - "Do not treat an unpinned registry range, an incomplete lockfile, or invented lockfile bytes as admitted dependency authority."
trust: "repository-reviewed"
---
# JavaScript ecosystem layout

This skill is the technique for the `package-npm` Flavor (`packaging=npm`). Select it
only with `lang-javascript`.

Use a conventional Node package: `package.json` at the package root, implementation
beneath `src/`, tests beneath `tests/` or `src/**/*.test.js` only when the Component
already requires co-located tests, and a complete `package-lock.json` beside the
manifest. Honor workspace boundaries when the Component is a workspace member; do
not flatten workspace packages into one directory merely to make generation
convenient.

Declare or use a package only when selected recipe authority establishes the exact
manifest and complete matching lockfile. Do not invent, derive, update, or repair
lockfile bytes during generation. Enumerate the same direct and transitive package
closure in the required CycloneDX source SBOM. The model emits only this source
authority: it never searches for tools, probes versions, runs a package manager, or
installs dependencies. The authorized lifecycle alone detects the selected Node.js
and npm toolchain, validates the manifest-lock-SBOM agreement, and replays the exact
lock (`npm ci` or equivalent) into `OBJ_DIR` before build and test. It fails closed
before package use when any of those inputs is missing, incomplete, mismatched, or
unauthorized.

Treat `node_modules`, npm/pnpm/yarn caches, coverage output, and bundler intermediates
as derived state. Project them under `OBJ_DIR`; never admit them as generated-source
authority. Do not copy `node_modules` into a source cache or a committed sample tree.
