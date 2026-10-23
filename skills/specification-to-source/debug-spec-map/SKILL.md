---
name: "debug-spec-map"
description: "Debug spec-to-source mapping anchors. Use when Literate AI --debug is on during generation so public entrypoints and specified behavior blocks carry litai:spec PATH:LINE comments."
metadata:
  author: "Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>"
schema: "urn:literate-ai:schema:v1:specification-to-source-skill"
skill_id: "debug-spec-map"
version: "1.0.0"
title: "Debug spec-to-source mapping"
stages:
  - "generate"
dependencies: []
limitations:
  - "Do not print spec maps on standard output; the product JSON result stays on stdout."
  - "Do not invent generated line numbers; the framework scanner records those."
  - "Do not emit a map for every field or loop iteration; public entrypoints, specified behavior blocks, and error paths only."
trust: "repository-reviewed"
---
# Debug spec-to-source mapping

When debug instrumentation is requested, place a `litai:spec PATH:LINE [kind]`
anchor in a language comment immediately above each public entrypoint and each
specified behavior block. PATH is the Component-relative specification file
(for example `samples/hello-component/component.md`). LINE is the 1-based line
of the requirement in that file, copied from the specification in this prompt.
kind is `entrypoint`, `behavior`, or `error`. Do not invent line numbers for
generated code — the framework scanner records those. Do not print these maps
on standard output; the product JSON result stays on stdout. Runtime tracing
is env-gated (`LITAI_DEBUG`) and belongs on stderr only.
