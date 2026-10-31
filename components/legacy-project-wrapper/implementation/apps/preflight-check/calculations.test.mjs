import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('delegates loading calculations to the browser SDK realization', async () => {
  const adapter = await readFile(new URL('./public/calculations.js', import.meta.url), 'utf8');
  assert.match(adapter, /from '\/aviation-sdk\/weight-balance\.js'/);
  assert.doesNotMatch(adapter, /fuelDensity|baseMoment|interpolateEnvelope\(/);
});

test('deployment copies the built common module into the adapter URL', async () => {
  const dockerfile = await readFile(new URL('./Dockerfile', import.meta.url), 'utf8');
  assert.match(
    dockerfile,
    /dist-esm\/aviation\/weight-balance\.js \/usr\/share\/nginx\/html\/aviation-sdk\/weight-balance\.js/
  );
  assert.match(
    dockerfile,
    /dist-esm\/aviation\/aircraft\.js \/usr\/share\/nginx\/html\/aviation-sdk\/aircraft\.js/
  );
});

test('keeps user-entered generic aircraft profiles compatible with the SDK', async () => {
  const sdk = await import(
    new URL('../../packages/shared-sdk/dist-esm/aviation/weight-balance.js', import.meta.url)
  );
  const result = sdk.calculateLoad(
    {
      emptyWeight: 1500,
      emptyArm: 39,
      maxGross: 2300,
      fuelArm: 48,
      fuelDensity: 6,
      stations: [{ name: 'Front seats', arm: 37 }],
      envelope: [
        { weight: 1500, forward: 35, aft: 47 },
        { weight: 2300, forward: 41, aft: 47 },
      ],
    },
    { stationWeights: [170], fuelGallons: 20, fuelBurnGallons: 10 },
  );

  assert.equal(result.takeoff.weight, 1790);
  assert.equal(result.landing.weight, 1730);
  assert.equal(result.takeoff.withinLimits, true);
});
