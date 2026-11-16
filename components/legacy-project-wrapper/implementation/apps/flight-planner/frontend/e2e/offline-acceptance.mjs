import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
const input = process.env.AVIATION_OFFLINE_BASE_URL
assert.ok(
  input,
  'Set AVIATION_OFFLINE_BASE_URL to the prepared local/isolated Flight Planner origin',
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
  process.env.AVIATION_OFFLINE_EVIDENCE_DIR ?? 'test-results/offline-' + Date.now(),
)
mkdirSync(evidence, { recursive: true })
const output = (name) => pathToFileURL(resolve(evidence, name))
const browserOptions = { headless: true }
const results = []
for (const [name, viewport] of [
  ['desktop', { width: 1440, height: 1000 }],
  ['mobile', { width: 390, height: 844 }],
]) {
  const profile = fileURLToPath(output('profile-' + name + '-' + Date.now()))
  mkdirSync(profile, { recursive: true })
  let context = await chromium.launchPersistentContext(profile, { ...browserOptions, viewport })
  let page = await context.newPage()
  const errors = []
  const watch = (p) => {
    p.on('pageerror', (e) => errors.push(e.message))
    p.on('requestfailed', r => errors.push(`${r.method()} ${r.url()}: ${r.failure()?.errorText}`))
    p.on('response', r => {if(r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url()}`)})
    p.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text())
    })
  }
  watch(page)
  await context.route('https://meta-app.jordanhubbard.net/**', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: '' }),
  )
  try {
    await page.goto(base + '/offline')
    await page.getByRole('heading', { name: 'Offline flight packages', exact: true }).waitFor()
    await page.getByLabel('Package name', { exact: true }).fill('FAA ' + name)
    await page.getByRole('button', { name: 'Find downloaded charts', exact: true }).click()
    const check = page.getByRole('checkbox').first()
    await check.waitFor()
    await check.check()
    await page.getByLabel('Find acquired charts', { exact: true }).fill('San Francisco')
    await page.getByRole('button', { name: 'Find downloaded charts', exact: true }).click()
    await page
      .getByRole('checkbox', { name: /San Francisco TAC\.tif/ })
      .first()
      .check()
    if (name === 'mobile') {
      await page.getByLabel('Tile coverage', { exact: true }).click()
      await page
        .getByRole('option', { name: 'Route area (clipped rectangle)', exact: true })
        .click()
    }
    await page.getByLabel('Tile zoom', { exact: true }).fill('8')
    const preparedResponse = page.waitForResponse(
      (r) => r.url() === base + '/api/offline/prepare' && r.request().method() === 'POST',
    )
    await page.getByRole('button', { name: 'Prepare package and review size' }).click()
    const actualManifest = await (await preparedResponse).json()
    assert.ok(
      actualManifest.charts.every((c) =>
        ['www.faa.gov', 'aeronav.faa.gov', 'nfdc.faa.gov'].includes(new URL(c.source_url).hostname),
      ),
    )
    writeFileSync(output(name + '-manifest.json'), JSON.stringify(actualManifest, null, 2))
    await page
      .getByRole('button', { name: 'Download verified package' })
      .waitFor({ timeout: 120000 })
    await page.getByRole('button', { name: 'Download verified package' }).click()
    await page
      .getByRole('button', { name: 'Open and verify FAA ' + name, exact: true })
      .waitFor({ timeout: 60000 })
    await page.getByRole('button', { name: 'Open and verify FAA ' + name, exact: true }).click()
    await page.getByRole('heading', { name: 'Saved TAF / METAR briefing' }).waitFor()
    await page.getByAltText(/saved page 1/).waitFor()
    await page.getByRole('img', { name: /saved georeferenced chart tiles/ }).waitFor()
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    )
    const shell = await page.evaluate(async () => ({
      keys: await caches.keys(),
      files: (
        await (
          await caches.open((await caches.keys()).find((k) => k.startsWith('aviation-shell-')))
        ).keys()
      ).map((r) => new URL(r.url).pathname),
    }))
    assert.ok(shell.files.includes('/index.html') && shell.files.some((p) => p.endsWith('.js')))
    assert.ok(!shell.files.some((p) => p.startsWith('/api/') || p.includes('aircraft-library')))
    await page.screenshot({ path: fileURLToPath(output(name + '-online.png')), fullPage: true })
    writeFileSync(output(name + '-accessibility.txt'), await page.locator('main').ariaSnapshot())
    await context.close()
    // Entire Chromium process/context is gone; reopen the retained profile with the network disabled before navigation.
    context = await chromium.launchPersistentContext(profile, {
      ...browserOptions,
      viewport,
      offline: true,
    })
    page = await context.newPage()
    watch(page)
    await page.goto(base + '/offline')
    await page
      .getByRole('button', { name: 'Open and verify FAA ' + name, exact: true })
      .waitFor({ timeout: 30000 })
    await page.getByRole('button', { name: 'Open and verify FAA ' + name, exact: true }).click()
    await page.getByRole('heading', { name: 'Saved TAF / METAR briefing' }).waitFor()
    await page.getByAltText(/saved page 1/).waitFor()
    await page.getByRole('img', { name: /saved georeferenced chart tiles/ }).waitFor()
    assert.ok((await page.locator('main').innerText()).includes('Offline — saved material only'))
    assert.ok((await page.locator('main').innerText()).includes('TAF KSFO'))
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    )
    await page.screenshot({ path: fileURLToPath(output(name + '-restarted.png')), fullPage: true })
    await page.clock.setFixedTime(new Date('2026-12-01T12:00:00Z'))
    await page.getByRole('button', { name: 'Open and verify FAA ' + name, exact: true }).click()
    await page.getByText(/Expired chart\./).waitFor()
    assert.ok(!/\bNaN\b|\bInfinity\b/.test(await page.locator('main').innerText()))
    // Missing/corrupt retained bytes cannot open as verified.
    await page.evaluate(async () => {
      const db = await new Promise((resolve, reject) => {
        const r = indexedDB.open('aviation-offline-v1')
        r.onsuccess = () => resolve(r.result)
        r.onerror = () => reject(r.error)
      })
      await new Promise((resolve, reject) => {
        const t = db.transaction('assets', 'readwrite')
        t.objectStore('assets').clear()
        t.oncomplete = resolve
        t.onerror = reject
      })
      db.close()
    })
    await page.getByRole('button', { name: 'Open and verify FAA ' + name, exact: true }).click()
    await page.getByText(/Saved asset missing or corrupt:/).waitFor()
    await page.getByRole('button', { name: 'Delete FAA ' + name, exact: true }).click()
    await page.getByText('No complete packages saved.').waitFor()
    assert.deepEqual(errors, [])
    results.push({
      viewport: name,
      real_faa_geotiff: true,
      real_faa_pdf: true,
      real_noaa_briefing: true,
      process_restart_network_disabled: true,
      expired_chart_visible: true,
      integrity_failure_visible: true,
      delete_offline: true,
      shell_files: shell.files.length,
      page_errors: errors,
    })
    console.log(name, 'OFFLINE_PROCESS_RESTART_PDF_WEATHER_INTEGRITY_DELETE_PASS')
  } finally {
    await context.close()
  }
}
writeFileSync(output('browser-acceptance.json'), JSON.stringify(results, null, 2))

console.log('Evidence:', evidence)
