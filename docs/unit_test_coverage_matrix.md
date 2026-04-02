# Unit Test Coverage Matrix

This document outlines the unit test coverage matrix for core modules in the Aviation project. It includes backend and frontend modules, coverage targets, and critical path tests.

## Current Test Counts by Package

| Package / App | Framework | Tests Passing |
|---------------|-----------|--------------|
| `apps/aviation-accident-tracker/frontend` | Vitest + @testing-library/react | 62 (10 files) |
| `apps/aviation-accident-tracker/backend` | Vitest | 34 (5 files) |
| `apps/g1000-simulator` | Jest (ts-jest) | 68 |
| `packages/shared-sdk` | Vitest | 162 |
| `packages/ui-framework` | Vitest | 36 |
| `packages/ai-explainer` | Vitest | 11 |
| `packages/flight-dynamics` | pytest (virtualenv) | 5 |
| `packages/g1000-avionics-sdk` | Jest | pass with no tests |
| `packages/g1000-protocols` | Jest | pass with no tests |
| `packages/g1000-rendering` | Jest | pass with no tests |
| Python apps (flightschool, foreflight-dashboard) | pytest | 64 pass, 25 skipped |
| Clojure (aviation-missions-app) | clojure.test via `lein test` | CI only |

## Core Modules

### Backend Modules
- **SecureKeyStore**: Handles encrypted storage and retrieval of API keys.
- **BackgroundService**: Manages lifecycle of services, including start/stop and status reporting.
- **AIService**: Provides integration with AI providers and common query patterns.

### Frontend Modules
- **MultiTabWebUI**: Manages multi-tab web applications, allowing registration of different panes.
- **MobileUI**: Supports mobile-specific rendering and interactions.

## Coverage Targets
- **SecureKeyStore**: 90% coverage, focusing on encryption/decryption and key retrieval.
- **BackgroundService**: 85% coverage, ensuring lifecycle methods are robust.
- **AIService**: 80% coverage, testing AI provider integration and query handling.
- **MultiTabWebUI**: 75% coverage, focusing on pane registration and rendering.
- **MobileUI**: 70% coverage, ensuring mobile-specific features work correctly.
- **Minimum across all packages**: 70% (enforced per CLAUDE.md conventions).

## Critical Path Tests
- **SecureKeyStore**: Test encryption/decryption with various key sizes and formats.
- **BackgroundService**: Validate start/stop lifecycle under different conditions.
- **AIService**: Test integration with multiple AI providers and error handling.
- **MultiTabWebUI**: Ensure correct rendering and interaction of registered panes.
- **MobileUI**: Validate rendering and interaction on different mobile devices.

## Conclusion

This document serves as a guide to ensure comprehensive unit test coverage across core modules. The table above reflects actual passing counts from the most recent CI session. Regular updates and testing will ensure high standards of quality and performance.