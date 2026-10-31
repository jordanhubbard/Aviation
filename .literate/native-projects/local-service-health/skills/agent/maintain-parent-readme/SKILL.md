---
name: maintain-parent-readme
description: Reconcile descriptive root README links to a project's declared direct parent repositories after initialization, adoption, update or reparenting.
metadata:
  author: Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>
---

# Maintain parent README links

Inherits `../SKILL.md`. After successful initialization, adoption, update or
reparenting, run `litai project parent-readme PATH`.
It reads the validated parent selection and lineage and emits a read-only plan.
With the workflow's existing file-write authorization, add `--apply`, then rerun
the plan to verify no remaining change. Do not run it for a failed or staged
transaction that may still roll back.

The helper preserves authored prose, reconciles its managed block, lists every
direct parent, and creates a minimal README only when a parent needs attribution.
Root projects get no invented parent. For a local-only repository or a host whose
browser location differs from its clone path, supply one
`--browser-url REPOSITORY=URL` per affected declared parent using a verified browser
URL. Never substitute the framework repository for an unresolved parent. Preserve
unmanaged authored links; the helper owns only its marked attribution block.
