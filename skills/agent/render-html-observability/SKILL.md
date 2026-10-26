---
name: render-html-observability
description: Render and verify single-file project authority graphs. Use when generating or checking HTML observability artifacts.
metadata:
  author: Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>
---

# Render HTML observability

Inherits `../SKILL.md`. From a declared project using a non-editable wheel, read
`litai help render html`. Declare committed artifacts in `html_render_requests`.

Run `litai render html --output graph.html`, then
`litai verify --gate html-observability`. DAG requires `pinned-cdn`; `inline-only`
refuses.

Honor every typed refusal: repair its named input or stop; never bypass checks.
Never hand-edit generated HTML, commit mismatched provenance, or treat HTML as authority.
