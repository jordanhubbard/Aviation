# Testing Strategy for the Aviation Monorepo

## Overview
This document outlines the testing strategy for the Aviation monorepo, covering unit, integration, end-to-end, and performance tests across all packages and applications. The goal is to ensure all components are robust, reliable, and well-tested.

## Package Manager

The monorepo uses **pnpm workspaces**. Internal package references use `workspace:*` protocol. Run tests across all packages from the repo root with:

```bash
make test
# or directly:
pnpm --recursive --if-present run test
```

`make test` runs four language suites: `test-node`, `test-go`, `test-python` and
`test-clojure`.

Several suites run **inside Docker**. The Python apps and the Clojure app each
ship a `docker-compose.test.yml`, and the root `test-python` target falls back to
it when no local virtualenv is present — that fallback is how flight-planner,
flightschool and g1000-simulator get exercised on a machine with no Python
environment set up. Where a suite genuinely cannot run, the target says so and
counts it as skipped rather than reporting a pass: a run where nothing executed
prints `⚠️  Python tests SKIPPED (0 run, N unavailable) - this is NOT a pass`.

## Test Frameworks by Package Type

| Package/App type | Framework |
|------------------|-----------|
| TypeScript backend (Node/Express) | **Vitest** (via Jest-compatible API) |
| TypeScript frontend (React/Vite) | **Vitest** + `@testing-library/react` |
| Python apps | **pytest** |
| Clojure apps | **clojure.test** (requires Docker) |

## Current Test Counts

JavaScript/TypeScript — 13 suites, 0 skipped:

| Package | Tests passing |
|---------|--------------|
| `packages/shared-sdk` | 273 |
| `packages/ui-framework` | 36 |
| `packages/ai-explainer` | 11 |
| `packages/keystore` | 4 |
| `apps/aviation-accident-tracker` — backend | 42 |
| `apps/aviation-accident-tracker` — frontend | 62 (10 test files) |
| `apps/flight-planner` — frontend | 6 |
| `apps/foreflight-dashboard` — frontend | passes with no tests |
| `apps/flight-tracker` | 47 |
| `apps/g1000-simulator` | 68 |
| `packages/g1000-avionics-sdk`, `g1000-protocols`, `g1000-rendering` | pass with no tests (`--passWithNoTests`) |

Python — 4 suites, 0 skipped, 400 tests:

| App | Tests |
|-----|-------|
| `apps/foreflight-dashboard` | 185 |
| `apps/g1000-simulator` (backend) | 97 |
| `apps/flightschool` | 64 pass, 25 skipped |
| `apps/flight-planner` (backend) | 54 |

Go — `go test ./...` over `packages/shared-sdk` and `packages/g1000-protocols`.

Clojure — `aviation-missions-app`, via its Docker test image.

Application suites are part of `make test`; for a while they existed but were
never invoked, so the command reported success while exercising only the shared
packages. Keep new suites wired into `test-node` or `test-python` rather than
relying on a per-app `make test`.

## Unit Testing
- **Objective**: Validate individual components and functions for correctness.
- **Tools**: Vitest for TypeScript; pytest for Python.
- **Scope**: Test all critical functions, including input validation, data processing, and output generation.

## Integration Testing
- **Objective**: Ensure that different components work together as expected.
- **Tools**: Vitest with `@testing-library/react` for frontend integration; Vitest with `supertest` for API testing.
- **Scope**: Integration tests target actual application behavior (rendered UI, real API responses). Tests that only validate phantom/mocked DOM structure should be avoided.

## Vitest Setup File

Frontend packages that use React and JSX in test mocks must use a `.tsx` setup file (not `.ts`) so JSX compiles correctly in Vitest mock factories. The setup file is referenced in `vitest.config.ts` via the `setupFiles` option (path varies by package — e.g., `./src/tests/setup.tsx` for `aviation-accident-tracker/frontend`).

The global fetch mock in `setup.tsx` returns correct shapes per endpoint:
- `/api/filters/options` → `{ countries: [], regions: [] }`

### react-leaflet Mock Convention

Map components are mocked to return simple `<div>` elements with `data-testid` attributes:
- `MapContainer` → `<div data-testid="map-container">`
- `Marker` → `<div data-testid="marker" />` (self-closing, no children — prevents Popup content appearing in the DOM inadvertently)

## Per-Package Test Notes

- **`apps/g1000-simulator`**: Uses **Jest** (ts-jest config) with a dedicated `jest.config.js` at the app root; e2e and performance tests are excluded from the default run.
- **`packages/flight-dynamics`**: Python tests run inside a virtualenv created automatically: `python3 -m venv .venv && .venv/bin/pip install ...`.
- **`packages/g1000-avionics-sdk`, `g1000-protocols`, `g1000-rendering`**: Jest configured with `--passWithNoTests` so CI does not fail when no test files exist yet.

## End-to-End Testing
- **Objective**: Validate complete user workflows from start to finish.
- **Tools**: `Playwright` or `Cypress` for automated browser testing (not yet wired into CI for all apps).
- **Scope**: Test user scenarios including setup, configuration, and operation.

## Performance Testing
- **Objective**: Ensure applications perform well under expected load.
- **Tools**: `Locust` or `k6` for load testing.
- **Scope**: Response times, resource usage, and stability under load.

## Continuous Integration
- **Objective**: Automate testing to catch regressions early.
- **Tools**: GitHub Actions (see `.github/workflows/ci.yml`).
- **Scope**: All tests run on every commit and pull request.

## Conclusion
All packages aim for at least 70% code coverage. Tests live in the `tests/` directory at the repo root or in per-package `src/test/` directories. Run `make test` from the repo root to execute the full suite.
