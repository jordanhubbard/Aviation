---
name: "repo-man-build-system"
description: "NVIDIA repo_man build-entrypoint design. Use when wrapping or generating a repo_man pipeline."
metadata:
  author: "Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>"
schema: "urn:literate-ai:schema:v1:specification-to-source-skill"
skill_id: "repo-man-build-system"
version: "1.0.0"
title: "repo_man build-entrypoint design"
stages:
  - "generate"
dependencies: []
limitations:
  - "Invoke only build commands recorded in .literate/harness-inventory.json."
  - "Do not invent packman, premake, or repo.sh subcommands that were not recorded."
  - "Do not treat this Flavor as authority over an explicit Component specification."
  - "Do not fetch dependencies during source generation; the host-heavy repo_man build entrypoint is recorded, not executed, during convert unless --run-baseline."
trust: "repository-reviewed"
---
# repo_man build-entrypoint design

Treat a repository-owned platform `build.sh` / `build.bat` wrapper as the
operator-facing entrypoint when conversion records one for an NVIDIA repo_man root;
the wrapper may establish prerequisites before delegating to `repo.sh` / `repo.bat`.
Otherwise use the recorded repo_man driver. Explicit Component specification text
and selected Flavor requirements always take precedence.

When converting an existing repository, emit harness targets that `cd` into each
recorded project root and run that root's exact recorded build command. Nested
`kit`, `rendering`, and `runtime` repo_man roots are distinct stages, not one
flattened `make all`. When the inventory also records an undotted root `build`
stage, that root is the automatic baseline, parity, and retained-receipt authority:
record nested `build.*` stages as covered by it instead of independently executing
internal drivers after the root build. Keep every nested target manually callable in
`litai.harness.mk`. If there is no root build stage, execute each recorded nested
stage normally.

Do not generate a workspace-root Makefile that reimplements packman. The Standard
lifecycle may still generate disposable source under `source/`; that generated tree
is not the legacy `repo.sh` pipeline. Legacy operations stay behind `litai.harness.mk`.
