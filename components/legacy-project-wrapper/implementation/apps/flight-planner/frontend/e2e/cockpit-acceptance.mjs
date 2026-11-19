import { createRequire } from 'node:module'
import { readFileSync, writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import dgram from 'node:dgram'
import { mkdirSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { launchOwnedBrowser } from '../../../../deploy/browser-runner.mjs'
const require = createRequire(new URL('../package.json', import.meta.url))
const { chromium, expect } = require('@playwright/test')
const base = process.env.AVIATION_COCKPIT_BASE_URL,
  suppliedBridge = process.env.AVIATION_COCKPIT_BRIDGE_URL,
  token = process.env.AVIATION_COCKPIT_TOKEN
if (
  !base ||
  !suppliedBridge ||
  !token ||
  token.length < 32 ||
  token.length > 512 ||
  /[\r\n]/.test(token)
)
  throw new Error(
    'Set AVIATION_COCKPIT_BASE_URL, AVIATION_COCKPIT_BRIDGE_URL and AVIATION_COCKPIT_TOKEN for an isolated loopback bridge.',
  )
const bridgeUrl = new URL(suppliedBridge)
assert.ok(
  ['http:', 'https:'].includes(bridgeUrl.protocol) &&
    ['127.0.0.1', 'localhost'].includes(bridgeUrl.hostname) &&
    !bridgeUrl.username &&
    !bridgeUrl.password &&
    !bridgeUrl.search &&
    !bridgeUrl.hash &&
    bridgeUrl.pathname === '/',
  'Use an isolated IPv4 loopback bridge origin.',
)
const bridge = bridgeUrl.origin
const evidence =
  process.env.AVIATION_COCKPIT_EVIDENCE_DIR || mkdtempSync(join(tmpdir(), 'aviation-cockpit-'))
mkdirSync(evidence, { recursive: true })
const artifact = (name) => join(evidence, name)
const vectors = JSON.parse(
  readFileSync(new URL('../../../../conformance/aviation-gdl90.json', import.meta.url)),
)
const fisb = JSON.parse(
  readFileSync(new URL('../../../../conformance/aviation-fisb.json', import.meta.url)),
)
const weather = Buffer.from(fisb.frame_hex, 'hex')
const heart = Buffer.from(vectors.reports[0].frame_hex, 'hex'),
  traffic = Buffer.from(vectors.reports[1].payload_hex, 'hex'),
  device = Buffer.from(
    vectors.reports.find((r) => r.id === 'extension-id-msl-serial64').frame_hex,
    'hex',
  )
function frame(payload) {
  let crc = 0
  for (const byte of payload)
    for (let shift = 7; shift >= 0; shift--) {
      const top = crc & 0x8000
      crc = ((crc << 1) | ((byte >> shift) & 1)) & 65535
      if (top) crc ^= 0x1021
    }
  const all = Buffer.concat([payload, Buffer.from([crc & 255, crc >> 8])]),
    out = [126]
  for (const b of all) out.push(...([125, 126].includes(b) ? [125, b ^ 32] : [b]))
  out.push(126)
  return Buffer.from(out)
}
assert.deepEqual(frame(Buffer.from('008141dbd00802', 'hex')), heart)
const own = frame(Buffer.concat([Buffer.from([10]), traffic.subarray(1)])),
  geo = frame(Buffer.from('0bff38ffff', 'hex')),
  invalid = Buffer.from('008141dbd00802', 'hex')
invalid[1] &= 127
async function state() {
  const r = await fetch(bridge + '/api/cockpit/state', {
    headers: { Authorization: 'Bearer ' + token },
  })
  assert.equal(r.status, 200)
  return r.json()
}
const initial = await state()
assert.equal(initial.listening, false, 'Refusing to control an already running bridge.')
assert.equal(initial.udp_bind, '127.0.0.1')
assert.equal(initial.receivers.length, 0, 'Use a fresh isolated bridge process.')
const browser = await launchOwnedBrowser(chromium, { headless: true }),
  results = []
try {
  for (const [label, viewport] of [
    ['desktop', { width: 1440, height: 1000 }],
    ['mobile', { width: 390, height: 844 }],
  ]) {
    const context = await browser.newContext({ viewport })
    await context.route('https://meta-app.jordanhubbard.net/**', (r) =>
      r.fulfill({ contentType: 'text/javascript', body: '' }),
    )
    const page = await context.newPage(),
      errors = [],
      requests = []
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text())
    })
    page.on('requestfailed', (r) => errors.push('request failed ' + r.url()))
    page.on('response', (r) => {
      if (r.status() >= 400) errors.push('HTTP ' + r.status() + ' ' + r.url())
    })
    page.on('request', (r) => {
      if (r.url().startsWith(bridge)) requests.push({ method: r.method(), url: r.url() })
    })
    const a = dgram.createSocket('udp4'),
      b = dgram.createSocket('udp4')
    await new Promise((done) => a.bind(0, '127.0.0.1', done))
    await new Promise((done) => b.bind(0, '127.0.0.1', done))
    try {
      await page.goto(base + '/cockpit')
      await page.getByRole('heading', { name: 'Cockpit receiver', exact: true }).waitFor()
      assert.equal(requests.length, 0)
      assert.equal((await state()).listening, false)
      await page.getByLabel('Bridge origin', { exact: true }).fill(bridge)
      await page.getByLabel('Bridge operator token', { exact: true }).fill(token)
      await page.getByRole('button', { name: 'Connect and read snapshot', exact: true }).click()
      await page.getByText('Receiver listener stopped.', { exact: false }).waitFor()
      assert.equal(
        await page.getByLabel('Monitor every 2 seconds', { exact: true }).isChecked(),
        false,
      )
      await page.getByRole('button', { name: 'Start receiver listener', exact: true }).click()
      await page
        .getByText('Listener running; no current receiver telemetry.', { exact: false })
        .waitFor()
      const started = await state()
      assert.equal(started.listening, true)
      async function send(sock, data) {
        await new Promise((done, reject) =>
          sock.send(data, started.udp_port, '127.0.0.1', (e) => (e ? reject(e) : done())),
        )
      }
      await send(a, Buffer.concat([device, heart, own, geo, frame(traffic), weather, weather]))
      await send(b, Buffer.concat([frame(invalid), own, geo, weather]))
      let observed
      for (let n = 0; n < 30; n++) {
        observed = await state()
        if (observed.receivers.length === 2 && observed.weather.length === 10) break
        await new Promise((r) => setTimeout(r, 50))
      }
      assert.equal(observed.receivers.length, 2)
      assert.equal(observed.weather.length, 10)
      assert.equal(observed.counters.duplicate_weather, 5)
      assert.ok(
        observed.weather.every(
          (row) =>
            !row.live &&
            row.report.product_age_seconds === null &&
            row.report.validity === 'unassessed',
        ),
      )
      await page.getByRole('button', { name: 'Refresh snapshot', exact: true }).click()
      await page.getByRole('heading', { name: 'Receivers (2)', exact: true }).waitFor()
      await page.getByRole('heading', { name: 'Receiver weather (10)', exact: true }).waitFor()
      assert.equal(
        await page.getByText('Receiver weather decoding is unavailable.', { exact: false }).count(),
        0,
      )
      await page.getByText('Complete FIS-B text weather is supported;', { exact: false }).waitFor()
      const badge = page.getByText('Product validity unassessed', { exact: true }).first()
      const badgeColors = await badge.evaluate((element) => {
        const style = getComputedStyle(element.closest('.MuiChip-root'))
        return { foreground: style.color, background: style.backgroundColor }
      })
      const luminance = (css) => {
        const [r, g, b] = css
          .match(/[0-9.]+/g)
          .slice(0, 3)
          .map(Number)
          .map((n) => {
            const value = n / 255
            return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
          })
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
      }
      const contrast =
        (luminance(badgeColors.foreground) + 0.05) / (luminance(badgeColors.background) + 0.05)
      assert.ok(
        Math.max(contrast, 1 / contrast) >= 4.5,
        'Unassessed validity text must be readable',
      )

      assert.equal(await page.getByText('Product validity unassessed', { exact: true }).count(), 10)
      await page
        .getByText('Report time (as received): ' + fisb.expected_report_time, { exact: true })
        .first()
        .waitFor()
      await page
        .getByRole('region', { name: 'Receiver weather' })
        .screenshot({ path: artifact('cockpit-weather-' + label + '.png') })
      await page.getByText('Ownship GPS fix: Valid', { exact: true }).waitFor()
      await page.getByText('Ownship GPS fix: Invalid', { exact: true }).waitFor()
      await page.getByText('Geometric altitude: -1000 ft · MSL', { exact: true }).waitFor()
      await page
        .getByText('Geometric altitude: -1000 ft · WGS84_ellipsoid', { exact: true })
        .waitFor()
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
      )
      await expect(
        page.getByRole('button', { name: 'Refresh snapshot', exact: true }),
      ).toBeEnabled()
      await page.screenshot({ path: artifact('cockpit-ui-' + label + '.png'), fullPage: true })
      writeFileSync(
        artifact('cockpit-ui-' + label + '-accessibility.txt'),
        await page.locator('main').ariaSnapshot(),
      )
      const before = requests.filter((r) => r.url.endsWith('/state')).length
      await page.waitForTimeout(6500)
      assert.equal(requests.filter((r) => r.url.endsWith('/state')).length, before)
      await page.getByText('Ownship GPS fix: Unknown / not current', { exact: true }).waitFor()
      assert.equal(await page.getByText('Ownship GPS fix: Valid', { exact: true }).count(), 0)
      await page.getByLabel('Monitor every 2 seconds', { exact: true }).check()
      await page.waitForTimeout(2300)
      assert.ok(requests.filter((r) => r.url.endsWith('/state')).length > before)
      await page.getByRole('button', { name: 'Stop receiver listener', exact: true }).click()
      await page.getByText('Receiver listener stopped.', { exact: false }).waitFor()
      assert.equal((await state()).listening, false)
      assert.equal(await page.getByText('Fresh receipt', { exact: true }).count(), 0)
      await page.getByRole('button', { name: 'Disconnect and clear', exact: true }).click()
      assert.equal(await page.getByLabel('Bridge operator token', { exact: true }).inputValue(), '')
      assert.equal(
        await page.getByRole('heading', { name: 'Receivers (2)', exact: true }).count(),
        0,
      )
      const stopped = requests.length
      await page.waitForTimeout(2300)
      assert.equal(requests.length, stopped)
      const storage = await page.evaluate(() => ({
        local: JSON.stringify(localStorage),
        session: JSON.stringify(sessionStorage),
      }))
      assert.ok(!JSON.stringify(storage).includes(token))
      assert.deepEqual(errors, [])
      results.push({
        viewport: label,
        no_startup_contact: true,
        explicit_native_start_stop: true,
        two_source_udp: true,
        native_fisb_text: true,
        weather_reports: observed.weather.length,
        weather_deduplication: true,
        product_validity_unassessed: true,
        ownship_validity_separate: true,
        distinct_altitude_datums: true,
        no_implicit_polling: true,
        local_staleness: true,
        opt_in_polling: true,
        disconnect_clears_private_state: true,
        no_persisted_token: true,
        no_document_overflow: true,
        errors,
      })
    } finally {
      await fetch(bridge + '/api/cockpit/stop', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
      })
      a.close()
      b.close()
      await context.close()
    }
  }
  writeFileSync(
    artifact('cockpit-ui-acceptance.json'),
    JSON.stringify({ hardware_evidence: false, results }, null, 2),
  )
  console.log('NATIVE_COCKPIT_DESKTOP_MOBILE_CONTROL_UDP_FRESHNESS_PRIVACY_PASS')
} catch (error) {
  throw new Error(String(error).split(token).join('[redacted]'))
} finally {
  await browser.close()
}
