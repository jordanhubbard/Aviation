# Testing Guide - Aviation Accident Tracker Frontend

This document describes the testing strategy and how to run tests for the Aviation Accident Tracker frontend.

## Test Coverage

### Component Tests (Vitest + React Testing Library)

Location: `src/components/__tests__/` and `src/tests/`

**Badge Component Tests:**
- Renders children correctly
- Applies default and custom styling
- Handles multiple children and numeric values

**App Component Tests:**
- Initial rendering and loading states
- Filter functionality (search, category, country, region, dates, airport)
- Table display and pagination
- Map rendering with clustered markers
- Detail modal open/close
- Error handling
- Airport search with debouncing

**Coverage Target:** 70%+ (configured in `vitest.config.ts`)

### E2E Tests (Playwright)

Location: `src/e2e/`

**Happy Path Tests:**
- Application loads and displays correctly
- Filter events by search, category, date range
- Open and close event detail modal
- Navigate through pages
- Clear all filters
- Map interaction and marker clustering
- Mobile responsiveness

**Accessibility Tests:**
- WCAG 2.0 AA compliance
- Keyboard navigation for filters, table, and modal
- Form label associations
- Color contrast validation
- Screen reader compatibility

## Running Tests

### Component Tests

```bash
# Run all component tests
npm test

# Run tests in watch mode (useful during development)
npm run test:watch

# Run tests with UI (interactive)
npm run test:ui

# Generate coverage report
npm run test:coverage
```

Coverage reports are generated in `coverage/` directory. Open `coverage/index.html` in a browser to view detailed coverage.

### E2E Tests

**Prerequisites:**
- Backend server must be running
- Frontend dev server will start automatically

```bash
# Run all E2E tests (headless)
npm run test:e2e

# Run E2E tests with UI (interactive, shows browser)
npm run test:e2e:ui

# Run specific test file
npx playwright test src/e2e/happy-path.spec.ts

# Run tests for specific browser
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit

# Debug mode (opens browser inspector)
npx playwright test --debug
```

**Playwright Configuration:**
- Tests run against `http://localhost:5173` (Vite dev server)
- Runs on: Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari
- HTML report generated in `playwright-report/`

### Linting

```bash
# Run ESLint
npm run lint

# Auto-fix linting issues
npx eslint src --ext ts,tsx --fix
```

## Test Structure

### Component Test Example

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### E2E Test Example

```typescript
import { test, expect } from '@playwright/test';

test('happy path', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('Aviation Accident Tracker');
});
```

### Accessibility Test Example

```typescript
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('no a11y violations', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2aa'])
    .analyze();
  expect(results.violations).toEqual([]);
});
```

## Mocking

### API Mocking (Component Tests)

Mock data is provided in `src/tests/mockData.ts`:

```typescript
import { mockEvents, mockAirports, mockFilterOptions } from './tests/mockData';

// In tests:
global.fetch = vi.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({ data: mockEvents }),
  })
);
```

### Leaflet Mocking

Leaflet and react-leaflet are automatically mocked in `src/tests/setup.ts` to avoid DOM/canvas issues in tests.

## CI/CD Integration

Tests are configured to run in CI/CD pipelines:

**Component Tests:**
- Run on every commit
- Must pass for PR merge
- Coverage reports uploaded to Codecov

**E2E Tests:**
- Run on every commit
- Tests run in headless mode
- Playwright generates HTML reports as artifacts

**Accessibility Tests:**
- Run as part of E2E suite
- Must pass WCAG 2.0 AA standards
- Violations block PR merge

## Troubleshooting

### Tests Fail Locally But Pass in CI

- Clear `node_modules/` and reinstall: `rm -rf node_modules && npm install`
- Update Playwright browsers: `npx playwright install`
- Check Node.js version matches CI (20+)

### E2E Tests Timeout

- Increase timeout in test: `test('...', async ({ page }) => { test.setTimeout(60000); ... })`
- Check backend is running: `curl http://localhost:3000/health`
- Check frontend is running: `curl http://localhost:5173`

### Coverage Below Threshold

- Run coverage report: `npm run test:coverage`
- Open `coverage/index.html` to see uncovered lines
- Add tests for uncovered code paths
- Consider excluding non-testable code in `vitest.config.ts`

### Accessibility Violations

- Run tests with UI: `npm run test:e2e:ui`
- Check violations in Playwright trace
- Fix issues (add labels, improve contrast, etc.)
- Re-run accessibility tests

## Best Practices

1. **Test Behavior, Not Implementation**
   - Test what users see and do, not internal state
   - Use `screen.getByRole()` over `getByTestId()`

2. **Use Testing Library Queries**
   - Prefer `getByRole`, `getByLabelText`, `getByText`
   - Avoid `querySelector` and `getByTestId`

3. **Async Handling**
   - Use `waitFor()` for async operations
   - Use `findBy` queries for elements that appear asynchronously

4. **Mock Minimally**
   - Only mock external dependencies (fetch, Leaflet)
   - Test real component interactions

5. **Accessibility First**
   - Write accessible code from the start
   - Run accessibility tests early and often
   - Fix violations immediately

6. **Keep Tests Fast**
   - Component tests should run in milliseconds
   - E2E tests should complete in seconds
   - Use `test.skip()` for slow tests during development

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Playwright Documentation](https://playwright.dev/)
- [Axe Accessibility Testing](https://github.com/dequelabs/axe-core)
- [WCAG 2.0 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
