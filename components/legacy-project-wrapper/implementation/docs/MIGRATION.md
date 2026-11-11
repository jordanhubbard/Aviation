# Aviation Monorepo Migration Summary

> Tracker note: work and review now live in [GitHub Issues](https://github.com/jordanhubbard/Aviation/issues). Legacy task references below are historical provenance.

## Monorepo integration

The Aviation applications were consolidated under `apps/` with shared SDK,
keystore, and UI packages under `packages/`. The root Makefile and GitHub
Actions workflow provide the common build, test, accessibility, lint, and
security gates.

Integrated applications include the ForeFlight dashboard, aviation missions,
flight planner, flight school, flight tracker, weather briefing, accident
tracker, G1000 simulator, aviation chat, and the optional meta app.

## GitHub tracker migration

GitHub Issues and pull requests are the sole work and review authorities.
The previous task-service contract and runtime adapters have been removed.
All seven previously active service records have GitHub issue mappings and are
retired with their history preserved; completed attempts remain read-only history.
The native rewrite program is [issue #442](https://github.com/jordanhubbard/Aviation/issues/442).

See the [tracking guide](../../../../docs/development/issue-tracking.md) for
`gh issue`/`gh pr` commands and opt-in runtime GitHub reporter configuration,
and the [migration archive](../../../../docs/history/tracker/README.md) for mappings.
Runtime reporting sends GitHub title/body payloads and uses server-side credentials;
there is no legacy provider or credential fallback.

## Current validation

```bash
make validate
./scripts/check-all-contrast.sh
make test
make build
```

Do not add a second task ledger or Markdown task list. New application work and
discovered follow-ups belong in GitHub Issues.
