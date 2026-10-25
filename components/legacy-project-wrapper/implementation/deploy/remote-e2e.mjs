#!/usr/bin/env node
// Run against a deployed app or a local production build. AVIATION_E2E_SECRET
// must match the server; no fixture is created in the production database.
import { existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { chromium } from '@playwright/test';
import {
  installE2EApiHeaders, runE2EScreens, seedRemoteFixture,
  installE2ENetworkMocks, standardE2EFixtures, standardE2EMocks,
  standardForeFlightCsv, withE2ERun, parseE2ERunId,
} from '@aviation/shared-sdk/e2e';

const appId = process.argv[2];
if (!['aviation-accident-tracker', 'aviation-chat', 'preflight-check', 'meta-app',
  'weather-briefing', 'flight-tracker', 'g1000-simulator', 'foreflight-dashboard',
  'flight-planner', 'flight-track-analyzer', 'aviation-missions-app', 'flightschool'].includes(appId)) {
  throw new Error(`No remote E2E screen adapter for ${appId || '(missing app)'}`);
}
const baseUrl = process.env.AVIATION_E2E_BASE_URL || `https://${appId}.jordanhubbard.net`;
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
  const browser = await chromium.launch({ headless: true, ...(executable ? { executablePath: executable } : {}) });
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
        const context = await browser.newContext();
        run.onCleanup(() => context.close());
        const page = await context.newPage();
        pages[role] = page;
        await page.route(`${origin}/**`, route => route.continue({ headers: {
          ...route.request().headers(), ...run.headersFor(appId),
        } }));
        page.on('pageerror', error => errors.push(`${role}: ${error.message}`));
        const loginResponse = await page.goto(new URL('/auth/login', baseUrl).toString(), { waitUntil: 'domcontentloaded' });
        if (!loginResponse?.ok()) throw new Error(`Flight School ${role} login returned HTTP ${loginResponse?.status()}`);
        if (!await page.getByLabel('Email').count()) throw new Error(`Flight School ${role} login has no email field`);
        await page.getByLabel('Email').fill(`${role}-${run.id}@example.com`);
        await page.getByLabel('Password').fill(run.id);
        await page.getByRole('button', { name: 'Sign In' }).click();
        await page.waitForURL(role === 'admin' ? /\/admin\/dashboard/ : /\/dashboard/);
      }
      const pathFor = path => path.replaceAll('<int:booking_id>', '1').replaceAll('<int:aircraft_id>', '1')
        .replaceAll('<int:id>', '1');
      await runE2EScreens(screens, screens.map(path => ({
        id: path, dataMode: 'tagged-database',
        visit: async () => {
          const role = path.startsWith('/admin/') ? 'admin' : path.startsWith('/instructor/') ? 'instructor' : 'student';
          const page = pages[role];
          const response = await page.goto(new URL(pathFor(path), baseUrl).toString(), { waitUntil: 'domcontentloaded' });
          if (!response || response.status() >= 400) throw new Error(`${path} returned HTTP ${response?.status()}`);
          if ((role === 'admin' || role === 'instructor') && !new URL(page.url()).pathname.startsWith(`/${role}/`)) {
            throw new Error(`${path} redirected outside the ${role} screens`);
          }
        },
        verify: async () => {
          const role = path.startsWith('/admin/') ? 'admin' : path.startsWith('/instructor/') ? 'instructor' : 'student';
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
      console.log(`Flight School visited ${screens.length} declared GET screens`);
    }, existingRunId);
  } finally { await browser.close(); }
  console.log(`remote E2E passed: ${appId} (${baseUrl}); isolated instance cleanup is external`);
} else if (appId === 'aviation-missions-app') {
  const browser = await chromium.launch({ headless: true, ...(executable ? { executablePath: executable } : {}) });
  try {
    await withE2ERun(secret, async run => {
      const context = await browser.newContext();
      const page = await context.newPage();
      run.onCleanup(async () => {
        await page.evaluate(() => localStorage.clear());
        if (await page.evaluate(() => localStorage.length)) throw new Error('Missions browser data remains');
        await context.close();
      });
      const origin = new URL(baseUrl).origin;
      const mission = run.tag({ id: 931, title: `E2E Pattern Mission ${run.id}`,
        category: 'Training', difficulty: 2, pilot_experience: 'Beginner (< 100 hours)',
        objective: 'Practice a synthetic short approach', mission_description: 'Synthetic mission for remote E2E',
        why_description: 'Test mission navigation', route: 'KOAK KOAK', comment_count: 1,
        completion_count: 1, notes: 'No flight required' });
      const comments = [run.tag({ id: 1, author_name: 'E2E Pilot', content: `Synthetic comment ${run.id}`,
        created_at: '2026-01-01T00:00:00Z' })];
      const completion = run.tag({ id: 341, pilot_name: 'E2E Pilot', completion_date: '2026-01-01',
        notes: `Synthetic completion ${run.id}`, feedback: [] });
      const unexpected = [];
      await page.route(`${origin}/**`, async route => {
        const request = route.request();
        const path = new URL(request.url()).pathname;
        const method = request.method();
        if (!/^(\/missions|\/submissions|\/updates|\/admin\/)/.test(path)) {
          await route.continue(); return;
        }
        let body;
        if (path === '/missions' && method === 'GET') body = run.tag({ missions: [mission] });
        else if (path === '/missions/931' && method === 'GET') body = mission;
        else if (path === '/missions/931/comments' && method === 'GET') body = run.tag({ comments });
        else if (path === '/missions/931/completed' && method === 'GET') body = run.tag({ completions: [completion] });
        else if (path === '/missions/931/completed/341/feedback' && method === 'POST') {
          const submitted = request.postDataJSON();
          if (!submitted.content?.includes(run.id)) unexpected.push('Feedback lost E2E marker');
          completion.feedback.push(run.tag({ id: 441, author_name: submitted.author_name, content: submitted.content }));
          body = run.tag({ id: 441 });
        } else if (path === '/admin/status' && method === 'GET') {
          body = run.tag({ is_admin: true, admin_name: 'E2E Admin' });
        } else if (path === '/submissions' && method === 'GET') body = run.tag({ submissions: [] });
        else if (path === '/updates' && method === 'GET') body = run.tag({ updates: [] });
        else {
          unexpected.push(`${method} ${path}`);
          await route.fulfill({ status: 599, contentType: 'application/json', body: '{"error":"unexpected E2E API request"}' });
          return;
        }
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await runE2EScreens(['mission-list', 'filters', 'brief', 'comments', 'completed-feedback',
        'create-form', 'admin-dashboard'], [
        {
          id: 'mission-list', dataMode: 'sdk-mock',
          visit: () => page.goto(baseUrl, { waitUntil: 'domcontentloaded' }),
          verify: () => page.getByRole('heading', { name: mission.title }).waitFor(),
        },
        {
          id: 'filters', dataMode: 'sdk-mock',
          visit: async () => {
            await page.locator('#searchInput').fill('NO_MATCH_E2E');
            await page.getByText('No missions found matching your criteria.').waitFor();
            await page.locator('#searchInput').fill('Pattern Mission');
          },
          verify: () => page.getByRole('heading', { name: mission.title }).waitFor(),
        },
        {
          id: 'brief', dataMode: 'sdk-mock',
          visit: () => page.locator('.mission-card').getByRole('button', { name: 'BRIEF' }).click(),
          verify: async () => {
            await page.locator('.modal-overlay').getByRole('heading', { name: mission.title }).waitFor();
            await page.locator('.modal-close').click();
          },
        },
        {
          id: 'comments', dataMode: 'sdk-mock',
          visit: () => page.locator('.mission-card').getByRole('button', { name: /Comments/ }).click(),
          verify: async () => {
            await page.locator('.modal-overlay').getByText(`Synthetic comment ${run.id}`).waitFor();
            await page.locator('.modal-close').click();
          },
        },
        {
          id: 'completed-feedback', dataMode: 'sdk-mock',
          visit: () => page.locator('.mission-card').getByRole('button', { name: /Completed/ }).click(),
          verify: async () => {
            const modal = page.locator('.modal-overlay');
            await modal.getByText(`Synthetic completion ${run.id}`).waitFor();
            await modal.locator('input[name="author_name"]').fill('E2E Reviewer');
            await modal.locator('textarea[name="content"]').fill(`Synthetic feedback ${run.id}`);
            await modal.getByRole('button', { name: 'Post feedback' }).click();
            await modal.getByText(`Synthetic feedback ${run.id}`).waitFor();
            await modal.locator('.modal-close').click();
          },
        },
        {
          id: 'create-form', dataMode: 'isolated-browser',
          visit: () => page.getByRole('button', { name: 'Create Mission' }).first().click(),
          verify: async () => {
            await page.locator('#newMissionForm').waitFor();
            await page.locator('#newMissionForm input[name="title"]').fill(`Draft ${run.id}`);
            await page.locator('.modal-close').click();
          },
        },
        {
          id: 'admin-dashboard', dataMode: 'sdk-mock',
          visit: async () => {
            await page.evaluate(id => {
              localStorage.setItem('admin_token', `e2e-${id}`);
              localStorage.setItem('admin_name', 'E2E Admin');
            }, run.id);
            await page.reload({ waitUntil: 'domcontentloaded' });
          },
          verify: async () => {
            await page.getByText('Admin: E2E Admin').waitFor();
            await page.locator('#adminDashboard').getByText('No pending submissions.').waitFor();
            if (unexpected.length || errors.length) throw new Error(`Missions E2E errors: ${[...unexpected, ...errors].join('; ')}`);
          },
        },
      ]);
    });
  } finally { await browser.close(); }
  console.log(`remote E2E passed: ${appId} (${baseUrl}); mocked browser data removed`);
} else if (appId === 'flight-track-analyzer') {
  const browser = await chromium.launch({ headless: true, ...(executable ? { executablePath: executable } : {}) });
  try {
    await withE2ERun(secret, async run => {
    const kml = gunzipSync(readFileSync(new URL('./e2e-fixtures/kmlab-standard.kml.gz', import.meta.url)));
    const seeded = await seedRemoteFixture(run, { appId, baseUrl, fetch }, 'flight',
      run.tag({ aircraft: 'E2E', kml_base64: kml.toString('base64') }));
    if (!seeded?.id || seeded.test_run_id !== run.id) throw new Error('KMLab fixture was not tagged');
      const context = await browser.newContext();
      const page = await context.newPage();
      await installE2EApiHeaders(page, baseUrl, appId, run);
      run.onCleanup(async () => {
        await page.evaluate(() => localStorage.removeItem('kmlab.tail'));
        await context.close();
      });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await runE2EScreens(['flights', 'flight-detail', 'summary', 'performance', 'help'], [
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
            if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
          },
        },
      ]);
    });
  } finally { await browser.close(); }
  console.log(`remote E2E passed: ${appId} (${baseUrl}); tagged SQLite run removed`);
} else if (appId === 'flight-planner') {
  const browser = await chromium.launch({ headless: true, ...(executable ? { executablePath: executable } : {}) });
  try {
    await withE2ERun(secret, async run => {
      const context = await browser.newContext();
      const page = await context.newPage();
      run.onCleanup(async () => {
        await page.evaluate(() => localStorage.clear());
        if (await page.evaluate(() => localStorage.length)) throw new Error('Planner browser data remains');
        await context.close();
      });
      const mocks = standardE2EMocks(run.id).planner;
      const airport = mocks.airport;
      const origin = new URL(baseUrl).origin;
      await page.route(`${origin}/flight-plans/**`, async route => {
        if (route.request().method() !== 'GET') throw new Error('Planner E2E attempted a production plan write');
        await route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify([mocks.savedPlan]) });
      });
      await page.route(`${origin}/api/**`, async route => {
        const path = new URL(route.request().url()).pathname;
        let body;
        if (path === '/api/meta') body = run.tag({ repo_url: null, revision: 'e2e' });
        else if (path === '/api/airports/search') body = [airport];
        else if (path === '/api/airports/KOAK') body = run.tag(airport);
        else if (path === '/api/procedures') body = [];
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
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await runE2EScreens(['planner', 'saved-plan', 'local-results', 'weather', 'airports'], [
        {
          id: 'planner', dataMode: 'sdk-mock',
          visit: () => page.goto(baseUrl, { waitUntil: 'domcontentloaded' }),
          verify: async () => {
            await page.getByText('Select a planning mode and enter details to generate a plan').waitFor();
            if (await page.getByText(/^Joystick:/).count()) throw new Error('Simulator controls leaked into planner');
          },
        },
        {
          id: 'saved-plan', dataMode: 'sdk-mock',
          visit: async () => {
            await page.getByRole('button', { name: 'Load Flight Plan' }).click();
            await page.getByText(`E2E saved plan ${run.id}`).click();
          },
          verify: async () => {
            const value = await page.getByRole('combobox', { name: 'Origin' }).inputValue();
            if (value !== 'KOAK') throw new Error(`Saved plan origin did not load: ${value}`);
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
    });
  } finally { await browser.close(); }
  console.log(`remote E2E passed: ${appId} (${baseUrl}); browser fixtures removed`);
} else if (appId === 'foreflight-dashboard') {
  const browser = await chromium.launch({ headless: true, ...(executable ? { executablePath: executable } : {}) });
  try {
    await withE2ERun(secret, async run => {
      const context = await browser.newContext();
      const page = await context.newPage();
      const fixture = standardForeFlightCsv(run.id);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await runE2EScreens(['upload', 'dashboard', 'flight-detail', 'search', 'reset'], [
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
  const browser = await chromium.launch({ headless: true, ...(executable ? { executablePath: executable } : {}) });
  try {
    await withE2ERun(secret, async run => {
      const context = await browser.newContext();
      const page = await context.newPage();
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
      await runE2EScreens(['dashboard', 'settings'], [
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
  const browser = await chromium.launch({ headless: true, ...(executable ? { executablePath: executable } : {}) });
  try {
    await withE2ERun(secret, async run => {
      const context = await browser.newContext();
      const page = await context.newPage();
      let tracked = [];
      run.onCleanup(async () => { tracked = []; await context.close(); });
      const fixture = standardE2EMocks(run.id).tracker;
      await installE2ENetworkMocks(page, baseUrl, run,
        [{ path: '/api/flights?*', response: fixture }]);
      const origin = new URL(baseUrl).origin;
      await page.route(`${origin}/api/tracked**`, async route => {
        const method = route.request().method();
        const pathname = new URL(route.request().url()).pathname;
        if (method === 'POST' && pathname === '/api/tracked') {
          const payload = route.request().postDataJSON();
          if (payload.icao24 !== 'e2e123') throw new Error('Unexpected tracked flight');
          const flight = fixture.flights[0];
          const point = { latitude: flight.latitude, longitude: flight.longitude,
            altitude: flight.geoAltitude, velocity: flight.velocity, heading: flight.heading,
            timestamp: fixture.updatedAt };
          tracked = [{ ...flight, position: point, history: [point], isActive: true,
            lastUpdate: fixture.updatedAt }];
          await route.fulfill({ status: 200, contentType: 'application/json',
            body: JSON.stringify(run.tag({ status: 'tracked' })) });
        } else if (method === 'DELETE' && pathname === '/api/tracked/e2e123') {
          tracked = [];
          await route.fulfill({ status: 200, contentType: 'application/json',
            body: JSON.stringify(run.tag({ status: 'removed' })) });
        } else if (method === 'GET' && pathname === '/api/tracked') {
          await route.fulfill({ status: 200, contentType: 'application/json',
            body: JSON.stringify(run.tag({ tracked, total: tracked.length })) });
        } else throw new Error(`Unexpected tracker mock request: ${method} ${pathname}`);
      });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await runE2EScreens(['dashboard', 'track', 'remove'], [
        {
          id: 'dashboard', dataMode: 'sdk-mock',
          visit: () => page.goto(baseUrl, { waitUntil: 'domcontentloaded' }),
          verify: async () => {
            await page.getByText('Live flights: 1').waitFor();
            await page.locator('.aircraft-icon').first().waitFor();
            await page.getByText('No flights tracked yet.').waitFor();
          },
        },
        {
          id: 'track', dataMode: 'sdk-mock',
          visit: () => page.locator('.aircraft-icon').first().click(),
          verify: async () => {
            await page.locator('#tracked-body').getByText('E2E123').waitFor();
            await page.getByText('1 flights tracked').waitFor();
            if (tracked.length !== 1) throw new Error('Tracker mock did not register selection');
          },
        },
        {
          id: 'remove', dataMode: 'sdk-mock',
          visit: () => page.locator('#tracked-body').getByRole('button', { name: 'Remove' }).click(),
          verify: async () => {
            await page.getByText('0 flights tracked').waitFor();
            await page.getByText('No flights tracked yet.').waitFor();
            if (tracked.length || errors.length) throw new Error(`Tracker cleanup or browser error: ${errors}`);
          },
        },
      ]);
    });
  } finally { await browser.close(); }
  console.log(`remote E2E passed: ${appId} (${baseUrl}); tracked flight removed`);
} else if (appId === 'aviation-chat') {
  await withE2ERun(secret, async run => {
    let root, health, invalid, mock, denied;
    await runE2EScreens(['root', 'health', 'chat-invalid', 'chat-mock', 'chat-auth'], [
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
  });
  console.log(`remote E2E passed: ${appId} (${baseUrl}); no persistent fixture created`);
} else if (appId === 'weather-briefing') {
  const browser = await chromium.launch({ headless: true, ...(executable ? { executablePath: executable } : {}) });
  try {
    await withE2ERun(secret, async run => {
      const context = await browser.newContext();
      const page = await context.newPage();
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
      await runE2EScreens(['map-stations', 'custom-station', 'briefing', 'forecast'], [
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
  const expected = manifest.apps.filter(app => app.name !== 'meta-app' && app.name !== 'aviation-chat')
    .map(app => `https://${app.hostname || app.name}.${manifest.domain}/`);
  const browser = await chromium.launch({ headless: true, ...(executable ? { executablePath: executable } : {}) });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await runE2EScreens(['launcher', 'settings'], [
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
  const browser = await chromium.launch({ headless: true, ...(executable ? { executablePath: executable } : {}) });
  try {
    await withE2ERun(secret, async run => {
      const context = await browser.newContext();
      const page = await context.newPage();
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
      await runE2EScreens(['aircraft-profile', 'loading', 'risk', 'references'], [
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
  const browser = await chromium.launch({ headless: true, ...(executable ? { executablePath: executable } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await installE2EApiHeaders(page, baseUrl, appId, run);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await runE2EScreens(['list', 'filters', 'citations', 'detail-map'], [
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
