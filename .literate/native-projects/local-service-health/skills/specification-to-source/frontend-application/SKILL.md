---
name: "frontend-application"
description: "Fundamental browser front-end generation in JavaScript. Use for Literate AI workflow tasks that build a page UI. Nested React and WebMCP skills are deltas of this parent."
metadata:
  author: "Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>"
schema: "urn:literate-ai:schema:v1:specification-to-source-skill"
skill_id: "frontend-application"
version: "1.1.0"
title: "Front-end application generation"
stages:
  - "plan"
  - "generate"
dependencies: []
limitations:
  - "Do not generate a front-end under a language Flavor other than JavaScript; a conflicting language Flavor fails closed."
  - "Do not import a generated sibling module through a bare specifier. A bare specifier names an npm package; every generated local module must be imported through an explicit relative path with its file extension."
  - "Do not declare or depend on any npm package unless the package-npm Flavor is selected. Without that Flavor this parent is dependency-free JavaScript; with it, follow javascript-ecosystem lockfile-pinned detect-before-install rules."
  - "Do not treat the portable JSON-in/JSON-out application ABI as the page contract. A browser UI is not a host argv JSON filter."
  - "Do not claim frontend completeness from source inspection, text-presence probes, or a render hash alone; emit browser-observable structure so an authorized verification stage can inspect the rendered page."
trust: "repository-reviewed"
---
# Front-end application generation

Generate a browser-facing front-end in JavaScript. This skill is the reusable UI
parent. Nested React skills add JSX, component structure, and view-state technique.
WebMCP is a nested realization of the MCP parent that also follows this parent: in-page
tools augment the human UI rather than replacing it.

## Language and Flavor

Select this parent only with `lang-javascript`. Selecting it without JavaScript, or
alongside a conflicting language Flavor as the only implementation language, is a
closed failure. React UI structure is an optional `implementation.ui-framework`
Flavor (`ui-react`) constrained to JavaScript; it does not occupy the language axis.
Lockfile-pinned npm is the optional `packaging` Flavor `package-npm`, constrained to
JavaScript and requiring `lang-javascript`.

## Page contract

Keep product behavior in the page: loading and error states stay isolated per panel
so one failed fetch does not blank the rest of the UI. Clean up timers, intervals,
and listeners when the owning view unmounts or the page unloads. Do not invent
interactions the specification did not request.

Render specification-named regions as semantic landmarks with stable accessible names.
Give specified controls durable roles, labels, and state rather than selectors coupled to
generated class names. Loading, empty, unavailable, stale, error, and suppressed states
must remain distinguishable in the rendered document. Preserve unknown numeric values as
unknown; never render `NaN`, `Infinity`, or a fabricated zero.

The page must remain inspectable at desktop and narrow mobile viewports. Contain scrolling
inside regions that are intentionally wide, keep focus visible, and avoid document-level
horizontal overflow unless the specification explicitly requires it. A specified local
interaction must expose its changed state to the accessibility tree and must not perform
an unrelated data fetch.

Browser execution is outside this generation skill's authority. Generate deterministic
fixtures and stable browser-observable seams so the operator-side
`verify-frontend-browser` skill can exercise the built page after host execution is
authorized. Do not embed screenshot baselines, test-only product branches, or acceptance
oracle values in application source.

## Modules and npm

Import every generated sibling through an explicit relative specifier that includes
the file extension (`./App.js`, `./tools.js`). Node and browsers resolve a bare
specifier from `node_modules`. Without `package-npm`, that both fails at runtime for a
dependency-free application and is reported as an undeclared package by dependency
evidence. With `package-npm`, bare specifiers may name lockfile-pinned packages only;
local modules still use relative paths with extensions.

## Nested realizations

- **React dashboard** — delta under this directory: overlaid charts and sortable
  tables over one already-fetched dataset.
- **WebMCP** — delta under `mcp-application/webmcp`: in-page MCP tools. Pin that
  nested skill together with this parent and the MCP parent; do not copy MCP hygiene
  here.
