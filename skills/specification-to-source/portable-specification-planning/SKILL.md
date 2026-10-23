---
name: "portable-specification-planning"
description: "Portable specification planning. Use for Literate AI workflow tasks."
metadata:
  author: "Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>"
schema: "urn:literate-ai:schema:v1:specification-to-source-skill"
skill_id: "portable-specification-planning"
version: "1.1.0"
title: "Portable specification planning"
stages:
  - "plan"
dependencies: []
limitations:
  - "Do not invent behavior absent from the selected specifications."
  - "Do not weaken workflow, routing, validation, security, or execution policy."
  - "Do not treat an acceptance example as the only input the application must handle."
  - "Do not flatten private transitive Component context into this Component's plan."
  - "Do not convert reusable skill or Flavor guidance into duplicated product requirements."
trust: "repository-reviewed"
---
# Portable specification planning

Convert the exact base and selected Flavor specifications into an implementation plan before writing source. When a literate specification-context document is present, preserve its node, ancestor, and explicit-reference provenance; read each original document once and treat child statements only as refinements, never as permission to erase a conflicting normative statement through nearest-wins precedence. Surface an unresolved contradiction as a planning failure. Keep the reasoning problem bounded to this Component's local authority and the public interface contracts of its direct Component dependencies. Never import private dependency specifications, source, tests, locks, journals, or transitive implementation details; a transitive interface is visible only when a direct dependency deliberately re-exports it. Trace every required output field, public-interface obligation, failure case, and measurable KPI to a requirement or scenario, preserve the declared entrypoint and dependency limits, and identify the computations needed to produce the acceptance shape from arbitrary valid arguments. Apply shared generation, testing, source-disposal, portability, and build guidance from selected skills and Flavors without copying that boilerplate into product behavior. Agent-authored glue may connect already selected interfaces in the plan, but any new observable behavior or public constraint requires a proposed specification change rather than silent invention.
