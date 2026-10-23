import { describe, expect, it } from 'vitest';
import {
  distanceNM,
  initialBearing,
  calculateWindCorrection,
  densityAltitude,
  pressureAltitude,
  densityAltitudeFromIndicated,
  isaTemperature,
} from '../navigation/index.js';

describe('navigation utilities', () => {
  it('computes great-circle distance roughly between KSFO and KJFK', () => {
    const nm = distanceNM(37.6188, -122.375, 40.6413, -73.7781);
    expect(Math.round(nm)).toBeGreaterThan(2230);
    expect(Math.round(nm)).toBeLessThan(2260);
  });

  it('computes true course between KSFO and KJFK', () => {
    const course = initialBearing(37.6188, -122.375, 40.6413, -73.7781);
    expect(course).toBeGreaterThan(60);
    expect(course).toBeLessThan(80);
  });

  it('computes wind correction and ground speed', () => {
    const { ground_speed, true_heading, wind_correction_angle } =
      calculateWindCorrection(120, 90, 60, 20);
    expect(ground_speed).toBeGreaterThan(130);
    expect(ground_speed).toBeLessThan(150);
    expect(true_heading).toBeGreaterThan(80);
    expect(true_heading).toBeLessThan(100);
    expect(wind_correction_angle).toBeLessThan(20);
  });
});

describe('performance altitudes', () => {
  it('computes density and pressure altitude', () => {
    const pa = pressureAltitude(5000, 29.5);
    expect(Math.round(pa)).toBeGreaterThan(5300);
    expect(Math.round(pa)).toBeLessThan(5500);
    const da = densityAltitude(pa, 25);
    expect(da).toBeGreaterThan(pa);
  });

  it('returns field elevation when the altimeter is standard', () => {
    expect(pressureAltitude(3000, 29.92)).toBeCloseTo(3000, 6);
  });

  it('raises pressure altitude as the altimeter setting falls', () => {
    expect(pressureAltitude(0, 28.92)).toBeCloseTo(1000, 6);
    expect(pressureAltitude(0, 30.92)).toBeCloseTo(-1000, 6);
  });

  it('matches ISA temperature at sea level and lapses with altitude', () => {
    expect(isaTemperature(0)).toBeCloseTo(15, 6);
    expect(isaTemperature(10000)).toBeCloseTo(15 - 0.0019812 * 10000, 6);
  });

  it('equals pressure altitude on a standard day', () => {
    const pa = 5000;
    expect(densityAltitude(pa, isaTemperature(pa))).toBeCloseTo(pa, 6);
  });

  it('drops below pressure altitude when colder than standard', () => {
    const pa = 5000;
    expect(densityAltitude(pa, isaTemperature(pa) - 10)).toBeLessThan(pa);
  });

  it('composes indicated altitude and altimeter setting', () => {
    expect(densityAltitudeFromIndicated(5000, 29.5, 25)).toBeCloseTo(
      densityAltitude(pressureAltitude(5000, 29.5), 25),
      6
    );
  });
});
