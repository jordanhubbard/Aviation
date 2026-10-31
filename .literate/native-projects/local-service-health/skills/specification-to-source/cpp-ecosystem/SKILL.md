---
name: "cpp-ecosystem"
description: "Conventional C++ public-header and private-source layout."
metadata:
  author: "Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>"
schema: "urn:literate-ai:schema:v1:specification-to-source-skill"
skill_id: "cpp-ecosystem"
version: "1.0.0"
title: "C++ ecosystem layout"
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
  - "Keep compiler products, generated headers, and package-manager caches outside admitted source."
  - "Do not encode a build-system Flavor choice inside include paths or package metadata."
trust: "repository-reviewed"
---
# C++ ecosystem layout

Keep public headers under `include/<project>/`, private implementation under `src/`,
tests under `tests/`, and optional hosted tools under `tools/`. Generated headers
belong in `OBJ_DIR` or another disposable projection, never next to authored public
headers. Package metadata stays build-system-neutral so Make, CMake, or Bazel can
compose without rewriting include roots.

Treat object files, static/shared libraries, compiler caches, and Conan/vcpkg
install trees as derived state under `OBJ_DIR`. Do not commit them as generated
source. Public headers that form a Component interface stay in admitted source;
preprocessed or configure-time headers do not.
