---
name: "legacy-project-shim"
description: >
  Generate and maintain wrappers around a Phase 1-qualified legacy project pipeline.
  Use only during literate-ai project adoption.
metadata:
  author: "Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>"
schema: "urn:literate-ai:schema:v1:specification-to-source-skill"
skill_id: "legacy-project-shim"
version: "1.0.0"
title: "Legacy project pipeline shim"
stages:
  - "generate"
dependencies: []
limitations:
  - "Invoke only commands recorded in .literate/harness-inventory.json."
  - "Never weaken or skip a baseline stage; missing stages must fail loudly."
  - "Do not delete quarantined source before Phase 1.2 parity is recorded."
trust: "repository-reviewed"
---
# Legacy project pipeline shim

Treat the recorded command, evidence path, exit status, log digests, and resulting
tree identity as the wrapper contract. Generate only delegation glue; do not replace
legacy implementation behavior during Phase 1.1.
