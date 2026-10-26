---
name: convert-project
description: Adopt an existing repository through the deterministic Literate AI conversion harness, including inspect-first readiness, quarantine, baseline, rollback, shim parity, lift-shift evidence, and explicit authority stages. Use `litai onboard adopt` before mutation and this skill to review its gates.
metadata:
  author: Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>
---

# Convert an existing project

Inherits `../SKILL.md`. Conversion is mutagenic, so confirm the operator has a Git or
equivalent recovery point and explicit execution authorization. Python owns repository
inspection, safe moves, stage classification, baseline execution, rollback, scaffold,
shim parity, lift-shift, and versioned evidence; do not reproduce those algorithms in
the prompt or move `_legacy/` content manually.

## Route through the harness

1. Run `litai onboard adopt PATH`. It writes nothing and reports detected
   languages, Flavors, drivers, stages, catalog gaps, CI classification, and one typed
   readiness state. If the project is already initialized, use `litai update` instead.
2. Review the report. Resolve `blocked-missing-catalog` in framework authority before
   conversion. `blocked-no-driver` may proceed only as the harness documents; never
   invent a wrapper command. Record material gaps with `litai work record`.
3. With authorization, rerun `litai onboard adopt PATH --apply --acknowledge`
   (add `--run-baseline` only when
   the operator authorizes host-heavy stages). For a proven long-running harness, set
   `--baseline-timeout-seconds`; for an unusually verbose failure, set the bounded
   `--baseline-diagnostic-chars` budget rather than asking the model to infer omitted
   logs. If a retained source file resolves a required sibling outside the repository,
   pass one explicit `--harness-workspace-link DESTINATION=SOURCE` per sibling. Reuse
   those exact destination names when running `project test-receipt run-retained`; do
   not copy the dependency into project authority or infer a host path in the prompt.
   The command owns its transaction: quarantine, inventory, local-cheap baseline,
   failure rollback, wrappers, parity, lift-shift ADRs, and exact evidence. Do not repair
   a failing legacy baseline inside conversion or delete retained content to make the
   gate pass.
4. Inspect the returned evidence and run `litai status --project PATH`. The tree lands
   at `wrapped`; publish a current retained-harness receipt and explicitly advance to
   `retained`. Original source remains release authority through `drafted` and until
   regenerative qualification authorizes `qualified`. Run the generated lifecycle only
   with its required host-execution acknowledgement. A remote CI declaration is
   recorded evidence, not a locally executed success.
5. Run `litai project agent-entrypoints PATH` before calling onboarding complete.
   Resolve missing or stale owned delegates through reviewed authored changes to the
   declared `agent_skill`; preserve custom instructions. Original-source adoption
   also reports this audit, but its metadata binding never repairs agent files,
   pinned parents or retained snapshots and does not establish discovery readiness.
6. Use the generated native-rewrite roadmap for later one-boundary-at-a-time work.
   Conversion proves adoption and parity; it does not authorize automatic
   source-to-specification recovery or a native rewrite.

## Invariants

- Preserve `.git`, user files, hierarchy, credentials, and unrelated changes.
- Every removed legacy item requires the harness's matching parity evidence.
- Missing tools are typed omissions; failed executed stages are failures.
- External workspace links are explicit operator-local runtime inputs; committed
  evidence records only their portable destination topology, never host locators.
- Wrapper authority declares interfaces and acceptance, not copied implementation.
- The roadmap and retained identities resume the work after this conversation.
