#!/usr/bin/env node
// Run against a deployed app or a local production build. AVIATION_E2E_SECRET
// must match the server; no fixture is created in the production database.
import { existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { chromium } from '@playwright/test';
import {
  installE2EApiHeaders, runE2EScreens, seedRemoteFixture,
  installE2ENetworkMocks, standardE2EFixtures, standardE2EMocks,
  standardForeFlightCsv, withE2ERun, parseE2ERunId, traceE2EBrowser,
  createE2ERunId, exerciseE2EFeedback,
} from '@aviation/shared-sdk/e2e';

const appId = process.argv[2];
if (!['aviation-accident-tracker', 'aviation-chat', 'preflight-check', 'meta-app',
  'weather-briefing', 'flight-tracker', 'g1000-simulator', 'foreflight-dashboard',
  'flight-planner', 'flight-track-analyzer', 'aviation-missions-app', 'flightschool'].includes(appId)) {
  throw new Error(`No remote E2E screen adapter for ${appId || '(missing app)'}`);
}
const inventory = JSON.parse(readFileSync(new URL('../../../../verification/remote-e2e.json', import.meta.url), 'utf8'));
if (inventory.schema !== 'aviation/remote-e2e-inventory@1' || !inventory.apps[appId]) {
  throw new Error(`Missing remote E2E inventory for ${appId}`);
}
let latestPage;
const viewport = process.env.AVIATION_E2E_VIEWPORT || 'desktop';
if (!['desktop', 'mobile'].includes(viewport)) throw new Error('Invalid E2E viewport');
const browserContextOptions = { viewport: viewport === 'mobile'
  ? { width: 390, height: 844 } : { width: 1280, height: 720 } };
const feedbackRunId = process.env.AVIATION_E2E_RUN_ID || createE2ERunId();
const runDeclaredScreens = async (expectedIds, screens) => {
  const declared = inventory.apps[appId];
  if (declared.kind === 'dynamic-flask-routes') {
    if (appId !== 'flightschool' || expectedIds.length < declared.minimum) {
      throw new Error(`Incomplete dynamic screen inventory for ${appId}`);
    }
  } else if (appId !== 'aviation-chat') {
    if (!latestPage) throw new Error(`Missing browser page for ${appId} feedback E2E`);
    expectedIds = [...expectedIds, 'feedback'];
    screens = [...screens, feedbackScreen(latestPage, feedbackRunId)];
  }
  if (declared.kind !== 'dynamic-flask-routes'
    && JSON.stringify([...expectedIds].sort()) !== JSON.stringify([...declared.ids].sort())) {
    throw new Error(`Remote E2E inventory differs from adapter for ${appId}`);
  }
  if (process.env.AVIATION_E2E_FAIL_AFTER_SCREEN
    && (!process.env.AVIATION_E2E_RUN_ID || !expectedIds.includes(process.env.AVIATION_E2E_FAIL_AFTER_SCREEN))) {
    throw new Error('Fault injection requires a declared screen in an isolated run');
  }
  await runE2EScreens(expectedIds, screens.map(screen => ({ ...screen,
    verify: async () => {
      await screen.verify();
      if (process.env.AVIATION_E2E_FAIL_AFTER_SCREEN === screen.id) {
        throw new Error(`Injected E2E failure after ${screen.id}`);
      }
      const captureDirectory = process.env.AVIATION_E2E_CAPTURE_DIR;
      const capturePage = screen.page || latestPage;
      if (captureDirectory && capturePage && declared.kind !== 'endpoints') {
        mkdirSync(captureDirectory, { recursive: true });
        const screenName = screen.id.replace(/[^a-z0-9-]/gi, '_');
        const stem = join(captureDirectory, `${appId}-${screenName}-${viewport}`);
        await capturePage.screenshot({ path: `${stem}.png`, fullPage: true, animations: 'disabled' });
        if (await capturePage.locator('dialog[open], [role="dialog"], .modal-overlay').count()) {
          await capturePage.screenshot({ path: `${stem}-viewport.png`, animations: 'disabled' });
        }
        writeFileSync(`${stem}.txt`, await capturePage.locator('body').innerText());
      }
      console.log(JSON.stringify({ schema: 'aviation/e2e-screen-result@1', app: appId,
        screen: screen.id, viewport, dataMode: screen.dataMode, result: 'passed' }));
      if (screen.afterVerify) await screen.afterVerify();
    },
  })));
};
const baseUrl = process.env.AVIATION_E2E_BASE_URL || `https://${appId}.jordanhubbard.net`;
const isolatedHost = ['127.0.0.1', 'localhost'].includes(new URL(baseUrl).hostname);
const feedbackScript = isolatedHost
  ? readFileSync(new URL('../apps/meta-app/public/feedback-widget.js', import.meta.url), 'utf8') : null;
const installIsolatedFeedbackScript = async page => {
  latestPage = page;
  if (feedbackScript) await page.route('https://meta-app.jordanhubbard.net/feedback-widget.js', route =>
    route.fulfill({ status: 200, contentType: 'text/javascript', body: feedbackScript }));
};
const feedbackScreen = (page, runId) => ({
  id: 'feedback', dataMode: 'sdk-mock',
  visit: () => exerciseE2EFeedback(page, appId, runId),
  verify: async () => {},
});
if (appId === 'flightschool' && !process.env.AVIATION_E2E_BASE_URL) {
  throw new Error('Flight School E2E requires an isolated application instance URL');
}
const secret = process.env.AVIATION_E2E_SECRET
  || (!['aviation-accident-tracker', 'aviation-chat', 'flight-track-analyzer', 'flightschool'].includes(appId) ? randomBytes(32).toString('hex') : '');
if (secret.length < 32) throw new Error('AVIATION_E2E_SECRET must have at least 32 characters');
const executable = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  || (existsSync(chromium.executablePath()) ? undefined
    : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');

if (appId === 'flightschool') {
  const existingRunId = parseE2ERunId(process.env.AVIATION_E2E_RUN_ID);
  const browser = traceE2EBrowser(await chromium.launch({ headless: true, ...(executable ? { executablePath: executable } : {}) }), appId, process.env.AVIATION_E2E_TRACE_DIR);
  try {
    await withE2ERun(secret, async run => {
      const headers = run.headersFor(appId);
      let status;
      for (let attempt = 0; attempt < 60; attempt++) {
        try { status = await fetch(new URL('/__e2e/status', baseUrl), { headers }); }
        catch { /* app may still be starting */ }
        if (status) break;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      if (!status) throw new Error('Flight School isolated instance never became ready');
      if (!status.ok) throw new Error(`Flight School isolated instance returned HTTP ${status.status}`);
      const state = await status.json();
      if (state.test_run_id !== run.id || state.is_test_data !== true || state.count < 3) {
        throw new Error('Flight School test database lacks tagged sample users');
      }
      const routesResponse = await fetch(new URL('/__e2e/routes', baseUrl), { headers });
      if (!routesResponse.ok) throw new Error('Flight School route inventory unavailable');
      const declared = (await routesResponse.json()).routes;
      const omit = new Set(['/__e2e/routes', '/__e2e/status', '/health', '/api/settings', '/auth/login',
        '/auth/logout', '/auth/google-auth', '/auth/google-callback',
        '/admin/calendar/oauth', '/admin/calendar/callback',
        '/settings/calendar/authorize', '/settings/calendar/callback', '/settings/calendar/disconnect']);
      const screens = declared.filter(path => !omit.has(path));
      if (screens.length < 50) throw new Error(`Flight School screen inventory unexpectedly small: ${screens.length}`);
      const origin = new URL(baseUrl).origin;
      const errors = [];
      const pages = {};
      for (const role of ['admin', 'instructor', 'student']) {
        const context = await browser.newContext(browserContextOptions);
        run.onCleanup(() => context.close());
        const page = await context.newPage();
        await installIsolatedFeedbackScript(page);
        pages[role] = page;
        await page.route(`${origin}/**`, route => route.continue({ headers: {
          ...route.request().headers(), ...run.headersFor(appId),
        } }));
        page.on('pageerror', error => errors.push(`${role}: ${error.message}`));
        page.on('console', message => {
          if (message.type() === 'error') errors.push(`${role}: ${message.text()}`);
        });
        page.on('response', response => {
          if (new URL(response.url()).origin === origin && response.status() >= 400) {
            errors.push(`${role}: HTTP ${response.status()} ${new URL(response.url()).pathname}`);
          }
        });
        const loginResponse = await page.goto(new URL('/auth/login', baseUrl).toString(), { waitUntil: 'domcontentloaded' });
        if (!loginResponse?.ok()) throw new Error(`Flight School ${role} login returned HTTP ${loginResponse?.status()}`);
        if (!await page.getByLabel('Email').count()) throw new Error(`Flight School ${role} login has no email field`);
        await page.getByLabel('Email').fill(`${role}-${run.id}@example.com`);
        await page.getByLabel('Password').fill(run.id);
        await page.getByRole('button', { name: 'Sign In' }).click();
        await page.waitForURL(role === 'admin' ? /\/admin\/dashboard/ : /\/dashboard/);
      }
      const roleFor = path => path.startsWith('/admin/') || path === '/debug' ? 'admin'
        : path.startsWith('/instructor/') ? 'instructor' : 'student';
      const pathFor = path => path.replaceAll('<int:booking_id>',
        path.startsWith('/flight/summary/') ? '3'
          : /^\/flight\/(status|check-out)\//.test(path) ? '2' : '1')
        .replaceAll('<int:aircraft_id>', '1').replaceAll('<int:id>', '1');
      await runDeclaredScreens(screens, screens.map(path => ({
        id: path, dataMode: 'tagged-database',
        page: pages[roleFor(path)],
        visit: async () => {
          const role = roleFor(path);
          const page = pages[role];
          const response = await page.goto(new URL(pathFor(path), baseUrl).toString(), { waitUntil: 'domcontentloaded' });
          if (!response || response.status() >= 400) throw new Error(`${path} returned HTTP ${response?.status()}`);
          // This alias intentionally opens the same user form with an instructor type.
          const expected = path === '/admin/instructor/create' ? '/admin/user/create' : pathFor(path);
          if (new URL(page.url()).pathname !== expected) {
            throw new Error(`${path} redirected to ${new URL(page.url()).pathname}, expected ${expected}`);
          }
        },
        verify: async () => {
          const role = roleFor(path);
          const page = pages[role];
          const body = await page.locator('body').innerText();
          if (/Internal Server Error|Something went wrong|Application Error/i.test(body)) {
            throw new Error(`${path} rendered an error page`);
          }
          if (errors.length) throw new Error(`${path} browser errors: ${errors.join('; ')}`);
        },
      })));
      const student = pages.student;
      const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      await student.goto(new URL('/waitlist', baseUrl).toString());
      await student.locator('#requested_date').fill(tomorrow);
      await student.getByRole('button', { name: 'Join waitlist' }).click();
      await student.getByText('Added to the waitlist.').waitFor();
      const afterWrite = await fetch(new URL('/__e2e/status', baseUrl), { headers: run.headersFor(appId) });
      if (!afterWrite.ok || (await afterWrite.json()).waitlist_count !== 1) {
        throw new Error('Flight School tagged waitlist write was not isolated in the test database');
      }
      await exerciseE2EFeedback(student, appId, run.id);
      console.log(`Flight School visited ${screens.length} declared GET screens`);
    }, existingRunId);
  } finally { await browser.close(); }
  console.log(`remote E2E passed: ${appId} (${baseUrl}); isolated instance cleanup is external`);
} else if (appId === 'aviation-missions-app') {
  if (!isolatedHost || !process.env.AVIATION_E2E_RUN_ID) {
    throw new Error('Missions E2E requires a signed isolated application instance');
  }
  const isolatedRunId = parseE2ERunId(process.env.AVIATION_E2E_RUN_ID);
  const browser = traceE2EBrowser(await chromium.launch({ headless: true, ...(executable ? { executablePath: executable } : {}) }), appId, process.env.AVIATION_E2E_TRACE_DIR);
  try {
    await withE2ERun(secret, async run => {
      let adminToken;
      const api = async (path, method = 'GET', body, authenticated = false) => {
        const response = await fetch(new URL(path, baseUrl), { method,
          headers: { ...run.headersFor(appId), 'content-type': 'application/json',
            ...(authenticated ? { authorization: `Bearer ${adminToken}` } : {}) },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
        if (!response.ok) throw new Error(`Missions ${method} ${path}: HTTP ${response.status()}`);
        return response.json();
      };
      const initial = await api('/__e2e/status');
      if (initial.test_run_id !== run.id || initial.is_test_data !== true) {
        throw new Error('Missions isolated H2 store is not bound to this run');
      }
      // Remove bundled catalog examples inside this disposable instance only.
      await api(`/__e2e/runs/${run.id}`, 'DELETE');
      const fixtureFetch = async (...args) => {
        const response = await fetch(...args);
        if (response.ok && args[1]?.method === 'GET' && new URL(args[0]).pathname === `/__e2e/runs/${run.id}`) {
          const residual = await response.clone().json();
          console.log(JSON.stringify({ schema: 'aviation/e2e-residual@1', app: appId,
            run: run.id, count: residual.count, tables: residual.tables }));
        }
        return response;
      };
      const mission = await seedRemoteFixture(run, { appId, baseUrl, fetch: fixtureFetch }, 'mission',
        { ...standardE2EFixtures(run.id).mission, title: `E2E Pattern Mission ${run.id}`,
          difficulty: 2, pilot_experience: 'Beginner (< 100 hours)',
          mission_description: 'Synthetic mission for remote E2E', why_description: 'Test mission navigation',
          route: 'KOAK KSFO', notes: `No flight required ${run.id}` });
      const context = await browser.newContext(browserContextOptions);
      run.onCleanup(async () => {
        await context.clearCookies();
        await context.close();
      });
      const page = await context.newPage();
      await installIsolatedFeedbackScript(page);
      const origin = new URL(baseUrl).origin;
      const errors = [];
      const wirePage = async target => {
        await target.route(`${origin}/**`, route => route.continue({ headers: {
          ...route.request().headers(), ...run.headersFor(appId),
        } }));
        target.on('pageerror', error => errors.push(error.message));
        target.on('console', message => {
          if (message.type() === 'error') errors.push(message.text());
        });
        target.on('response', response => {
          if (new URL(response.url()).origin === origin && response.status() >= 400) {
            errors.push(`HTTP ${response.status()} ${new URL(response.url()).pathname}`);
          }
        });
      };
      await wirePage(page);
      const dialogs = [];
      page.on('dialog', async dialog => {
        dialogs.push(dialog.message());
        await dialog.accept(dialog.type() === 'prompt' ? `E2E Pilot ${run.id}` : undefined);
      });
      const card = page.locator(`.mission-card[data-mission-id="${mission.id}"]`);
      const submittedTitle = `Submitted ${run.id}`;
      const suggestedTitle = `Suggested ${run.id}`;
      const submission = title => ({ title, category: 'Training', difficulty: 2,
        pilot_experience: 'Beginner (< 100 hours)', objective: 'Synthetic pattern',
        mission_description: 'Practice a synthetic approach', why_description: 'Exercise isolated persistence',
        route: 'KOAK KSFO', suggested_route: 'KOAK KSFO', submitter_name: `E2E Pilot ${run.id}`,
        submitter_email: 'e2e@example.com', notes: `Synthetic mission ${run.id}` });
      const fillForm = async (form, title) => {
        for (const [name, value] of Object.entries(submission(title))) {
          const field = form.locator(`[name="${name}"]`);
          if (!await field.count()) continue;
          if (await field.evaluate(element => element.tagName) === 'SELECT') await field.selectOption(String(value));
          else await field.fill(String(value));
        }
      };
      const comment = await api(`/missions/${mission.id}/comments`, 'POST', {
        author_name: 'E2E Pilot', content: `Synthetic comment ${run.id}` });
      const completion = await api(`/missions/${mission.id}/completed`, 'POST', {
        pilot_name: 'E2E Pilot', completion_date: '2026-01-01', notes: `Synthetic completion ${run.id}` });
      const rating = await api(`/missions/${mission.id}/rating`, 'POST', {
        pilot_name: `E2E Pilot ${run.id}`, rating: 'up' });
      await api(`/missions/${mission.id}/reviews`, 'POST', {
        pilot_name: `E2E Pilot ${run.id}`, review_text: `Synthetic review ${run.id}`, flight_date: '2026-01-01' });
      const reviews = await api(`/missions/${mission.id}/reviews`);
      if (reviews.reviews.length !== 1) throw new Error('Isolated review was not persisted');
      // Ratings intentionally expose a public projection. Their database tags are
      // checked by test-store-state together with every other table.
      if (rating.rating?.rating !== 'up') throw new Error('Isolated rating was not persisted');
      for (const record of [mission, comment.comment, completion.completion, reviews.reviews[0]]) {
        if (record.test_run_id !== run.id || record.is_test_data !== true) throw new Error('Missions fixture lost its run tags');
      }
      let updateId;
      let rejectedUpdateId;
      let publishedId;
      const docsPage = await context.newPage();
      await wirePage(docsPage);
      const screenIds = ['mission-list', 'filters', 'brief', 'comments', 'completed-feedback',
        'completion-submit', 'suggest-edit', 'create-form', 'admin-login', 'admin-dashboard',
        'submission-review', 'edit-review', 'edit-status', 'submission-reject', 'edit-reject',
        'delete-mission', 'logout', 'api-docs'];
      await runDeclaredScreens(screenIds, [
        { id: 'mission-list', dataMode: 'tagged-database',
          visit: () => page.goto(baseUrl, { waitUntil: 'domcontentloaded' }),
          verify: async () => {
            await page.getByRole('heading', { name: mission.title, exact: true }).waitFor();
            if (await page.locator('.mission-card').count() !== 1) throw new Error('Missions catalog leaked into isolated fixtures');
          } },
        { id: 'filters', dataMode: 'tagged-database',
          visit: () => page.locator('#searchInput').fill('NO_MATCH_E2E'),
          verify: async () => {
            await page.getByText('No missions found matching your criteria.').waitFor();
            await page.locator('#searchInput').fill('Pattern Mission');
            await card.waitFor();
            await page.locator('#searchInput').fill('');
          } },
        { id: 'brief', dataMode: 'tagged-database',
          visit: () => card.getByRole('button', { name: 'BRIEF' }).click(),
          verify: async () => {
            await page.locator('.modal-overlay').getByRole('heading', { name: mission.title }).waitFor();
            await page.locator('.modal-overlay').getByText('Synthetic mission for remote E2E', { exact: false }).waitFor();
          }, afterVerify: () => page.locator('.modal-close').click() },
        { id: 'comments', dataMode: 'tagged-database',
          visit: () => card.getByRole('button', { name: /Comments/ }).click(),
          verify: async () => {
            await page.getByText(`Synthetic comment ${run.id}`, { exact: true }).waitFor();
            await page.locator('#comment-author').fill('E2E Pilot');
            await page.locator('#comment-content').fill(`Browser comment ${run.id}`);
            const saved = page.waitForResponse(r => new URL(r.url()).pathname === `/missions/${mission.id}/comments`
              && r.request().method() === 'POST');
            await page.getByRole('button', { name: 'Post Comment', exact: true }).click();
            const response = await saved;
            if (response.status() !== 201) {
              throw new Error(`Browser comment failed: HTTP ${response.status()}`);
            }
            await page.locator('.modal-overlay').waitFor({ state: 'hidden' });
            await card.getByRole('button', { name: /Comments/ }).click();
            await page.getByText(`Browser comment ${run.id}`, { exact: true }).waitFor();
          }, afterVerify: () => page.locator('.modal-close').click() },
        { id: 'completed-feedback', dataMode: 'tagged-database',
          visit: () => card.getByRole('button', { name: /Completed/ }).click(),
          verify: async () => {
            const modal = page.locator('.modal-overlay');
            await modal.getByText(`Synthetic completion ${run.id}`).waitFor();
            await modal.locator('input[name="author_name"]').fill('E2E Reviewer');
            await modal.locator('textarea[name="content"]').fill(`Synthetic feedback ${run.id}`);
            await modal.getByRole('button', { name: 'Post feedback' }).click();
            await modal.getByText(`Synthetic feedback ${run.id}`).waitFor();
          }, afterVerify: () => page.locator('.modal-close').click() },
        { id: 'completion-submit', dataMode: 'tagged-database',
          visit: async () => {
            await card.getByRole('button', { name: /Completed/ }).click();
            await page.locator('.modal-overlay').getByRole('button', { name: 'Mark completed' }).click();
          },
          verify: async () => {
            await page.locator('.modal-overlay').getByText(`E2E Pilot ${run.id}`, { exact: false }).first().waitFor();
            const stored = await api(`/missions/${mission.id}/completed`);
            if (stored.completions.length !== 2 || stored.completions.some(c => c.test_run_id !== run.id)) {
              throw new Error('Browser completion did not reach isolated H2');
            }
          }, afterVerify: () => page.locator('.modal-close').click() },
        { id: 'suggest-edit', dataMode: 'tagged-database',
          visit: () => card.getByRole('button', { name: /EDIT/ }).click(),
          verify: async () => {
            const form = page.locator('#editSuggestionForm');
            await fillForm(form, suggestedTitle);
            const saved = page.waitForResponse(r => new URL(r.url()).pathname === `/missions/${mission.id}` && r.request().method() === 'PUT');
            await form.getByRole('button', { name: 'Submit Suggestion' }).click();
            const response = await saved;
            if (response.status() !== 201) throw new Error('Edit suggestion was not persisted');
            updateId = (await response.json()).update_id;
            await page.locator('.modal-overlay').waitFor({ state: 'hidden' });
          } },
        { id: 'create-form', dataMode: 'tagged-database',
          visit: () => page.getByRole('button', { name: 'Create Mission' }).first().click(),
          verify: async () => {
            const form = page.locator('#newMissionForm');
            await fillForm(form, submittedTitle);
            const saved = page.waitForResponse(r => new URL(r.url()).pathname === '/submissions' && r.request().method() === 'POST');
            await form.getByRole('button', { name: 'Create Mission', exact: true }).click();
            if ((await saved).status() !== 201) throw new Error('Submission was not persisted');
            await page.locator('#newMissionForm').waitFor({ state: 'hidden' });
          } },
        { id: 'admin-login', dataMode: 'tagged-database',
          visit: async () => {
            await page.getByRole('button', { name: 'Admin Login' }).click();
            await page.locator('#adminLoginForm input[name="admin_name"]').fill('E2E Admin');
            await page.locator('#adminLoginForm input[name="password"]').fill(run.id);
            await page.locator('#adminLoginForm').getByRole('button', { name: 'Login', exact: true }).click();
          },
          verify: async () => {
            await page.locator('.admin-status').filter({ hasText: 'Admin: E2E Admin' }).waitFor();
            adminToken = await page.evaluate(() => localStorage.getItem('admin_token'));
            if (!adminToken) throw new Error('Real admin session missing');
            await page.locator('#adminDashboard .submission-card').filter({ hasText: submittedTitle }).waitFor();
            await page.locator('#adminDashboard .update-card').filter({ hasText: suggestedTitle }).waitFor();
          } },
        { id: 'admin-dashboard', dataMode: 'tagged-database',
          visit: () => page.reload({ waitUntil: 'domcontentloaded' }),
          verify: async () => {
            await page.locator('#adminDashboard .submission-card').filter({ hasText: submittedTitle }).waitFor();
            await page.locator('#adminDashboard .update-card').filter({ hasText: suggestedTitle }).waitFor();
          } },
        { id: 'submission-review', dataMode: 'tagged-database',
          visit: () => page.locator('#adminDashboard .submission-card').filter({ hasText: submittedTitle })
            .getByRole('button', { name: 'Approve', exact: true }).click(),
          verify: async () => {
            await page.locator('.mission-card').getByRole('heading', { name: submittedTitle, exact: true }).waitFor();
            const stored = (await api('/missions')).missions.find(m => m.title === submittedTitle);
            if (!stored || stored.test_run_id !== run.id) throw new Error('Approval did not create a tagged mission');
            publishedId = stored.id;
          } },
        { id: 'edit-review', dataMode: 'tagged-database',
          visit: () => page.locator('#adminDashboard .update-card').filter({ hasText: suggestedTitle })
            .getByRole('button', { name: 'Approve', exact: true }).click(),
          verify: async () => {
            await card.getByRole('heading', { name: suggestedTitle, exact: true }).waitFor();
            if ((await api(`/updates/${updateId}/status`)).status !== 'approved') throw new Error('Edit was not approved in H2');
          } },
        { id: 'edit-status', dataMode: 'tagged-database',
          visit: () => page.reload({ waitUntil: 'domcontentloaded' }),
          verify: async () => {
            await card.waitFor();
            await page.waitForFunction(id => !JSON.parse(localStorage.getItem('mission_edit_suggestions') || '[]')
              .some(item => item.id === id), updateId);
            if (!dialogs.some(text => text.includes('was approved'))) throw new Error('Approved edit notification missing');
            const tracked = await page.evaluate(() => JSON.parse(localStorage.getItem('mission_edit_suggestions') || '[]'));
            if (tracked.some(item => item.id === updateId)) throw new Error('Approved edit stayed pending in browser storage');
          } },
        { id: 'submission-reject', dataMode: 'tagged-database',
          visit: async () => {
            await api('/submissions', 'POST', submission(`Rejected ${run.id}`));
            await page.reload({ waitUntil: 'domcontentloaded' });
            await page.locator('#adminDashboard .submission-card').filter({ hasText: `Rejected ${run.id}` })
              .getByRole('button', { name: 'Reject', exact: true }).click();
          },
          verify: async () => {
            await page.getByText('No pending submissions.', { exact: true }).waitFor();
            const rows = (await api('/submissions', 'GET', undefined, true)).submissions;
            if (!rows.some(row => row.title === `Rejected ${run.id}` && row.status === 'rejected')) throw new Error('Submission rejection was not persisted');
          } },
        { id: 'edit-reject', dataMode: 'tagged-database',
          visit: async () => {
            rejectedUpdateId = (await api(`/missions/${mission.id}`, 'PUT', submission(`Rejected edit ${run.id}`))).update_id;
            await page.reload({ waitUntil: 'domcontentloaded' });
            await page.locator('#adminDashboard .update-card').filter({ hasText: `Rejected edit ${run.id}` })
              .getByRole('button', { name: 'Reject', exact: true }).click();
          },
          verify: async () => {
            await page.getByText('No pending edit suggestions.', { exact: true }).waitFor();
            if ((await api(`/updates/${rejectedUpdateId}/status`)).status !== 'rejected') throw new Error('Edit rejection was not persisted');
            if ((await api(`/missions/${mission.id}`)).mission.title !== suggestedTitle) throw new Error('Rejected edit changed the mission');
          } },
        { id: 'delete-mission', dataMode: 'tagged-database',
          visit: async () => {
            await api(`/missions/${publishedId}`, 'DELETE', undefined, true);
            await page.reload({ waitUntil: 'domcontentloaded' });
          },
          verify: async () => {
            await card.waitFor();
            if (await page.locator(`.mission-card[data-mission-id="${publishedId}"]`).count()) throw new Error('Deleted mission remained visible');
            const state = await api('/__e2e/status');
            if (state.mission_count !== 1 || state.tables.comments !== 2 || state.tables.mission_completions !== 2
              || state.tables.completion_feedback !== 1 || state.tables.submissions !== 2 || state.tables.mission_updates !== 2
              || state.tables.mission_ratings !== 1 || state.tables.reviews !== 1) {
              throw new Error(`Missions persistent lifecycle counts differ: ${JSON.stringify(state.tables)}`);
            }
          } },
        { id: 'logout', dataMode: 'isolated-browser',
          visit: () => page.getByRole('button', { name: 'Logout', exact: true }).click(),
          verify: async () => {
            await page.getByRole('button', { name: 'Admin Login' }).waitFor();
            if (await page.evaluate(() => localStorage.getItem('admin_token'))) throw new Error('Browser admin token remained after logout');
          } },
        { id: 'api-docs', dataMode: 'stateless', page: docsPage,
          visit: () => docsPage.goto(new URL('/api', baseUrl).toString(), { waitUntil: 'domcontentloaded' }),
          verify: async () => {
            await docsPage.locator('#swagger-ui .info .title').waitFor();
            if (!(await api('/swagger.json')).paths?.['/missions']) throw new Error('API documentation omitted missions');
            if (errors.length) throw new Error(`Missions browser errors: ${errors.join('; ')}`);
          } },
      ]);
      await page.evaluate(() => localStorage.clear());
      if (await page.evaluate(() => localStorage.length)) throw new Error('Missions browser data remains');
    }, isolatedRunId);
  } finally { await browser.close(); }
  console.log(`remote E2E passed: ${appId} (${baseUrl}); real H2 lifecycle and zero residual rows verified`);
} else if (appId === 'flight-track-analyzer') {
  const browser = traceE2EBrowser(await chromium.launch({ headless: true, ...(executable ? { executablePath: executable } : {}) }), appId, process.env.AVIATION_E2E_TRACE_DIR);
  try {
    await withE2ERun(secret, async run => {
    const kml = gunzipSync(readFileSync(new URL('./e2e-fixtures/kmlab-standard.kml.gz', import.meta.url)));
    const seeded = await seedRemoteFixture(run, { appId, baseUrl, fetch }, 'flight',
      run.tag({ aircraft: 'E2E', kml_base64: kml.toString('base64') }));
    if (!seeded?.id || seeded.test_run_id !== run.id) throw new Error('KMLab fixture was not tagged');
      const context = await browser.newContext(browserContextOptions);
      const page = await context.newPage();
      await installIsolatedFeedbackScript(page);
      await installE2EApiHeaders(page, baseUrl, appId, run);
      run.onCleanup(async () => {
        await page.evaluate(() => localStorage.removeItem('kmlab.tail'));
        await context.close();
      });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await runDeclaredScreens(['flights', 'flight-detail', 'summary', 'performance', 'help'], [
        {
          id: 'flights', dataMode: 'tagged-database',
          visit: () => page.goto(baseUrl, { waitUntil: 'domcontentloaded' }),
          verify: async () => {
            await page.getByRole('heading', { name: 'Flights (1)' }).waitFor();
            await page.getByRole('row', { name: /E2E/ }).waitFor();
            if (await page.locator('tbody tr').count() !== 1) throw new Error('KMLab production flight leaked into test run');
          },
        },
        {
          id: 'flight-detail', dataMode: 'tagged-database',
          visit: () => page.locator('tbody tr').first().click(),
          verify: async () => {
            await page.getByRole('heading', { name: 'Ground track' }).waitFor();
            await page.getByRole('heading', { name: 'Flight conditions' }).waitFor();
            await page.getByRole('button', { name: 'Save', exact: true }).click();
            await page.getByRole('heading', { name: 'Ground track' }).waitFor();
          },
        },
        {
          id: 'summary', dataMode: 'tagged-database',
          visit: () => page.locator('#nav button[data-view="summary"]').click(),
          verify: async () => {
            await page.getByRole('heading', { name: 'Summary' }).waitFor();
            await page.getByText('hours airborne').waitFor();
          },
        },
        {
          id: 'performance', dataMode: 'tagged-database',
          visit: () => page.locator('#nav button[data-view="performance"]').click(),
          verify: async () => {
            await page.getByRole('heading', { name: 'Performance', exact: true }).waitFor();
            await page.getByText('Documented (AFM/POH) reference table').click();
            await page.getByRole('textbox', { name: 'take-off POH table' }).fill('0,15,780,1385');
            await page.getByRole('button', { name: 'Save reference' }).click();
            await page.getByRole('heading', { name: 'Performance', exact: true }).waitFor();
          },
        },
        {
          id: 'help', dataMode: 'stateless',
          visit: () => page.locator('#help-btn').click(),
          verify: async () => {
            await page.getByText('Hampel').first().waitFor();
            await page.getByRole('dialog', { name: 'Help' }).getByRole('button', { name: 'Close help' }).click();
            if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
          },
        },
      ]);
    });
  } finally { await browser.close(); }
  console.log(`remote E2E passed: ${appId} (${baseUrl}); tagged SQLite run removed`);
} else if (appId === 'flight-planner') {
  const isolatedRunId = process.env.AVIATION_E2E_RUN_ID
    ? parseE2ERunId(process.env.AVIATION_E2E_RUN_ID) : undefined;
  const browser = traceE2EBrowser(await chromium.launch({ headless: true, ...(executable ? { executablePath: executable } : {}) }), appId, process.env.AVIATION_E2E_TRACE_DIR);
  try {
    await withE2ERun(secret, async run => {
      if (isolatedRunId) {
        const headers = { ...run.headersFor(appId), 'content-type': 'application/json' };
        const statusUrl = new URL('/__e2e/status', baseUrl);
        const initial = await fetch(statusUrl, { headers });
        if (!initial.ok || (await initial.json()).saved_plan_count !== 0) {
          throw new Error('Planner isolated test store did not start empty');
        }
        let planId;
        let recordingId;
        run.onCleanup(async () => {
          if (planId !== undefined) {
            const deleted = await fetch(new URL(`/flight-plans/${planId}`, baseUrl), {
              method: 'DELETE', headers: run.headersFor(appId),
            });
            if (deleted.status !== 204) throw new Error(`Planner test plan cleanup failed: HTTP ${deleted.status}`);
          }
          if (recordingId !== undefined) {
            const removedRecording = await fetch(new URL(`/flight-recordings/${recordingId}`, baseUrl), {
              method: 'DELETE', headers: run.headersFor(appId),
            });
            if (!removedRecording.ok) throw new Error(`Planner test recording cleanup failed: HTTP ${removedRecording.status}`);
          }
          const status = await fetch(statusUrl, { headers: run.headersFor(appId) });
          const counts = status.ok ? await status.json() : null;
          if (!counts || counts.saved_plan_count !== 0 || counts.recording_count !== 0) {
            throw new Error('Planner test records remain after cleanup');
          }
        });
        const created = await fetch(new URL('/flight-plans/', baseUrl), { method: 'POST', headers,
          body: JSON.stringify({ name: `E2E saved plan ${run.id}`, origin: 'KOAK', destination: 'KSFO' }) });
        if (created.status !== 201) throw new Error(`Planner test plan create failed: HTTP ${created.status}`);
        planId = (await created.json()).metadata.id;
        const recording = await fetch(new URL('/flight-recordings/', baseUrl), { method: 'POST', headers,
          body: JSON.stringify({ metadata: { name: `E2E recording ${run.id}` }, telemetry: {}, events: [] }) });
        if (!recording.ok) throw new Error(`Planner test recording create failed: HTTP ${recording.status}`);
        recordingId = (await recording.json()).metadata.id;
        const status = await fetch(statusUrl, { headers: run.headersFor(appId) });
        const counts = status.ok ? await status.json() : null;
        if (!counts || counts.saved_plan_count !== 1 || counts.recording_count !== 1) {
          throw new Error('Planner test records were not tagged in the isolated store');
        }
      }
      const context = await browser.newContext(browserContextOptions);
      const page = await context.newPage();
      await installIsolatedFeedbackScript(page);
      run.onCleanup(async () => {
        await page.evaluate(() => localStorage.clear());
        if (await page.evaluate(() => localStorage.length)) throw new Error('Planner browser data remains');
        await context.close();
      });
      const mocks = standardE2EMocks(run.id).planner;
      const airport = mocks.airport;
      const origin = new URL(baseUrl).origin;
      if (isolatedRunId) await page.route(`${origin}/**`, route => route.continue({ headers: {
        ...route.request().headers(), ...run.headersFor(appId),
      } }));
      await page.route(`${origin}/flight-plans/**`, async route => {
        if (isolatedRunId) {
          await route.continue({ headers: { ...route.request().headers(), ...run.headersFor(appId) } });
          return;
        }
        if (route.request().method() !== 'GET') throw new Error('Planner E2E attempted a production plan write');
        await route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify([mocks.savedPlan]) });
      });
      await page.route(`${origin}/api/**`, async route => {
        const path = new URL(route.request().url()).pathname;
        let body;
        let status = 200;
        if (path === '/api/meta') body = run.tag({ repo_url: null, revision: 'e2e' });
        else if (path === '/api/mac/enabled') body = run.tag({ enabled: false, created: false });
        else if (path === '/api/airports/search') body = [airport];
        else if (path === '/api/airports/KOAK') body = run.tag(airport);
        else if (path === '/api/procedures') {
          status = 404;
          body = { detail: 'Not Found' };
        }
        else if (path === '/api/plan/stream' && route.request().method() === 'POST') {
          const request = route.request().postDataJSON();
          if (request.mode !== 'route' || request.origin !== 'KOAK' || request.destination !== 'KSFO') {
            throw new Error('Unexpected route planning request');
          }
          await route.fulfill({ status: 200, contentType: 'text/event-stream',
            body: `event: done\ndata: ${JSON.stringify(run.tag({ plan: mocks.routePlan }))}\n\n` });
          return;
        }
        else if (path === '/api/terrain/profile') body = run.tag({ points: [] });
        else if (path === '/api/plan' && route.request().method() === 'POST') {
          const request = route.request().postDataJSON();
          if (request.mode !== 'local' || request.airport !== 'KOAK') throw new Error('Unexpected planner request');
          body = run.tag({ airport: 'KOAK', radius_nm: request.radius_nm, center: airport,
            nearby_airports: [{ ...airport, icao: 'KSFO', name: 'San Francisco International',
              latitude: 37.619, longitude: -122.375, distance_nm: 10 }] });
        } else if (/^\/api\/weather\/(KOAK|KSFO)$/.test(path)) {
          body = run.tag({ ...mocks.weather, airport: path.split('/')[3] });
        } else if (/^\/api\/weather\/(KOAK|KSFO)\/forecast$/.test(path)) {
          body = run.tag({ airport: path.split('/')[3], days: 3, daily: [] });
        } else if (/^\/api\/weather\/(KOAK|KSFO)\/recommendations$/.test(path)) {
          body = run.tag({ airport: path.split('/')[3], current_category: 'VFR',
            recommendation: 'Synthetic E2E weather', warnings: [], best_departure_windows: [] });
        }
        else if (path === '/api/airspace/nearby') body = run.tag({ type: 'FeatureCollection', features: [] });
        else throw new Error(`Unexpected planner API request: ${route.request().method()} ${path}`);
        await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
      });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await runDeclaredScreens(['planner', 'import-export', 'saved-plan', 'route-results', 'local-results', 'weather', 'airports'], [
        {
          id: 'planner', dataMode: 'sdk-mock',
          visit: async () => {
            await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
            await page.getByRole('combobox', { name: 'Origin' }).fill('KOAK');
            await page.getByText('Procedures are unavailable for this airport.').waitFor();
            await page.getByRole('combobox', { name: 'Procedure' }).click();
          },
          verify: async () => {
            await page.getByText('Select a planning mode and enter details to generate a plan').waitFor();
            if (await page.getByText(/^Joystick:/).count()) throw new Error('Simulator controls leaked into planner');
            if (await page.getByText('Something went wrong').count()) {
              throw new Error('Unavailable procedures crossed into the planner error boundary');
            }
          },
        },
        {
          id: 'import-export', dataMode: 'isolated-browser',
          visit: () => page.getByRole('button', { name: 'Import/Export Flight Plan' }).click(),
          verify: async () => {
            const dialog = page.getByRole('dialog');
            await dialog.getByRole('heading', { name: 'Import Flight Plan' }).waitFor();
            await dialog.locator('input[type="file"]').setInputFiles({
              name: `${run.id}.txt`, mimeType: 'text/plain', buffer: Buffer.from(run.id),
            });
            await dialog.getByText('Invalid file type. Please select a GPX, FPL, or KML file.').waitFor();
            await dialog.getByRole('button', { name: 'Cancel' }).click();
          },
        },
        {
          id: 'saved-plan', dataMode: isolatedRunId ? 'tagged-database' : 'sdk-mock',
          visit: async () => {
            await page.getByRole('button', { name: 'Load Flight Plan' }).click();
            await page.getByText(`E2E saved plan ${run.id}`).click();
          },
          verify: async () => {
            const value = await page.getByRole('combobox', { name: 'Origin' }).inputValue();
            if (value !== 'KOAK') throw new Error(`Saved plan origin did not load: ${value}`);
            const destination = await page.getByRole('combobox', { name: 'Destination' }).inputValue();
            if (destination !== 'KSFO') throw new Error(`Saved plan destination did not load: ${destination}`);
          },
        },
        {
          id: 'route-results', dataMode: 'sdk-mock',
          visit: () => page.getByRole('button', { name: 'Plan Route', exact: true }).click(),
          verify: async () => {
            await page.getByText('Route Results', { exact: true }).waitFor();
            await page.getByText('Route: KOAK → KSFO', { exact: true }).waitFor();
            await page.getByText('Groundspeed: 100 kt', { exact: true }).waitFor();
          },
        },
        {
          id: 'local-results', dataMode: 'sdk-mock',
          visit: async () => {
            await page.getByRole('button', { name: 'Local Flight' }).click();
            await page.getByRole('combobox', { name: 'Airport', exact: true }).fill('KOAK');
            await page.getByRole('button', { name: 'Plan Local Flight' }).click();
          },
          verify: async () => {
            await page.getByText('Center: KOAK (radius 25 nm)').waitFor();
            await page.getByText('Local Results').waitFor();
          },
        },
        {
          id: 'weather', dataMode: 'sdk-mock',
          visit: async () => {
            await page.getByRole('tab', { name: /Weather/ }).click();
            await page.getByRole('textbox', { name: 'Airport Code' }).fill('KOAK');
            await page.getByRole('button', { name: 'Get Weather' }).click();
          },
          verify: async () => {
            await page.getByText('Current Weather - KOAK').waitFor();
            await page.getByText('Synthetic E2E weather').first().waitFor();
          },
        },
        {
          id: 'airports', dataMode: 'sdk-mock',
          visit: async () => {
            await page.getByRole('tab', { name: /Airports/ }).click();
            await page.getByRole('textbox', { name: 'Search', exact: true }).fill('KOAK');
            await page.getByRole('button', { name: 'Search Airports' }).click();
            await page.getByRole('row', { name: /E2E Oakland/ }).click();
          },
          verify: async () => {
            await page.getByText('Airport Details').waitFor();
            await page.getByText(airport.name).last().waitFor();
            if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
          },
        },
      ]);
    }, isolatedRunId);
  } finally { await browser.close(); }
  console.log(`remote E2E passed: ${appId} (${baseUrl}); browser fixtures removed`);
} else if (appId === 'foreflight-dashboard') {
  const browser = traceE2EBrowser(await chromium.launch({ headless: true, ...(executable ? { executablePath: executable } : {}) }), appId, process.env.AVIATION_E2E_TRACE_DIR);
  try {
    await withE2ERun(secret, async run => {
      const context = await browser.newContext(browserContextOptions);
      const page = await context.newPage();
      await installIsolatedFeedbackScript(page);
      const fixture = standardForeFlightCsv(run.id);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await runDeclaredScreens(['upload', 'dashboard', 'flight-detail', 'search', 'reset'], [
        {
          id: 'upload', dataMode: 'isolated-browser',
          visit: async () => {
            await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
            await page.locator('#file-input').setInputFiles({ name: fixture.filename,
              mimeType: 'text/csv', buffer: Buffer.from(fixture.content) });
          },
          verify: async () => {
            await page.getByText(`Selected: ${fixture.filename}`).waitFor();
            await page.getByRole('button', { name: 'Process Logbook' }).waitFor();
          },
        },
        {
          id: 'dashboard', dataMode: 'stateless',
          visit: async () => {
            const response = page.waitForResponse(result => result.url().includes('/api/process-logbook'));
            await page.getByRole('button', { name: 'Process Logbook' }).click();
            const processed = await response;
            if (!processed.ok()) throw new Error(`Stateless logbook upload returned HTTP ${processed.status()}`);
            const body = await processed.json();
            if (body.logbook_filename !== fixture.filename || body.entries?.[0]?.pic_time !== 0.2
              || body.entries?.[0]?.solo_time !== 0.2 || body.error_count !== 0) {
              throw new Error(`Tagged logbook response failed validation: ${JSON.stringify(body)}`);
            }
          },
          verify: async () => {
            await page.getByRole('heading', { name: 'Logbook Dashboard' }).waitFor();
            await page.getByText('All Time Totals').waitFor();
            if (await page.getByText('Data Validation Errors').count()) {
              throw new Error('Correct Solo/PIC overlap was flagged as an error');
            }
          },
        },
        {
          id: 'flight-detail', dataMode: 'isolated-browser',
          visit: () => page.getByRole('button', { name: 'Expand flight details' }).first().click(),
          verify: async () => {
            await page.getByText('Solo Time:').waitFor();
            await page.getByText(run.id).waitFor();
          },
        },
        {
          id: 'search', dataMode: 'isolated-browser',
          visit: () => page.getByPlaceholder('Search flights...').fill('NO_MATCH_E2E'),
          verify: async () => {
            await page.getByText('No flights found matching your criteria.').waitFor();
            await page.getByPlaceholder('Search flights...').fill('N125CM');
            await page.getByRole('button', { name: 'Collapse flight details' }).first().waitFor();
          },
        },
        {
          id: 'reset', dataMode: 'isolated-browser',
          visit: () => page.getByRole('button', { name: 'Upload New Logbook' }).click(),
          verify: async () => {
            await page.getByRole('heading', { name: 'ForeFlight Logbook Dashboard' }).waitFor();
            if (await page.getByText(fixture.filename).count()) throw new Error('Logbook remained after reset');
            if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
          },
        },
      ]);
      await context.close();
    });
  } finally { await browser.close(); }
  console.log(`remote E2E passed: ${appId} (${baseUrl}); stateless upload and browser data cleared`);
} else if (appId === 'g1000-simulator') {
  const browser = traceE2EBrowser(await chromium.launch({ headless: true, ...(executable ? { executablePath: executable } : {}) }), appId, process.env.AVIATION_E2E_TRACE_DIR);
  try {
    await withE2ERun(secret, async run => {
      const context = await browser.newContext(browserContextOptions);
      const page = await context.newPage();
      await installIsolatedFeedbackScript(page);
      const origin = new URL(baseUrl).origin;
      let posted;
      await page.route(`${origin}/api/settings**`, async route => {
        if (route.request().method() === 'POST') {
          posted = route.request().postDataJSON();
          await route.fulfill({ status: 200, contentType: 'application/json',
            body: JSON.stringify(run.tag({ saved: true })) });
        } else {
          await route.fulfill({ status: 200, contentType: 'application/json',
            body: JSON.stringify(run.tag({ services: [
              { id: 'openweather', configured: false, fields: [{ key: 'api_key', configured: false }] },
              { id: 'sentry', configured: false, fields: [{ key: 'dsn', configured: false }] },
              { id: 'g1000-stream', configured: false, fields: [{ key: 'api_key', configured: false }] },
            ] })) });
        }
      });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await runDeclaredScreens(['dashboard', 'settings'], [
        {
          id: 'dashboard', dataMode: 'isolated-browser',
          visit: async () => {
            await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
            await page.getByRole('button', { name: 'Add Test Alert' }).click();
          },
          verify: async () => {
            await page.getByText('This is a test alert').waitFor();
            await page.getByRole('button', { name: 'Acknowledge' }).click();
            await page.waitForFunction(() => [...document.querySelectorAll('div[style]')].some(element =>
              element.style.opacity === '0.5' && element.textContent?.includes('This is a test alert')),
            null, { timeout: 5_000 });
          },
        },
        {
          id: 'settings', dataMode: 'sdk-mock',
          visit: async () => {
            await page.goto(new URL('/settings', baseUrl).toString(), { waitUntil: 'domcontentloaded' });
            await page.getByText('OpenWeatherMap').click();
            await page.getByPlaceholder('Enter API Key').fill(`e2e-${run.id}`);
            await page.getByRole('button', { name: 'Save' }).first().click();
          },
          verify: async () => {
            await page.getByText('Saved successfully.').waitFor();
            if (posted?.service !== 'openweather' || posted?.key !== 'api_key'
              || posted?.value !== `e2e-${run.id}`) throw new Error('Settings mock did not receive the sample value');
            if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
          },
        },
      ]);
      posted = undefined;
      await context.close();
    });
  } finally { await browser.close(); }
  console.log(`remote E2E passed: ${appId} (${baseUrl}); browser fixtures removed`);
} else if (appId === 'flight-tracker') {
  if (!isolatedHost || !process.env.AVIATION_E2E_RUN_ID) {
    throw new Error('Flight Tracker E2E requires an isolated signed service instance');
  }
  const existingRunId = parseE2ERunId(process.env.AVIATION_E2E_RUN_ID);
  const browser = traceE2EBrowser(await chromium.launch({ headless: true, ...(executable ? { executablePath: executable } : {}) }), appId, process.env.AVIATION_E2E_TRACE_DIR);
  try {
    await withE2ERun(secret, async run => {
      const context = await browser.newContext(browserContextOptions);
      run.onCleanup(() => context.close());
      const api = { appId, baseUrl, fetch: async (...args) => {
        const response = await fetch(...args);
        if (response.ok && args[1]?.method === 'GET' && String(args[0]).includes('/__e2e/runs/')) {
          console.log(JSON.stringify({ schema: 'aviation/e2e-residual@1', app: appId, ...await response.clone().json() }));
        }
        return response;
      } };
      await seedRemoteFixture(run, api, 'flight', run.tag({ ...standardE2EMocks(run.id).tracker.flights[0],
        // Keep the synthetic feed point inside the initial world viewport at both widths.
        latitude: 20, longitude: 0 }));
      const tracked = async () => {
        const response = await fetch(new URL('/api/tracked', baseUrl), { headers: run.headersFor(appId) });
        if (!response.ok) throw new Error(`Tracking API failed: ${response.status}`);
        return response.json();
      };
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      await installIsolatedFeedbackScript(page);
      const origin = new URL(baseUrl).origin;
      await page.route(`${origin}/**`, route => route.continue({
        headers: { ...route.request().headers(), ...run.headersFor(appId) },
      }));
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('requestfailed', request => errors.push(`${request.failure()?.errorText} ${request.url()}`));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      page.on('response', response => { if (response.status() >= 400) errors.push(`HTTP ${response.status()} ${response.url()}`); });
      await runDeclaredScreens(['dashboard', 'track', 'remove'], [
        {
          id: 'dashboard', dataMode: 'tagged-memory',
          visit: () => page.goto(baseUrl, { waitUntil: 'domcontentloaded' }),
          verify: async () => {
            await page.getByText('Live flights: 1').waitFor();
            await page.locator('.aircraft-icon').first().waitFor();
            await page.getByText('No flights tracked yet.').waitFor();
          },
        },
        {
          id: 'track', dataMode: 'tagged-memory',
          visit: () => page.locator('.aircraft-icon').first().click(),
          verify: async () => {
            await page.locator('#tracked-body').getByText('E2E123').waitFor();
            await page.getByText('1 flights tracked').waitFor();
            const state = await tracked();
            if (state.total !== 1 || state.tracked[0].test_run_id !== run.id
              || !state.tracked[0].history.length || state.tracked[0].history.some(row => row.test_run_id !== run.id || row.is_test_data !== true)) {
              throw new Error('Real service tracking state or tags did not persist');
            }
            const freshContext = await browser.newContext(browserContextOptions);
            run.onCleanup(() => freshContext.close());
            const freshPage = await freshContext.newPage();
            freshPage.setDefaultTimeout(15000);
            freshPage.on('pageerror', error => errors.push(error.message));
            freshPage.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
            freshPage.on('requestfailed', request => errors.push(`${request.failure()?.errorText} ${request.url()}`));
            freshPage.on('response', response => { if (response.status() >= 400) errors.push(`HTTP ${response.status()} ${response.url()}`); });
            await installIsolatedFeedbackScript(freshPage);
            await freshPage.route(`${origin}/**`, route => route.continue({
              headers: { ...route.request().headers(), ...run.headersFor(appId) },
            }));
            await freshPage.goto(baseUrl, { waitUntil: 'domcontentloaded' });
            await freshPage.locator('#tracked-body').getByText('E2E123').waitFor();
            latestPage = page;
          },
        },
        {
          id: 'remove', dataMode: 'tagged-memory',
          visit: () => page.locator('#tracked-body').getByRole('button', { name: 'Remove' }).click(),
          verify: async () => {
            await page.getByText('0 flights tracked').waitFor();
            await page.getByText('No flights tracked yet.').waitFor();
            if ((await tracked()).total !== 0) throw new Error('Real service track remains after deletion');
          },
        },
      ]);
      const invalid = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth + 1,
        invalidNumber: /\b(?:NaN|Infinity)\b/.test(document.body.innerText) }));
      if (invalid.overflow || invalid.invalidNumber) throw new Error(`Invalid rendered tracker: ${JSON.stringify(invalid)}`);
      if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
    }, existingRunId);
  } finally { await browser.close(); }
  console.log(`remote E2E passed: ${appId} (${baseUrl}); real tracked state and SDK fixtures removed`);
} else if (appId === 'aviation-chat') {
  await withE2ERun(secret, async run => {
    let root, health, invalid, mock, denied;
    await runDeclaredScreens(['root', 'health', 'chat-invalid', 'chat-mock', 'chat-auth'], [
      {
        id: 'root', dataMode: 'stateless',
        visit: async () => { root = await fetch(baseUrl); },
        verify: async () => {
          if (!root.ok || !(await root.text()).includes('does not have a standalone chat interface')) {
            throw new Error('Chat API landing page failed');
          }
        },
      },
      {
        id: 'health', dataMode: 'stateless',
        visit: async () => { health = await fetch(new URL('/health', baseUrl)); },
        verify: async () => {
          const body = await health.json();
          if (!health.ok || body.status !== 'ok' || body.service !== 'aviation-chat') {
            throw new Error('Chat health contract failed');
          }
        },
      },
      {
        id: 'chat-invalid', dataMode: 'stateless',
        visit: async () => { invalid = await fetch(new URL('/chat', baseUrl), { method: 'POST',
          headers: { 'content-type': 'application/json' }, body: '{}' }); },
        verify: async () => { if (invalid.status !== 400) throw new Error('Invalid chat body was accepted'); },
      },
      {
        id: 'chat-mock', dataMode: 'sdk-mock',
        visit: async () => { mock = await fetch(new URL('/chat', baseUrl), { method: 'POST',
          headers: { ...run.headersFor(appId), 'content-type': 'application/json' },
          body: JSON.stringify({ userId: run.id, appId: 'flight-planner', message: 'Synthetic E2E request' }) }); },
        verify: async () => {
          const body = await mock.json();
          if (!mock.ok || body.is_test_data !== true || body.test_run_id !== run.id
            || body.model !== 'e2e-mock' || !body.content.includes('flight-planner')) {
            throw new Error(`Chat mock contract failed: ${JSON.stringify(body)}`);
          }
        },
      },
      {
        id: 'chat-auth', dataMode: 'stateless',
        visit: async () => { denied = await fetch(new URL('/chat', baseUrl), { method: 'POST',
          headers: { 'x-aviation-test-run': run.id, 'content-type': 'application/json' }, body: '{}' }); },
        verify: async () => { if (denied.status !== 403) throw new Error('Partial test credentials were accepted'); },
      },
    ]);
    const browser = traceE2EBrowser(await chromium.launch({ headless: true,
      ...(executable ? { executablePath: executable } : {}) }), appId, process.env.AVIATION_E2E_TRACE_DIR);
    try {
      const context = await browser.newContext(browserContextOptions);
      const page = await context.newPage();
      await installIsolatedFeedbackScript(page);
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
      await exerciseE2EFeedback(page, appId, run.id);
      await context.close();
    } finally { await browser.close(); }
  });
  console.log(`remote E2E passed: ${appId} (${baseUrl}); no persistent fixture created`);
} else if (appId === 'weather-briefing') {
  const browser = traceE2EBrowser(await chromium.launch({ headless: true, ...(executable ? { executablePath: executable } : {}) }), appId, process.env.AVIATION_E2E_TRACE_DIR);
  try {
    await withE2ERun(secret, async run => {
      const context = await browser.newContext(browserContextOptions);
      const page = await context.newPage();
      await installIsolatedFeedbackScript(page);
      run.onCleanup(async () => {
        await page.evaluate(() => localStorage.removeItem('weather-briefing.customStations'));
        if (await page.evaluate(() => localStorage.getItem('weather-briefing.customStations'))) {
          throw new Error('Weather custom stations remain after E2E cleanup');
        }
        await context.close();
      });
      const mocks = standardE2EMocks(run.id);
      const airport = { ...mocks.weatherStations.stations[0], code: 'KOAK', name: 'Oakland International' };
      await installE2ENetworkMocks(page, baseUrl, run, [
        { path: '/stations?region=us', response: mocks.weatherStations },
        { path: '/station?code=KOAK', response: run.tag({ station: airport }) },
        { path: '/briefing?station=KOAK', response: mocks.weather,
          textBody: `WEATHER BRIEFING: KOAK\nMETAR: ${mocks.weather.metar}\nSynthetic E2E ${run.id}` },
        { path: '/briefing?station=KOAK&days=3', response: mocks.weather,
          textBody: `WEATHER BRIEFING: KOAK\nForecast: 3 days\nSynthetic E2E ${run.id}` },
      ]);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await runDeclaredScreens(['map-stations', 'custom-station', 'briefing', 'forecast'], [
        {
          id: 'map-stations', dataMode: 'sdk-mock',
          visit: () => page.goto(baseUrl, { waitUntil: 'domcontentloaded' }),
          verify: async () => {
            await page.getByRole('heading', { name: /Global Weather Map/ }).waitFor();
            await page.locator('#station-list .station-card').first().waitFor();
            await page.locator('#station-list').getByText('KSFO').waitFor();
          },
        },
        {
          id: 'custom-station', dataMode: 'isolated-browser',
          visit: async () => {
            await page.locator('#station-input').fill('KOAK');
            await page.locator('#station-input').blur();
          },
          verify: async () => {
            const options = await page.locator('#station option').evaluateAll(elements =>
              elements.map(element => element.value));
            if (!options.includes('KOAK')) throw new Error('Custom airport was not added');
            const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('weather-briefing.customStations')));
            if (!saved.includes('KOAK')) throw new Error('Custom airport was not saved in the test browser');
          },
        },
        {
          id: 'briefing', dataMode: 'sdk-mock',
          visit: () => page.getByRole('button', { name: 'Get Briefing' }).click(),
          verify: async () => {
            await page.locator('#briefing-output').getByText(`Synthetic E2E ${run.id}`).waitFor();
          },
        },
        {
          id: 'forecast', dataMode: 'sdk-mock',
          visit: () => page.locator('input[name="forecast-day"][value="3"]').check(),
          verify: async () => {
            await page.locator('#briefing-output').getByText('Forecast: 3 days').waitFor();
            if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
          },
        },
      ]);
    });
  } finally { await browser.close(); }
  console.log(`remote E2E passed: ${appId} (${baseUrl}); browser fixtures removed`);
} else if (appId === 'meta-app') {
  const manifest = JSON.parse(readFileSync(new URL('./apps.json', import.meta.url), 'utf8'));
  const expected = manifest.apps.filter(app => app.launcher_visible !== false)
    .map(app => `https://${app.hostname || app.name}.${manifest.domain}/`);
  const browser = traceE2EBrowser(await chromium.launch({ headless: true, ...(executable ? { executablePath: executable } : {}) }), appId, process.env.AVIATION_E2E_TRACE_DIR);
  try {
    const context = await browser.newContext(browserContextOptions);
    const page = await context.newPage();
      await installIsolatedFeedbackScript(page);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await runDeclaredScreens(['launcher', 'settings'], [
      {
        id: 'launcher', dataMode: 'stateless',
        visit: () => page.goto(baseUrl, { waitUntil: 'domcontentloaded' }),
        verify: async () => {
          await page.getByRole('heading', { name: /Aviation Suite/ }).first().waitFor();
          const links = await page.locator('.launcher-card-cta[href]').evaluateAll(elements =>
            elements.map(element => element.getAttribute('href')));
          const missing = expected.filter(url => !links.includes(url));
          if (missing.length || links.length !== expected.length) {
            throw new Error(`Launcher inventory mismatch: missing=${missing} count=${links.length}/${expected.length}`);
          }
        },
      },
      {
        id: 'settings', dataMode: 'stateless',
        visit: () => page.locator('.launcher-card').filter({ hasText: 'Open Settings' }).click(),
        verify: async () => {
          await page.getByRole('heading', { level: 1, name: 'Aviation Suite Settings' }).waitFor();
          await page.getByRole('heading', { name: 'Service Registry' }).waitFor();
          await page.getByRole('button', { name: 'Back to Launcher' }).click();
          await page.locator('.launcher-grid').waitFor();
          if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
        },
      },
    ]);
    await context.close();
  } finally { await browser.close(); }
  console.log(`remote E2E passed: ${appId} (${baseUrl}); isolated browser closed`);
} else if (appId === 'preflight-check') {
  const browser = traceE2EBrowser(await chromium.launch({ headless: true, ...(executable ? { executablePath: executable } : {}) }), appId, process.env.AVIATION_E2E_TRACE_DIR);
  try {
    await withE2ERun(secret, async run => {
      const context = await browser.newContext(browserContextOptions);
      const page = await context.newPage();
      await installIsolatedFeedbackScript(page);
      run.onCleanup(async () => {
        await page.evaluate(() => {
          localStorage.removeItem('aviation-preflight-profile-v1');
          localStorage.removeItem('aviation-preflight-risk-v1');
        });
        const remaining = await page.evaluate(() =>
          ['aviation-preflight-profile-v1', 'aviation-preflight-risk-v1'].filter(key => localStorage.getItem(key)));
        if (remaining.length) throw new Error(`Preflight data remains: ${remaining}`);
        await context.close();
      });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await runDeclaredScreens(['aircraft-profile', 'loading', 'risk', 'references'], [
        {
          id: 'aircraft-profile', dataMode: 'isolated-browser',
          visit: async () => {
            await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
            await page.locator('#registration').fill('N123ET');
            await page.locator('#emptyWeight').fill('1500');
            await page.locator('#emptyArm').fill('39');
            await page.locator('#maxGross').fill('2300');
            await page.locator('#fuelArm').fill('48');
            await page.locator('.station-name').first().fill('Front seats');
            await page.locator('.station-arm').first().fill('37');
            await page.locator('.envelope-row').first().locator('.envelope-weight').fill('1500');
            await page.locator('.envelope-row').first().locator('.forward').fill('35');
            await page.locator('.envelope-row').first().locator('.aft').fill('47');
            await page.locator('.envelope-row').nth(1).locator('.envelope-weight').fill('2300');
            await page.locator('.envelope-row').nth(1).locator('.forward').fill('41');
            await page.locator('.envelope-row').nth(1).locator('.aft').fill('47');
            await page.getByRole('button', { name: 'Save aircraft profile' }).click();
          },
          verify: async () => {
            await page.getByText('Aircraft profile saved in this browser.').waitFor();
            const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('aviation-preflight-profile-v1')));
            if (saved.registration !== 'N123ET') throw new Error('Profile was not saved');
          },
        },
        {
          id: 'loading', dataMode: 'isolated-browser',
          visit: async () => {
            await page.locator('.station-weight').first().fill('170');
            await page.locator('#fuelGallons').fill('40');
            await page.locator('#fuelBurnGallons').fill('20');
            await page.getByRole('button', { name: 'Calculate takeoff and landing' }).click();
          },
          verify: async () => {
            const result = await page.locator('#results').innerText();
            if (!result.includes('1910.00') || !result.includes('1790.00')
              || !result.includes('Within entered limits')) throw new Error(`Bad loading result: ${result}`);
          },
        },
        {
          id: 'risk', dataMode: 'isolated-browser',
          visit: async () => {
            await page.locator('.risk').first().check();
            await page.locator('#riskNotes').fill(`Synthetic review ${run.id}`);
          },
          verify: async () => {
            await page.getByText('1 of 4 review areas checked.').waitFor();
            const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('aviation-preflight-risk-v1')));
            if (stored.notes !== `Synthetic review ${run.id}` || stored.pilot !== true) {
              throw new Error('Risk review did not retain the run fixture');
            }
          },
        },
        {
          id: 'references', dataMode: 'stateless',
          visit: async () => page.getByRole('heading', { name: 'References' }).scrollIntoViewIfNeeded(),
          verify: async () => {
            await page.getByRole('link', { name: 'FAA Weight & Balance Handbook' }).waitFor();
            if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
          },
        },
      ]);
    });
  } finally { await browser.close(); }
  console.log(`remote E2E passed: ${appId} (${baseUrl}); browser fixtures removed`);
} else await withE2ERun(secret, async run => {
  const api = { appId, baseUrl, fetch };
  const seeded = await seedRemoteFixture(run, api, 'accident', standardE2EFixtures(run.id).accident);
  if (!seeded || typeof seeded !== 'object' || !('id' in seeded)) throw new Error('Seed did not return an event ID');
  const browser = traceE2EBrowser(await chromium.launch({ headless: true, ...(executable ? { executablePath: executable } : {}) }), appId, process.env.AVIATION_E2E_TRACE_DIR);
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await installIsolatedFeedbackScript(page);
    await installE2EApiHeaders(page, baseUrl, appId, run);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await runDeclaredScreens(['list', 'filters', 'citations', 'detail-map'], [
      {
        id: 'list', dataMode: 'tagged-database',
        visit: () => page.goto(baseUrl, { waitUntil: 'domcontentloaded' }),
        verify: async () => {
          await page.getByRole('heading', { name: 'Aviation Accident Tracker' }).waitFor();
          await page.getByRole('row', { name: /N123ET/ }).waitFor();
          const records = await page.locator('tbody tr[aria-label^="View details"]').count();
          if (records !== 1) throw new Error(`Expected only the tagged fixture; found ${records} rows`);
          await page.locator('.leaflet-container').waitFor();
          if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
        },
      },
      {
        id: 'filters', dataMode: 'tagged-database',
        visit: async () => {
          await page.getByLabel('Category:').selectOption('commercial');
          await page.getByText('No events found for current filters.').waitFor();
          await page.getByLabel('Category:').selectOption('general');
          await page.getByLabel('Region:').selectOption('CA');
          await page.getByPlaceholder('registration/operator/summary').fill('N123ET');
        },
        verify: async () => {
          await page.getByRole('row', { name: /N123ET/ }).waitFor();
          const count = await page.locator('tbody tr[aria-label^="View details"]').count();
          if (count !== 1) throw new Error(`Filtered fixture count is ${count}`);
        },
      },
      {
        id: 'citations', dataMode: 'tagged-database',
        visit: () => page.getByRole('button', { name: 'Show citations for N123ET' }).click(),
        verify: async () => {
          await page.getByText('Known citations').waitFor();
          const link = page.locator('tbody a[href^="https://example.invalid/e2e/"]');
          await link.first().waitFor();
          if (!(await link.first().getAttribute('href')).includes(run.id)) {
            throw new Error('Citation belongs to a different test run');
          }
        },
      },
      {
        id: 'detail-map', dataMode: 'tagged-database',
        visit: () => page.getByRole('row', { name: /View details for N123ET/ }).click(),
        verify: async () => {
          const detail = page.getByRole('dialog');
          await detail.getByText('Synthetic E2E event').waitFor();
          await detail.getByText('@ 37.721, -122.221').waitFor();
          await detail.getByRole('button', { name: 'Close' }).click();
          await page.locator('.leaflet-marker-icon').first().waitFor();
          if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
        },
      },
    ]);
    await page.close();
  } finally {
    await browser.close();
  }
});
if (appId === 'aviation-accident-tracker')
  console.log(`remote E2E passed: ${appId} (${baseUrl}); tagged fixture removed`);
