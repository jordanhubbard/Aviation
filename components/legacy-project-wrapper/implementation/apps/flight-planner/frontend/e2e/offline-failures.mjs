import { chromium } from '@playwright/test'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
const input = process.env.AVIATION_OFFLINE_BASE_URL,
  fixture = process.env.AVIATION_OFFLINE_FIXTURE_MANIFEST
assert.ok(
  input && fixture,
  'Set AVIATION_OFFLINE_BASE_URL and AVIATION_OFFLINE_FIXTURE_MANIFEST from a successful source browser run',
)
const target = new URL(input)
assert.ok(
  ['http:', 'https:'].includes(target.protocol) &&
    !target.username &&
    !target.password &&
    !target.search &&
    !target.hash &&
    target.pathname === '/',
  'Use an HTTP(S) origin without credentials, paths or query parameters',
)
const base = target.origin
const evidence = resolve(
  process.env.AVIATION_OFFLINE_EVIDENCE_DIR ?? 'test-results/offline-failures-' + Date.now(),
)
mkdirSync(evidence, { recursive: true })
const seed = JSON.parse(readFileSync(fixture, 'utf8'))
assert.ok(
  seed.private_documents_included === false && seed.assets.some((a) => a.role === 'chart_original'),
  'Use a public-source package fixture',
)
const profile = resolve(evidence, 'profile-' + Date.now())
mkdirSync(profile, { recursive: true })
let context = await chromium.launchPersistentContext(profile, {
  headless: true,
  viewport: { width: 1280, height: 900 },
})
let page = await context.newPage()
let mode = 'normal',
  release,
  sharedId = null
const failures = []
function identity() {
  return 'offline_' + crypto.randomUUID().replaceAll('-', '')
}
const counts = () =>
  page.evaluate(async () => {
    const db = await new Promise((r) => {
      const q = indexedDB.open('aviation-offline-v1')
      q.onsuccess = () => r(q.result)
    })
    const t = db.transaction(['packages', 'assets'])
    const rows = await Promise.all(
      ['packages', 'assets'].map(
        (s) =>
          new Promise((r) => {
            const q = t.objectStore(s).getAll()
            q.onsuccess = () => r(q.result)
          }),
      ),
    )
    db.close()
    return {
      packages: rows[0].map((p) => p.name),
      assetPackages: [...new Set(rows[1].map((a) => a.package_id))],
    }
  })
