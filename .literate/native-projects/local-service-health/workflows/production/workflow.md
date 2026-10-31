---
schema: "literate-ai/generation-workflow-markdown@1"
workflow_id: "production"
version: "1.0.0"
extends: "production/staging/workflow.md"
stages:
  - stage_id: "generate"
    kind: "model"
    dependencies:
      - "review"
    response_schema_name: "source_tree"
    content_kind: "source"
    required_capabilities:
      - "structured-output"
      - "source-generation"
    produces_tree: true
    maximum_output_tokens: 120000
---
# Production

The strictest, release-authorizing named workflow. It extends `staging` and tightens
the generate token bound further. Pair it with `routing/production/routing.json`.

## Stage: generate

Generate the complete source tree for the exact approved plan and recipe.
