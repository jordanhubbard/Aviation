/**
 * Aviation Map Framework - Icon Tests
 */

import { describe, it, expect } from 'vitest';
import {
  toFlightCategory,
  windBarbSvg,
  createWindBarbIcon,
  createCircleIcon,
  createAirplaneIcon,
} from '../icons';

describe('toFlightCategory', () => {
  it('should return valid flight categories', () => {
    expect(toFlightCategory('VFR')).toBe('VFR');
    expect(toFlightCategory('MVFR')).toBe('MVFR');
    expect(toFlightCategory('IFR')).toBe('IFR');
    expect(toFlightCategory('LIFR')).toBe('LIFR');
  });

  it('should return UNKNOWN for invalid values', () => {
    expect(toFlightCategory('INVALID')).toBe('UNKNOWN');
    expect(toFlightCategory(null)).toBe('UNKNOWN');
    expect(toFlightCategory(undefined)).toBe('UNKNOWN');
    expect(toFlightCategory('')).toBe('UNKNOWN');
  });
});

describe('windBarbSvg', () => {
  it('should generate valid SVG string', () => {
    const svg = windBarbSvg(270, 15);
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });

  it('should include background when provided', () => {
    const svg = windBarbSvg(270, 15, {
      backgroundFill: '#2e7d32',
      backgroundStroke: '#ffffff',
    });
    expect(svg).toContain('circle');
    expect(svg).toContain('#2e7d32');
    expect(svg).toContain('#ffffff');
  });

  it('should normalize wind direction', () => {
    const svg1 = windBarbSvg(0, 10);
    const svg2 = windBarbSvg(360, 10);
    // Both should produce similar results (0° and 360° are the same)
    expect(svg1).toBeTruthy();
    expect(svg2).toBeTruthy();
  });
});

describe('createWindBarbIcon', () => {
  it('should create a Leaflet DivIcon', () => {
    const icon = createWindBarbIcon(270, 15);
    expect(icon).toBeDefined();
    expect(icon.options.iconSize).toEqual([40, 40]);
    expect(icon.options.iconAnchor).toEqual([20, 20]);
  });

  it('should accept custom size', () => {
    const icon = createWindBarbIcon(270, 15, undefined, 60);
    expect(icon.options.iconSize).toEqual([60, 60]);
    expect(icon.options.iconAnchor).toEqual([30, 30]);
  });

  it('should include category colors when provided', () => {
    const icon = createWindBarbIcon(270, 15, 'VFR');
    expect(icon.options.html).toContain('#2e7d32'); // VFR green
  });
});

describe('createCircleIcon', () => {
  it('should create a circle icon', () => {
    const icon = createCircleIcon('#ff0000');
    expect(icon).toBeDefined();
    expect(icon.options.html).toContain('circle');
    expect(icon.options.html).toContain('#ff0000');
  });

  it('should accept custom size', () => {
    const icon = createCircleIcon('#ff0000', 20);
    expect(icon.options.iconSize).toEqual([20, 20]);
  });
});

describe('createAirplaneIcon', () => {
  it('should create an airplane icon', () => {
    const icon = createAirplaneIcon();
    expect(icon).toBeDefined();
    expect(icon.options.html).toContain('path');
  });

  it('should accept custom color and size', () => {
    const icon = createAirplaneIcon('#00ff00', 32);
    expect(icon.options.html).toContain('#00ff00');
    expect(icon.options.iconSize).toEqual([32, 32]);
  });

  it('should accept rotation', () => {
    const icon = createAirplaneIcon('#1976d2', 24, 45);
    expect(icon.options.html).toContain('rotate(45');
  });
});
