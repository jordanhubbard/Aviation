---
schema: "literate-ai/generation-workflow-markdown@1"
workflow_id: "staging"
version: "1.0.0"
extends: "production/staging/dev/workflow.md"
stages:
  - stage_id: "review"
    kind: "model"
    dependencies:
      - "plan"
    response_schema_name: "implementation_review"
    content_kind: "metadata"
    required_capabilities:
      - "structured-output"
    produces_tree: false
    maximum_output_tokens: null
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
    maximum_output_tokens: 200000
---
# Staging

The stricter, pre-release named workflow. It extends `dev`, inserts a non-tree
`review` model stage between plan and generate, and tightens generate tokens.
Pair it with `routing/production/staging/routing.json`.

## Stage: review

Review the exact implementation plan for completeness against the specification and
selected Flavor recipe before source generation.

## Stage: generate

Generate the complete source tree for the exact approved plan and recipe.
