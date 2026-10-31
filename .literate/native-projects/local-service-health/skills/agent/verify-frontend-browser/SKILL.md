---
name: verify-frontend-browser
description: Verify a built browser frontend with authorized browser instrumentation. Use after generation or frontend changes to inspect desktop/mobile rendering, runtime failures, responsive overflow, and specified interactions; prefer Playwright when available.
metadata:
  author: Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>
---

# Verify a frontend in a browser

Inherits `../SKILL.md`. Use this only after the relevant build or service execution has
been authorized. This skill verifies rendered behavior; it does not grant execution,
install browser tooling, or replace verifier-owned acceptance.

Since ADR 0028 (#218) the lifecycle-gating half of this checklist is enforced by the
verifier-owned browser-interaction acceptance contract
(`literate-ai/browser-interaction-acceptance@1`,
`literate_ai.adapters.component_acceptance.BrowserInteractionAcceptance`), driven behind
the browser-tool-neutral port in `literate_ai.adapters.browser_acceptance`. That contract
fails a `web-application` deployment unit closed on console/page errors, failed requests,
HTTP errors, mobile document overflow, unbound interactions, no-op controls, and
unexpected fetches. This skill remains the manual-review companion for the judgement calls
a contract cannot encode (information architecture, whether a rendered region matches the
specification's intent); it is no longer the only thing standing between a broken page and
promotion.

Inspect the specification first and turn its named regions, states, viewports, and
interactions into a short browser checklist. Start the accepted artifact through its
declared entrypoint. Prefer an already available Playwright installation; otherwise use
equivalent browser automation or developer-protocol instrumentation. Do not add a product
dependency merely to run this inspection.

For at least one desktop and one narrow mobile viewport:

- capture a full-page screenshot and the accessibility-visible page structure;
- collect console errors, uncaught page errors, failed requests, and HTTP failures;
- assert specification-named landmarks and controls are present and visible;
- reject rendered `NaN`, `Infinity`, broken URLs, and unintended document overflow;
- exercise the specification's primary interactions and confirm observable state changes;
- distinguish local transforms from allowed fetches by observing requests; and
- inspect loading, empty, unavailable, and error states when deterministic fixtures expose
  them.

A screenshot is diagnostic evidence, not a self-interpreting oracle. Compare the rendered
information architecture and control behavior to the specification, and report concrete
missing regions or regressions. Do not approve a page solely because a screenshot exists,
a text substring is present, or a render hash is stable. Keep captures in ignored object
or temporary storage unless the project explicitly authors a verifier-owned baseline.
