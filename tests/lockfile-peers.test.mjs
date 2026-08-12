// Tests for scripts/check-lockfile-peers.mjs — the guard that catches the
// dependency bumps that only fail inside the Docker builds.
//
// Run with: node --test tests/lockfile-peers.test.mjs
// No test framework is required; this uses node's built-in runner so it works
// in the offline container builds and in a bare checkout.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { satisfies, checkLock } from '../scripts/check-lockfile-peers.mjs'

test('caret ranges respect the major-version boundary', () => {
  assert.equal(satisfies('18.3.1', '^18.2.0'), true)
  assert.equal(satisfies('18.3.1', '^18.0'), true) // partial version, still <19
  assert.equal(satisfies('19.0.0', '^18.2.0'), false)
  assert.equal(satisfies('17.0.2', '^18.2.0'), false)
})

test('caret ranges below 1.0.0 are pinned to the minor', () => {
  assert.equal(satisfies('0.4.26', '^0.4.5'), true)
  assert.equal(satisfies('0.5.2', '^0.4.5'), false)
  assert.equal(satisfies('0.9.9', '^0'), true)
  assert.equal(satisfies('1.0.0', '^0'), false)
})

test('tilde, comparison and union ranges', () => {
  assert.equal(satisfies('1.2.9', '~1.2.3'), true)
  assert.equal(satisfies('1.3.0', '~1.2.3'), false)
  assert.equal(satisfies('8.57.1', '>=8.40'), true)
  assert.equal(satisfies('8.39.0', '>=8.40'), false)
  assert.equal(satisfies('4.11.2', '>= 4.11'), true) // space after the operator
  assert.equal(satisfies('18.3.1', '^18.0 || ^19'), true)
  assert.equal(satisfies('20.0.0', '^18.0 || ^19'), false)
  assert.equal(satisfies('11.11.0', '^11.0.0-rc.0'), true) // prerelease lower bound
  assert.equal(satisfies('1.2.3', '*'), true)
})

// The exact shape that broke the Flight Planner container build: the frontend
// pinned eslint 8 while eslint-plugin-react-refresh 0.5.x demands eslint 9+.
test('a peer conflict in the lockfile is reported', () => {
  const lock = {
    lockfileVersion: 3,
    packages: {
      '': { name: 'frontend', version: '0.1.0' },
      'node_modules/eslint': { version: '8.57.1' },
      'node_modules/eslint-plugin-react-refresh': {
        version: '0.5.2',
        peerDependencies: { eslint: '^9 || ^10' },
      },
    },
  }

  const { conflicts, checked } = checkLock(lock)
  assert.equal(checked, 1)
  assert.equal(conflicts.length, 1)
  assert.equal(conflicts[0].peer, 'eslint')
  assert.equal(conflicts[0].found, '8.57.1')
  assert.equal(conflicts[0].dependent, 'node_modules/eslint-plugin-react-refresh')
})

test('the repaired version of the same tree is clean', () => {
  const lock = {
    lockfileVersion: 3,
    packages: {
      '': { name: 'frontend', version: '0.1.0' },
      'node_modules/eslint': { version: '8.57.1' },
      'node_modules/eslint-plugin-react-refresh': {
        version: '0.4.26',
        peerDependencies: { eslint: '>=8.40' },
      },
    },
  }

  assert.deepEqual(checkLock(lock).conflicts, [])
})

test('nested copies resolve to the nearest matching package', () => {
  const lock = {
    lockfileVersion: 3,
    packages: {
      '': { name: 'root', version: '1.0.0' },
      'node_modules/react': { version: '18.3.1' },
      'node_modules/widget': { version: '1.0.0', peerDependencies: { react: '^19.0.0' } },
      'node_modules/widget/node_modules/react': { version: '19.1.0' },
    },
  }

  // widget resolves react from its own nested copy, so there is no conflict.
  assert.deepEqual(checkLock(lock).conflicts, [])
})

test('optional peers and absent peers are not conflicts', () => {
  const lock = {
    lockfileVersion: 3,
    packages: {
      '': { name: 'root', version: '1.0.0' },
      'node_modules/react': { version: '18.3.1' },
      'node_modules/opt': {
        version: '1.0.0',
        peerDependencies: { react: '^19.0.0' },
        peerDependenciesMeta: { react: { optional: true } },
      },
      'node_modules/missing-peer': { version: '1.0.0', peerDependencies: { vue: '^3.0.0' } },
    },
  }

  const { conflicts, checked } = checkLock(lock)
  assert.deepEqual(conflicts, [])
  assert.equal(checked, 0)
})

test('unparseable ranges are skipped, never failed', () => {
  const lock = {
    lockfileVersion: 3,
    packages: {
      '': { name: 'root', version: '1.0.0' },
      'node_modules/express': { version: '4.21.2' },
      'node_modules/plugin': {
        version: '1.0.0',
        peerDependencies: { express: '4.0.0 - 5.0.0' },
      },
    },
  }

  const { conflicts, skipped } = checkLock(lock)
  assert.deepEqual(conflicts, [])
  assert.equal(skipped.length, 1)
})

test('lockfiles without a packages map are skipped', () => {
  const { conflicts, skipped, checked } = checkLock({ lockfileVersion: 1, dependencies: {} })
  assert.deepEqual(conflicts, [])
  assert.equal(checked, 0)
  assert.equal(skipped.length, 1)
})
