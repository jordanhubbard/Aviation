---
name: bind-lifecycle-evidence
description: Keep build authorization, generated-source candidacy, the pinned lifecycle driver, CycloneDX SBOMs, and source caches bound to their exact identities across a Literate AI rebuild. Use when changing build authorization, dependency evidence, cache publication, or the lifecycle driver.
metadata:
  author: Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>
---

# Bind lifecycle evidence

Inherits `../SKILL.md`. `litai rebuild`, `litai lock`, and the Standard lifecycle
already bind these identities in Python. Do not re-derive them in a prompt, and
do not bypass a failed identity check.

## What to run

- Per target-matrix cell, `litai lock COMPONENT --check` with that cell's
  selectors, then `litai rebuild` against the same lock. Rebuild reports the
  lock identity it used; a missing or mismatched scoped lock is a failure, not a
  fallthrough.
- Inspect a failed run with `litai release evidence explain` or the rebuild
  receipt. Do not reconstruct `<component>/component.lock.json` after reading a
  scoped lock.
- After intentionally installing a newer non-editable Literate AI wheel, run
  `litai project lifecycle rebind-standard --output PLAN`, review the old/new
  binding plus embedded origin evidence, then apply that exact plan with
  `--apply --authorize-rebind`. `litai update` does not silently rebind executable
  authority. The old receipt and accepted-source membership remain present but
  stale until the newly bound lifecycle rebuilds them.

## What Python already fails closed on

Do not restate these rules as a second implementation. Confirm the command
failed closed, then fix the owning authority:

- build authorization is a typed request; generated source never authorizes
  compilation, acceptance, or cache publication
- the pinned lifecycle driver is TCB; verify it with `make driver-review`
  rather than substituting an ambient script
- every generated tree carries the canonical pre-build CycloneDX SBOM; post-build
  evidence may resolve versions but must not erase source intent
- source-cache hits are exact identity lookups, not timestamps; a worker
  continuation requires that exact membership
- SSH stdout is a bounded control plane; complete evidence stays in the
  digest-bound custody bundle
