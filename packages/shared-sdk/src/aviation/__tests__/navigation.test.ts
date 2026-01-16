import { describe, expect, it } from 'vitest';
import { distanceNm, courseTrue, windCorrection, densityAltitude, pressureAltitude } from '../navigation.js';

describe('navigation utilities', () => {
  it('computes great-circle distance roughly between KSFO and KJFK', () => {
    const nm = distanceNm(37.6188, -122.375, 40.6413, -73.7781);
    expect(Math.round(nm)).toBeGreaterThan(2230);
    expect(Math.round(nm)).toBeLessThan(2260);
  });

  it('computes true course between KSFO and KJFK', () => {
    const course = courseTrue(37.6188, -122.375, 40.6413, -73.7781);
    expect(course).toBeGreaterThan(60);
    expect(course).toBeLessThan(80);
  });

  it('computes wind correction and ground speed', () => {
    const { groundSpeed, trueHeading, windCorrectionAngle } = windCorrection(120, 90, 60, 20);
    expect(groundSpeed).toBeGreaterThan(130);
    expect(groundSpeed).toBeLessThan(150);
    expect(trueHeading).toBeGreaterThan(80);
    expect(trueHeading).toBeLessThan(100);
    expect(windCorrectionAngle).toBeLessThan(20);
  });

  it('computes density and pressure altitude', () => {
    const pa = pressureAltitude(5000, 29.5);
    expect(Math.round(pa)).toBeGreaterThan(5300);
    expect(Math.round(pa)).toBeLessThan(5500);
    const da = densityAltitude(pa, 25);
    expect(da).toBeGreaterThan(pa);
  });
});
