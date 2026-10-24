import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateLoad, interpolateEnvelope } from './public/calculations.js';

const profile = { emptyWeight: 1500, emptyArm: 39, maxGross: 2300, fuelArm: 48, fuelDensity: 6,
  stations: [{ name: 'Front seats', arm: 37 }, { name: 'Baggage', arm: 95 }],
  envelope: [{ weight: 1500, forward: 35, aft: 47 }, { weight: 2300, forward: 41, aft: 47 }] };

test('interpolates forward and aft limits by weight', () => {
  assert.deepEqual(interpolateEnvelope(profile.envelope, 1900), { forward: 38, aft: 47 });
  assert.equal(interpolateEnvelope(profile.envelope, 1000), null);
});

test('reports takeoff and after-burn landing conditions independently', () => {
  const result = calculateLoad(profile, { stationWeights: [170, 40], fuelGallons: 40, fuelBurnGallons: 20 });
  assert.equal(result.takeoff.weight, 1950);
  assert.equal(result.landing.weight, 1830);
  assert.ok(result.takeoff.cg > result.landing.cg);
  assert.equal(result.takeoff.withinLimits, true);
  assert.equal(result.landing.withinLimits, true);
});

test('rejects impossible fuel burn and flags overweight or unbounded CG', () => {
  assert.throws(() => calculateLoad(profile, { stationWeights: [170, 0], fuelGallons: 10, fuelBurnGallons: 11 }));
  const result = calculateLoad(profile, { stationWeights: [700, 0], fuelGallons: 40, fuelBurnGallons: 10 });
  assert.equal(result.takeoff.withinLimits, false);
  assert.ok(result.takeoff.problems.includes('Above maximum gross weight'));
});
