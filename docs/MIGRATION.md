# Aviation Monorepo Migration Summary

## Monorepo integration

The Aviation applications were consolidated under `apps/` with shared SDK,
keystore, and UI packages under `packages/`. The root Makefile and GitHub
Actions workflow provide the common build, test, accessibility, lint, and
security gates.

Integrated applications include the ForeFlight dashboard, aviation missions,
flight planner, flight school, flight tracker, weather briefing, accident
tracker, G1000 simulator, aviation chat, and the optional meta app.

## Task-ledger migration

Task tracking is now fully centralized in the `Aviation` project in MAC:

- `.mac/project.yaml` defines the repository execution contract.
- MAC owns task state, dependencies, dispatch, review, and evidence.
- All 233 records from the two historical repository-local task stores were
  imported into MAC with their original IDs, descriptions, priorities, status,
  timestamps, labels, dependency metadata, notes, and comments.
- The 229 historical completed items are represented as completed report
  records; the four tasks that were still open remain open in MAC.
- Runtime crash/error auto-reporting creates idempotent MAC tasks through the
  hub API.
- Repository-local task databases, sync hooks, per-app work-unit YAML, and the
  old validation job have been removed.

Use the current MAC CLI from the source checkout when possible:

```bash
MAC=/Users/jkh/Src/mac/.venv/bin/mac
$MAC task stats --project Aviation
$MAC task ready --project Aviation
$MAC task create "Follow-up title" --project Aviation \
  --no-ticket --description "Scope, acceptance criteria, and verification plan"
```

Runtime reporting uses these environment variables:

- `MAC_API_URL`: MAC hub API base URL (required to enable reporting).
- `MAC_API_TOKEN`: bearer token for the hub, when authentication is enabled.
- `MAC_AUTOREPORT_PROJECT`: target project; defaults to `Aviation`.
- `MAC_AUTOREPORT=0`: explicitly disables reporting.
- `MAC_AUTOREPORT_PARENT`: optional parent task dependency for auto-filed tasks.

`MAC_AUTOREPORT_FORCE=1` is reserved for controlled tests; normal CI and test
runs do not create live tasks. The reporter submits directly to `POST /tasks`
and uses a stable idempotency key plus a short local duplicate-suppression
window.

## Current validation

```bash
make validate
./scripts/check-all-contrast.sh
make test
make build
```

Do not add a second task ledger or Markdown task list. New application work and
discovered follow-ups belong in MAC.
