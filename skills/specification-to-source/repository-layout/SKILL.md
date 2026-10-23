---
name: "repository-layout"
description: "Portable repository layout. Use for Literate AI workflow tasks."
metadata:
  author: "Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>"
schema: "urn:literate-ai:schema:v1:specification-to-source-skill"
skill_id: "repository-layout"
version: "1.1.0"
title: "Portable repository layout"
stages:
  - "plan"
  - "generate"
dependencies: []
limitations:
  - "Do not move Component specifications, Flavors, skills, workflows, routing, locks, or durable evidence into generated-source or build-output directories."
  - "Do not treat _build or BUILD_DIR as a mandatory cage for load-bearing project authority; those prefixes are the advisory default for fungible generated application source and disposable objects."
  - "Do not copy package-manager dependency trees, compiler objects, executables, caches, or generated source into authored source directories."
  - "Do not impose one language ecosystem's directory names when its selected native tooling has a stronger established convention."
trust: "repository-reviewed"
---
# Portable repository layout

Give every file one clear authority and lifecycle. Keep human-authored project explanation
and conventional build metadata at the repository root; product implementation beneath a
language-appropriate source root; tests beneath a distinct test root unless the native
ecosystem requires colocated tests; maintenance entrypoints beneath `scripts/`; reusable
developer tooling beneath `tools/`; and durable documentation beneath `docs/`.

In a Literate AI project, retain `components/`, `flavors/`, `skills/`,
`workflows/`, and `routing/` as first-class authored authority. `BUILD_DIR` (default
`generated/`) is the **advisory default prefix** for **fungible generated application
source**: product Component output that may be deleted and regenerated. `_build/` is the
project-local default `OBJ_DIR` for disposable objects, executables, package-manager
installation trees, compiler caches, staging directories, coverage products, and
temporary reports. Those prefixes are not mandatory for load-bearing project authority.
Component specifications, Flavors, skills, workflows, routing, locks,
`literate.project.json`, and the Makefile of a self-modifying project remain first-class
authored paths. Literate AI itself and any project that modifies itself may change those
load-bearing paths outside `_build` and `BUILD_DIR`. Generated Component application
source for a product Component still belongs in the `BUILD_DIR` cache tree (with its
admitted `source/` generation workspace), not scattered as a second source of truth at
the repository root. Generated source and object output are siblings, never nested into
authored specifications. Ensure Git and source-intelligence inventories exclude
`OBJ_DIR`; `clean` may remove it in full, while `really-clean` may additionally remove
`BUILD_DIR`.

Prefer the selected ecosystem's package manager and manifest locations, but configure
their downloaded dependencies, build roots, and caches beneath `OBJ_DIR` whenever the
ecosystem permits it. Do not add wrapper directories without an ownership or lifecycle
boundary they can explain. Keep the root orientation surface small enough that a new
human or coding agent can distinguish product authority, framework authority, tooling,
and disposable state without opening implementation files.

Treat every environment installed or mutated by Literate AI or a coding agent as
session-scoped disposable state. Place it beneath
`OBJ_DIR/<tool-kind>/<validated-session-id>` (or the ecosystem's equivalent inside
`OBJ_DIR`), propagate the same session identity through child build commands, and never
let parallel sessions share a mutable environment. A conventional root `.venv` may be
used only when the operator explicitly owns and selects it; framework bootstrap, tests,
and generated build rules must not create, replace, clean, or install into it.
Make ordinary `clean` preserve the session-environment root while removing compiler and
artifact state. Reserve removal of all session environments for an explicitly exclusive
`really-clean` operation; never run that operation alongside another active session.
