# Migration: xctry-planner + vfr-flightplanner → flightplanner

This repository (**flightplanner**) consolidates the functionality from the two legacy projects:

- **xctry-planner**: cross-country route planning + map UI
- **vfr-flightplanner**: modular FastAPI backend + weather/overlay integrations

## Why consolidate?

- Single codebase for route planning + local planning
- Unified backend API surface (FastAPI)
- Shared data layer (airports/airspace caches)
- Consistent UI/UX and testing strategy

## What should existing users do?

1. Use this repository going forward:
   - https://github.com/jordanhubbard/flightplanner
2. If you ran the old apps locally, follow the new quickstart:
   - See `README.md`
3. API consumers:
   - Prefer `POST /api/plan` (mode = `local` or `route`) instead of legacy per-app endpoints.

## Status of legacy repositories

The legacy repositories are intended to be **archived** (read-only) to avoid confusion.

If you have open issues/PRs in the legacy repos, please re-file them against **flightplanner**.
