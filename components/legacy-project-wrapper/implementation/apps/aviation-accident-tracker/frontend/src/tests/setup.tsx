import '@testing-library/jest-dom';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Extend Vitest matchers with jest-dom
expect.extend({});

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock Leaflet for tests
vi.mock('leaflet', () => ({
  default: {
    icon: vi.fn(() => ({})),
    map: vi.fn(() => ({
      setView: vi.fn(),
      remove: vi.fn(),
    })),
  },
  icon: vi.fn(() => ({})),
  map: vi.fn(() => ({
    setView: vi.fn(),
    remove: vi.fn(),
  })),
}));

// Mock react-leaflet — MapContainer gets data-testid="map-container",
// Marker gets data-testid="marker" but does NOT render children so Popup
// content stays out of the DOM (prevents duplicate text matches in tests).
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => null,
  Marker: (_props: unknown) => <div data-testid="marker" />,
  Popup: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  useMapEvents: vi.fn(() => null),
}));

// Mock react-leaflet-cluster
vi.mock('react-leaflet-cluster', () => ({
  default: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

// Mock fetch globally — return correct shapes per endpoint so App renders without crashing
global.fetch = vi.fn((url: RequestInfo | URL) => {
  const s = url.toString();
  if (s.includes('/api/filters/options')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ countries: [], regions: [] }),
      text: () => Promise.resolve(''),
    } as unknown as Response);
  }
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ data: [], events: [], total: 0 }),
    text: () => Promise.resolve(''),
  } as unknown as Response);
});

// Setup window.matchMedia (for responsive components)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
