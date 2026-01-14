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

// Mock react-leaflet components
vi.mock('react-leaflet', () => {
  const React = require('react');
  return {
    MapContainer: ({ children }: any) => React.createElement('div', { 'data-testid': 'map-container' }, children),
    TileLayer: () => React.createElement('div', { 'data-testid': 'tile-layer' }),
    Marker: ({ children }: any) => React.createElement('div', { 'data-testid': 'marker' }, children),
    Popup: ({ children }: any) => React.createElement('div', { 'data-testid': 'popup' }, children),
  };
});

// Mock react-leaflet-cluster
vi.mock('react-leaflet-cluster', () => {
  const React = require('react');
  return {
    default: ({ children }: any) => React.createElement('div', { 'data-testid': 'marker-cluster' }, children),
  };
});

// Mock fetch globally
global.fetch = vi.fn();

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
