---
schema: "literate-ai/generation-workflow-markdown@1"
workflow_id: "sample-host-e2e"
version: "1.0.0"
stages:
  - stage_id: "plan"
    kind: "model"
    dependencies: []
    response_schema_name: "sample_implementation_plan"
    content_kind: "metadata"
    required_capabilities:
      - "structured-output"
    produces_tree: false
    maximum_output_tokens: null
  - stage_id: "generate"
    kind: "model"
    dependencies:
      - "plan"
    response_schema_name: "sample_source_tree"
    content_kind: "source"
    required_capabilities:
      - "structured-output"
      - "source-generation"
    produces_tree: true
    maximum_output_tokens: null
  - stage_id: "validate"
    kind: "lifecycle"
    dependencies:
      - "generate"
    response_schema_name: ""
    content_kind: "metadata"
    required_capabilities: []
    produces_tree: false
    maximum_output_tokens: null
  - stage_id: "classify"
    kind: "lifecycle"
    dependencies:
      - "validate"
    response_schema_name: ""
    content_kind: "metadata"
    required_capabilities: []
    produces_tree: false
    maximum_output_tokens: null
  - stage_id: "authorize-build"
    kind: "lifecycle"
    dependencies:
      - "classify"
    response_schema_name: ""
    content_kind: "metadata"
    required_capabilities: []
    produces_tree: false
    maximum_output_tokens: null
  - stage_id: "build"
    kind: "lifecycle"
    dependencies:
      - "authorize-build"
    response_schema_name: ""
    content_kind: "metadata"
    required_capabilities: []
    produces_tree: false
    maximum_output_tokens: null
  - stage_id: "resolve-dependencies"
    kind: "lifecycle"
    dependencies:
      - "build"
    response_schema_name: ""
    content_kind: "metadata"
    required_capabilities: []
    produces_tree: false
    maximum_output_tokens: null
  - stage_id: "test-generated"
    kind: "lifecycle"
    dependencies:
      - "resolve-dependencies"
    response_schema_name: ""
    content_kind: "metadata"
    required_capabilities: []
    produces_tree: false
    maximum_output_tokens: null
  - stage_id: "verify-independent"
    kind: "lifecycle"
    dependencies:
      - "test-generated"
    response_schema_name: ""
    content_kind: "metadata"
    required_capabilities: []
    produces_tree: false
    maximum_output_tokens: null
  - stage_id: "prepare-tree"
    kind: "lifecycle"
    dependencies:
      - "verify-independent"
    response_schema_name: ""
    content_kind: "metadata"
    required_capabilities: []
    produces_tree: false
    maximum_output_tokens: null
  - stage_id: "commit-tree"
    kind: "lifecycle"
    dependencies:
      - "prepare-tree"
    response_schema_name: ""
    content_kind: "metadata"
    required_capabilities: []
    produces_tree: false
    maximum_output_tokens: null
---
# Sample Host E2E

This workflow defines the ordered model and guarded lifecycle stages.

## Stage: plan

Plan the exact implementation for the supplied specification and selected Flavor recipe.

## Stage: generate

Generate the complete source tree for the exact approved plan and recipe.
