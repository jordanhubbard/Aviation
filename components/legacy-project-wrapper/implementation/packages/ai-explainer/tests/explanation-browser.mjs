// Real shared broker + real browser; only the external RCC transport is mocked.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, writeFile, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const impl = fileURLToPath(new URL('../../..', import.meta.url));
const root = resolve(impl, '../../..');
const require = createRequire(impl + '/package.json');
const { chromium } = require('@playwright/test');
const { ExplainerClient, startExplanationServer } = require(impl + '/packages/ai-explainer/dist/index.js');
const { traceE2EBrowser } = require(impl + '/packages/shared-sdk/dist/e2e/index.js');
const output = root + '/_build/ai-explanation-captures'; await mkdir(output, { recursive: true });
const token = 'synthetic-rcc-browser-token-never-rendered';
const executable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const browser = traceE2EBrowser(await chromium.launch({ headless: true, ...(executable ? { executablePath: executable } : {}) }),
  'flight-planner', root + '/_build/ai-explanation-traces');
async function until(check) {
  for (let attempt = 0; attempt < 100; attempt++) { if (check()) return; await new Promise(resolve => setTimeout(resolve, 20)); }
  assert.ok(check(), 'Owned explanation state did not reach the expected count');
}
try {
  for (const [name, viewport] of [['desktop', { width: 1280, height: 800 }], ['mobile', { width: 390, height: 844 }]]) {
    for (const mode of ['success', 'unconfigured', 'provider-error', 'pending-close', 'context-switch']) {
      const directory = await mkdtemp(join(tmpdir(), 'aviation-explanation-browser-'));
      let broker; let context; let sdk;
      try {
        await mkdir(join(directory, 'client'));
        for (const file of ['index.mjs', 'widget.js']) await copyFile(impl + '/packages/ai-explainer/browser/' + file, join(directory, 'client', file));
        await writeFile(join(directory, 'index.html'), `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="data:,"></head><body><h1>SDK decision consumer</h1><script type="module">
          import {registerDecisionContext} from '/client/index.mjs';
          registerDecisionContext(() => ({decision:'heading correction', wind:'270/12', heading:90}));
        </script></body></html>`);
        const requests = [];
        sdk = new ExplainerClient({ appId: 'flight-planner', brainUrl: 'http://127.0.0.1/rcc',
          publicBaseUrl: 'http://127.0.0.1', ...(mode === 'unconfigured' ? {} : { apiToken: token }),
          fetch: async (_url, options) => {
            assert.equal(options.headers.Authorization, 'Bearer ' + token);
            const body = JSON.parse(options.body); requests.push(body);
            assert.ok(!options.body.includes(token));
            if (mode === 'provider-error') return new Response(JSON.stringify({ error: token }), { status: 503 });
            const requestId = `rcc-${requests.length}`;
            if (mode !== 'pending-close') sdk.receiveCallback({ requestId,
              result: `Fixture explanation ${requests.length}. <img src=x onerror="globalThis.__explanationInjected=true">`,
              completedAt: new Date().toISOString(), model: 'sdk-fixture', metadata: body.metadata });
            return new Response(JSON.stringify({ ok: true, status: 'queued', requestId }), { status: 202 });
          } });
        broker = await startExplanationServer(sdk, { staticRoot: directory });
        context = await browser.newContext({ viewport }); const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => {
          if (message.type() === 'error' && !(mode === 'provider-error' && message.text().includes('status of 502'))) errors.push(message.text());
        });
        page.on('response', response => {
          if (response.status() >= 400 && !(mode === 'provider-error' && response.status() === 502
            && response.url() === broker.url + '/api/explain' && response.request().method() === 'POST')) {
            errors.push(`HTTP ${response.status()} ${response.url()}`);
          }
        });
        page.on('requestfailed', request => {
          if (!(mode === 'pending-close' && request.url().startsWith(broker.url + '/api/explain/requests/')
            && request.failure()?.errorText === 'net::ERR_ABORTED')) errors.push(request.failure()?.errorText + ' ' + request.url());
        });
        await page.goto(broker.url);
        await page.getByRole('button', { name: 'Explain this decision', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: 'Decision explanation', exact: true });
        await dialog.waitFor();
        if (mode === 'success') {
          await dialog.getByText('Fixture explanation 1.', { exact: false }).waitFor();
          await until(() => sdk.activeRequests === 0);
          await dialog.getByLabel('Ask a question or follow-up').fill('What about the crosswind?');
          await dialog.getByRole('button', { name: 'Ask', exact: true }).click();
          await dialog.getByText('Fixture explanation 2.', { exact: false }).waitFor();
          await until(() => sdk.activeRequests === 0);
          assert.equal(requests.length, 2);
          assert.equal(requests[1].messages.at(-1).content, 'What about the crosswind?');
          assert.ok(requests[1].messages.some(message => message.role === 'assistant' && message.content.includes('Fixture explanation 1.')));
          assert.equal(await dialog.locator('img').count(), 0, 'Model output was interpreted as markup');
          assert.equal(await page.evaluate(() => globalThis.__explanationInjected === true), false);
        } else if (mode === 'context-switch') {
          await dialog.getByText('Fixture explanation 1.', { exact: false }).waitFor();
          await page.evaluate(() => {
            window.__releaseUnselectedFixture = window.AviationExplain.registerContext(
              () => ({ decision: 'unselected wind review', wind: '270/12' }));
            window.__releaseDecisionFixture = window.AviationExplain.registerContext(
              () => ({ decision: 'selected altitude warning', altitude: 500 }));
          });
          assert.equal(await dialog.isVisible(), false, 'Changing decisions left the previous transcript open');
          await page.getByRole('button', { name: 'Explain this decision', exact: true }).click();
          await dialog.getByText('Fixture explanation 2.', { exact: false }).waitFor();
          assert.ok(requests[1].messages.some(message => message.content.includes('selected altitude warning')));
          await page.evaluate(() => window.__releaseUnselectedFixture());
          assert.equal(await dialog.isVisible(), true, 'Removing an inactive decision disturbed the active transcript');
          await page.evaluate(() => window.__releaseDecisionFixture());
          assert.equal(await dialog.isVisible(), false);
          await page.getByRole('button', { name: 'Explain this decision', exact: true }).click();
          await dialog.getByText('Fixture explanation 3.', { exact: false }).waitFor();
          assert.ok(requests[2].messages.some(message => message.content.includes('heading correction')));
          assert.ok(!requests[2].messages.some(message => message.content.includes('selected altitude warning')));
        } else if (mode === 'unconfigured') {
          await dialog.getByRole('alert').getByText('AI explanations are not configured for this application.', { exact: true }).waitFor();
          assert.equal(await dialog.getByRole('button', { name: 'Ask', exact: true }).isDisabled(), true);
          assert.equal(requests.length, 0);
        } else if (mode === 'provider-error') {
          await dialog.getByRole('alert').getByText('The AI provider could not accept this request.', { exact: true }).waitFor();
          assert.equal(requests.length, 1);
          await until(() => sdk.activeRequests === 0);
        } else {
          await dialog.getByText('Waiting for the explanation…', { exact: true }).waitFor();
          assert.equal(sdk.activeRequests, 1);
        }
        assert.ok(!(await dialog.innerText()).includes(token), 'Provider credential was rendered');
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Page overflows viewport');
        assert.equal(await dialog.evaluate(node => node.scrollWidth > node.clientWidth), false, 'Dialog overflows viewport');
        await page.screenshot({ path: `${output}/${name}-${mode}.png`, fullPage: true });
        await dialog.getByRole('button', { name: 'Close explanation', exact: true }).click();
        await until(() => sdk.activeRequests === 0);
        assert.equal(await dialog.isVisible(), false);
        assert.deepEqual(errors, []);
        console.log(`${name} ${mode}: shared UI passed; zero residual requests`);
      } finally {
        if (context) await context.close();
        if (broker) await broker.close(); else if (sdk) sdk.close();
        await rm(directory, { recursive: true, force: true });
      }
    }
  }
} finally { await browser.close(); }
