# Integration Test Scenarios

## Overview
This document outlines the integration test scenarios for the Aviation project. Integration tests verify actual application behavior — rendered UI output, real API response shapes, and component interaction — rather than mocked DOM structure.

## Test Framework and Conventions

- **Framework**: Vitest + `@testing-library/react` for frontend integration tests.
- **No MSW**: Tests do not use Mock Service Worker. The global `fetch` is mocked in the setup file (`setup.tsx`) and returns correct response shapes per endpoint.
- **Mock factories use JSX**: The setup file uses the `.tsx` extension so Vitest mock factories can return JSX elements (e.g., `vi.fn()` returning `<div data-testid="map-container">`).
- **No `jest.fn()`**: All mocks use `vi.fn()` (Vitest API).

## aviation-accident-tracker Frontend Integration Tests

7 integration tests in `tests/integration/` cover:

1. **Error state rendering** — App renders an error message when the API returns a non-OK response.
2. **Loading state rendering** — App renders a loading indicator while the API call is in flight.
3. **Event data display** — App renders accident event data (date, registration, aircraft type) fetched from the API.
4. **Rendering structure** — App renders the expected top-level structure (header, main content area, footer).
5. **Map markers** — Map renders a marker for each event returned from the API.
6. **Filter API params** — Applying a filter causes the events API to be called with the correct query parameters.
7. **Modal open/close** — Clicking an event row opens the detail modal; closing it hides the modal.

## aviation-accident-tracker Backend Integration Tests

Vitest-based tests cover the REST API layer using `supertest`:
- Events list with filter parameters
- Event detail retrieval
- Filter options endpoint (`/api/filters/options` returns `{ countries: [], regions: [] }`)
- Ingestion trigger endpoint

## Planned Scenarios (Not Yet Implemented)

### WebSocket Telemetry Flows
Real-time update tests for the G1000 simulator are planned but not yet wired into CI.

### Flight Plan CRUD Operations
Full CRUD integration tests for the flight-planner app are planned for a future sprint.

## Conclusion
Integration tests target actual application behavior. Tests that only validate phantom/mocked DOM structure (e.g., checking for menu buttons or alert dialogs that don't exist in the app) should be removed and replaced with tests that verify real rendered output.
