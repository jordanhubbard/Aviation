/**
 * Aviation Map Framework - Constants Tests
 */

import { describe, it, expect } from 'vitest';
import {
  CATEGORY_COLORS,
  nmToMeters,
  metersToNm,
  DEFAULT_TILE_LAYERS,
  OPENWEATHER_LAYERS,
} from '../constants';

describe('CATEGORY_COLORS', () => {
  it('should have all flight categories defined', () => {
    expect(CATEGORY_COLORS.VFR).toBeDefined();
    expect(CATEGORY_COLORS.MVFR).toBeDefined();
    expect(CATEGORY_COLORS.IFR).toBeDefined();
    expect(CATEGORY_COLORS.LIFR).toBeDefined();
    expect(CATEGORY_COLORS.UNKNOWN).toBeDefined();
  });

  it('should have fill and stroke colors', () => {
    Object.values(CATEGORY_COLORS).forEach((colors) => {
      expect(colors.fill).toMatch(/^#[0-9a-f]{6}$/i);
      expect(colors.stroke).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });
});

describe('Unit conversions', () => {
  it('should convert nautical miles to meters', () => {
    expect(nmToMeters(1)).toBe(1852);
    expect(nmToMeters(10)).toBe(18520);
    expect(nmToMeters(0)).toBe(0);
  });

  it('should convert meters to nautical miles', () => {
    expect(metersToNm(1852)).toBe(1);
    expect(metersToNm(18520)).toBe(10);
    expect(metersToNm(0)).toBe(0);
  });

  it('should be inverse operations', () => {
    const nm = 25.5;
    expect(metersToNm(nmToMeters(nm))).toBeCloseTo(nm, 10);
  });
});

describe('DEFAULT_TILE_LAYERS', () => {
  it('should have all default layers', () => {
    expect(DEFAULT_TILE_LAYERS.openStreetMap).toBeDefined();
    expect(DEFAULT_TILE_LAYERS.openTopoMap).toBeDefined();
    expect(DEFAULT_TILE_LAYERS.satellite).toBeDefined();
  });

  it('should have url and attribution', () => {
    Object.values(DEFAULT_TILE_LAYERS).forEach((layer) => {
      expect(layer.url).toBeTruthy();
      expect(layer.attribution).toBeTruthy();
    });
  });
});

describe('OPENWEATHER_LAYERS', () => {
  it('should have weather layer types', () => {
    expect(OPENWEATHER_LAYERS.clouds).toBe('clouds_new');
    expect(OPENWEATHER_LAYERS.wind).toBe('wind_new');
    expect(OPENWEATHER_LAYERS.precipitation).toBe('precipitation_new');
    expect(OPENWEATHER_LAYERS.temperature).toBe('temp_new');
    expect(OPENWEATHER_LAYERS.pressure).toBe('pressure_new');
  });
});
