---
name: "backend-application"
description: "Fundamental back-end generation indexed off selected language Flavors. Use for Literate AI workflow tasks that select a server-side parent skill. Nested Python and Rust skills own ecosystem chapters."
metadata:
  author: "Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>"
schema: "urn:literate-ai:schema:v1:specification-to-source-skill"
skill_id: "backend-application"
version: "1.0.0"
title: "Back-end application generation"
stages:
  - "plan"
  - "generate"
dependencies: []
limitations:
  - "Do not apply a language ecosystem chapter unless that language Flavor is selected."
  - "Do not invent a `lang-elixir` Flavor from this skill; missing Elixir is a named skip."
  - "Do not call an expensive upstream source from a request path; only a scheduled worker or equivalent background job may talk to that source."
  - "Do not treat in-page WebMCP as this parent. WebMCP inherits the MCP protocol parent; this parent owns server-side MCP and service ecosystems."
trust: "repository-reviewed"
---
# Back-end application generation

Generate a long-running back-end composed of cooperating parts that share one
codebase and one local store: an HTTP API, an embedded MCP server, and a scheduled
worker when the specification asks for them. Nested language skills are deltas of
this parent. MCP tool/resource/schema/error rules live in the MCP parent; this
parent owns process shape, store ownership, and Flavor-indexed ecosystems.

## Flavor index

Python, Rust, and Elixir guidance is indexed off selected Flavors:

- When `lang-python` is selected, apply the nested `python-service-application`
  ecosystem (ASGI, typed models, embedded MCP transport, worker isolation).
- When `lang-rust` is selected, apply the nested `rust-service-application`
  ecosystem (async service, explicit errors, no extra crates unless specified).
- When `lang-elixir` is selected, apply the Elixir ecosystem chapter. If that
  Flavor is not in the catalog, record skip/unavailable for Elixir and continue;
  do not crash and do not author a Flavor here.

Unselected language ecosystems are omitted from the recipe. Nested skills must not
repeat this index rule.

## Process and store

Each part is a distinct entrypoint. The HTTP API and embedded MCP server answer
from the local store at request time. Prefer an embedded database unless the
specification requires concurrent multi-process writers. The worker is the store's
only writer when it exists, runs on the specification's schedule, isolates
per-unit failure, and records run outcome so readers can report staleness.

## MCP leaf

Embedded application MCP is server-side (stdio for one local client, HTTP/SSE for
concurrent callers). Inherit the MCP parent for tools versus resources, schema
validation, structured errors, identity pins, and secret rejection. Do not copy
those rules into a nested language skill.