async function setup() {
  await context.route('https://meta-app.jordanhubbard.net/**', (r) =>
    r.fulfill({ contentType: 'text/javascript', body: '' }),
  )
  await context.route('**/api/offline/prepare', async (r) => {
    const body = r.request().postDataJSON()
    const m = structuredClone(seed)
    m.name = body.name
    m.id = sharedId ?? identity()
    m.revision_of = body.revision_of
    await r.fulfill({ contentType: 'application/json', body: JSON.stringify(m) })
  })
  await context.route('**/api/charts/*/members/*', async (r) => {
    if (mode === 'corrupt') {
      const response = await r.fetch({ maxRedirects: 0 })
      const original = Buffer.from(await response.body())
      assert.ok(original.length > 100)
      original[100] ^= 1
      await r.fulfill({ contentType: 'application/pdf', body: original })
    } else if (mode === 'hold') {
      await new Promise((resolve) => {
        release = resolve
      })
      await r.continue().catch(() => {})
    } else await r.continue()
  })
}
async function ready(name) {
  await page.getByLabel('Package name', { exact: true }).waitFor({ state: 'attached' })
  if (!(await page.getByLabel('Package name', { exact: true }).isVisible()))
    await page.locator('summary').filter({ hasText: 'Prepare or update a flight package' }).click()
  await page.getByLabel('Package name', { exact: true }).fill(name)
  await page.getByRole('button', { name: 'Prepare package and review size', exact: true }).click()
  await page.getByRole('button', { name: 'Download verified package', exact: true }).waitFor()
}
try {
  await setup()
  await page.goto(base + '/offline')
  await ready('Retained baseline')
  await page.getByRole('button', { name: 'Download verified package', exact: true }).click()
  await page
    .getByRole('button', { name: 'Open and verify Retained baseline', exact: true })
    .waitFor({ timeout: 60000 })
  mode = 'corrupt'
  await ready('Corrupt replacement')
  await page.getByRole('button', { name: 'Download verified package', exact: true }).click()
  await page.getByText(/Integrity check failed:/).waitFor()
  assert.deepEqual((await counts()).packages, ['Retained baseline'])
  assert.equal((await counts()).assetPackages.length, 1)
  failures.push('corrupt download rejected and partial assets removed')
  mode = 'normal'
  await ready('Quota replacement')
  await page.evaluate(() => {
    window.savedEstimate = navigator.storage.estimate.bind(navigator.storage)
    Object.defineProperty(navigator.storage, 'estimate', {
      configurable: true,
      value: async () => ({ quota: 1, usage: 1 }),
    })
  })
  await page.getByRole('button', { name: 'Download verified package', exact: true }).click()
  await page.getByText('Browser storage quota is insufficient', { exact: true }).waitFor()
  assert.deepEqual((await counts()).packages, ['Retained baseline'])
  await page.evaluate(() =>
    Object.defineProperty(navigator.storage, 'estimate', {
      configurable: true,
      value: window.savedEstimate,
    }),
  )
  failures.push('quota failure preserves old package')
  mode = 'normal'
  await ready('Mid-write quota replacement')
  await page.evaluate(() => {
    window.savedPut = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (value, ...args) {
      if (this.name === 'assets' && value.asset_id === 'asset_3')
        throw new DOMException('Injected browser write quota exhausted', 'QuotaExceededError')
      return window.savedPut.call(this, value, ...args)
    }
  })
  await page.getByRole('button', { name: 'Download verified package', exact: true }).click()
  await page.getByText('Injected browser write quota exhausted', { exact: true }).waitFor()
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = window.savedPut
  })
  assert.deepEqual((await counts()).packages, ['Retained baseline'])
  assert.equal((await counts()).assetPackages.length, 1)
  failures.push(
    'quota failure during asset writes removes partial install and preserves previous package',
  )
  mode = 'hold'
  await ready('Cancelled replacement')
  const pending = page.waitForRequest((r) => r.url().includes('/members/'))
  await page.getByRole('button', { name: 'Download verified package', exact: true }).click()
  await pending
  await page.getByRole('button', { name: 'Cancel download', exact: true }).click()
  await page
    .getByText('Download cancelled. Previous packages are unchanged.', { exact: true })
    .waitFor()
  release()
  assert.deepEqual((await counts()).packages, ['Retained baseline'])
  assert.equal((await counts()).assetPackages.length, 1)
  failures.push('cancelled download never publishes partial package')
  mode = 'hold'
  await ready('Interrupted replacement')
  const interrupted = page.waitForRequest((r) => r.url().includes('/members/'))
  await page.getByRole('button', { name: 'Download verified package', exact: true }).click()
  await interrupted
  await context.close()
  release()
  context = await chromium.launchPersistentContext(profile, {
    headless: true,
    viewport: { width: 1280, height: 900 },
  })
  page = await context.newPage()
  mode = 'normal'
  await setup()
  await page.goto(base + '/offline')
  await page
    .getByRole('button', { name: 'Open and verify Retained baseline', exact: true })
    .waitFor()
  assert.deepEqual((await counts()).packages, ['Retained baseline'])
  await page.getByRole('button', { name: 'Open and verify Retained baseline', exact: true }).click()
  await page.getByRole('heading', { name: 'Saved TAF / METAR briefing', exact: true }).waitFor()
  failures.push('browser termination leaves only previous complete package visible')
  await page
    .getByRole('button', {
      name: 'Prepare refreshed revision with pinned chart editions',
      exact: true,
    })
    .click()
  await page.getByRole('button', { name: 'Prepare package and review size', exact: true }).click()
  await page.getByRole('button', { name: 'Download verified package', exact: true }).click()
  await page
    .getByRole('button', { name: 'Open and verify Retained baseline', exact: true })
    .nth(1)
    .waitFor()
  const final = await counts()
  assert.equal(final.packages.length, 2)
  assert.equal(final.assetPackages.length, 2)
  failures.push('explicit revision keeps old package and cleans abandoned install assets')
  sharedId = identity()
  mode = 'normal'
  await ready('Concurrent first')
  const firstPage = page
  page = await context.newPage()
  await page.goto(base + '/offline')
  await ready('Concurrent second')
  const secondPage = page
  mode = 'hold'
  const held = firstPage.waitForRequest((r) => r.url().includes('/members/'))
  await firstPage.getByRole('button', { name: 'Download verified package', exact: true }).click()
  await held
  await secondPage.getByRole('button', { name: 'Download verified package', exact: true }).click()
  mode = 'normal'
  release()
  await firstPage
    .getByRole('button', { name: 'Open and verify Concurrent first', exact: true })
    .waitFor()
  await secondPage
    .getByText('This immutable package is already installed', { exact: true })
    .waitFor()
  assert.equal((await counts()).packages.length, 3)
  assert.equal((await counts()).assetPackages.length, 3)
  failures.push(
    'cross-window writer serialization rejects duplicate publication without corrupting retained packages',
  )
  writeFileSync(
    pathToFileURL(resolve(evidence, 'failure-acceptance.json')),
    JSON.stringify(
      {
        source: 'deterministic failure injection using previously acquired actual FAA/NOAA package',
        failures,
      },
      null,
      2,
    ),
  )
  console.log(
    'OFFLINE_CORRUPTION_QUOTA_CANCEL_PROCESS_TERMINATION_REVISION_AND_ORPHAN_CLEANUP_PASS',
  )
} finally {
  if (release) release()
  await context.close()
}

console.log('Evidence:', evidence)
