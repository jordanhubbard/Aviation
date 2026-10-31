---
name: "mix-build-system"
description: "Declarative Mix generation for locked Elixir applications and libraries."
metadata:
  author: "Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>"
schema: "urn:literate-ai:schema:v1:specification-to-source-skill"
skill_id: "mix-build-system"
version: "1.0.1"
title: "Mix build-system generation"
stages:
  - "generate"
dependencies: []
limitations:
  - "Never generate mix.exs, mix.lock, .iex.exs, or compiler output in source."
  - "Use only inert public Hex dependency intent; do not invoke Mix, fetch packages, or use Mix.install during generation."
  - "Never replace runtime-provided library artifacts with ambient or fetched modules."
trust: "repository-reviewed"
---
# Mix build-system generation

Generate `source/mix-project.json` with schema `literate-ai/mix-project@1`, one
lowercase application name, exact semantic version, description, license identifiers,
public metadata links, and dependencies containing only `name` and `requirement`.
The authorized lifecycle synthesizes executable Mix authority, acquires and freezes
the lock, and compiles in an external projection. Never generate that authority.

Keep `source/main.exs` as the generated-test launcher and, for applications, the
selected JSON entrypoint. Preserve `--litai-test` and `--litai-smoke`, exact integer
behavior, and the generated-test envelope. Put native ExUnit cases under
`source/test/`; both native tests and attributable generated tests must pass.

For libraries, place public `.ex` modules under `source/<locked-package>/` inside
the package namespace, and set the intent application name to that same package.
Implement every locked function or macro. Mix compiles the package closure in its
authorized projection and supplies the retained runtime code paths. In a Mix
library test launcher, call those compiled exports directly; do not compile or
require the package `.ex` files again. This overrides the default source-only
launcher compilation instruction. Keep test helpers separate from product
modules. Resolve providers from the exact recipe artifact roots. Retain the default
Elixir skill's request validation and output protocol; this selected build-system
skill supplies declarative Mix intent and enables only the reviewed Hex graph.
