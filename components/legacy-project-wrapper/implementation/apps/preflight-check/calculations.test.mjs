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
});
