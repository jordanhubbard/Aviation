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

// Mock react-leaflet components (use factory returning functions, not require())
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: any) => children,
  TileLayer: () => null,
  Marker: ({ children }: any) => children,
  Popup: ({ children }: any) => children,
  useMapEvents: vi.fn(() => null),
}));

// Mock react-leaflet-cluster
vi.mock('react-leaflet-cluster', () => ({
  default: ({ children }: any) => children,
}));

// Mock fetch globally — default to empty successful responses so App renders without crashing
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ events: [], total: 0 }),
    text: () => Promise.resolve(''),
  } as unknown as Response)
);

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
