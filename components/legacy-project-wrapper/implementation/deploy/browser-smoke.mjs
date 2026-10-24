#!/usr/bin/env node
// Post-deployment browser gate for the actual public hostnames in apps.json.
import { existsSync, readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const manifest = JSON.parse(readFileSync(new URL('./apps.json', import.meta.url), 'utf8'));
const requested = process.argv[2] || 'all';
const apps = manifest.apps.filter(app => requested === 'all' || requested === app.name);
if (!apps.length) throw new Error(`Unknown app: ${requested}`);

const contract = JSON.parse(readFileSync(new URL('../../../../verification/deployed-browser.json', import.meta.url), 'utf8'));
if (contract.schema !== 'aviation/deployed-browser-smoke@1'
  || manifest.apps.some(app => !contract.apps[app.name])
  || Object.keys(contract.apps).length !== manifest.apps.length) {
  throw new Error('Browser acceptance contract must cover every deployed app');
}

const systemChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  || (existsSync(chromium.executablePath()) ? undefined : (existsSync(systemChrome) ? systemChrome : undefined));
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const failures = [];
try {
  for (const app of apps) {
    const hostname = app.hostname || app.name;
    const url = `https://${hostname}.${manifest.domain}/`;
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    try {
      const response = await page.goto(url, { waitUntil: 'commit', timeout: 30_000 });
      await page.locator('body').waitFor({ state: 'visible', timeout: 15_000 });
      await page.waitForTimeout(1500);
      const body = await page.locator('body').innerText();
      const expectedText = contract.apps[app.name].rootText;
      const badPage = /Something went wrong|Cannot GET \/|application encountered an unexpected error/i.test(body);
      if (!response || response.status() >= 400 || badPage || pageErrors.length || !body.includes(expectedText)) {
        throw new Error(`HTTP ${response?.status()} marker=${body.includes(expectedText)} fallback=${badPage} errors=${pageErrors.join('; ')}`);
      }
      const feedbackButton = page.getByRole('button', { name: 'Submit feedback' });
      await feedbackButton.waitFor({ timeout: 10_000 });
      await feedbackButton.click();
      await page.getByRole('dialog').getByText('Your comment will create an issue').waitFor();
      await page.getByRole('button', { name: 'Cancel' }).click();
      if (contract.apps[app.name].interaction === 'citation-disclosure') {
        await page.getByRole('columnheader', { name: 'Source' }).waitFor();
        await page.getByText('Last successful sync:').waitFor();
        await page.getByRole('columnheader', { name: 'Cause(s)' }).waitFor({ timeout: 10_000 });
        const firstRow = page.locator('tbody tr').first();
        const causeCell = firstRow.locator('td').last();
        if (!(await causeCell.innerText()).trim()) throw new Error('Accident cause badge missing');
        const disclose = page.getByRole('button', { name: /^Show citations for / }).first();
        await disclose.click();
        await page.getByText('Known citations').waitFor({ timeout: 10_000 });
        if (await page.getByRole('alert').count()) throw new Error('Citation disclosure failed');
        await page.getByPlaceholder('Engine failure in California last 30 days').fill('general aviation in California');
        await page.getByRole('button', { name: 'Apply query' }).click();
        const selectedFilters = await page.locator('select').evaluateAll(elements => elements.map(element => element.value));
        if (selectedFilters[0] !== 'general' || selectedFilters[2] !== 'CA') {
          throw new Error(`Natural-language query did not apply category and region: ${selectedFilters}`);
        }
      }
      if (app.name === 'meta-app') {
        const links = await page.locator('.launcher-card-cta[href]').evaluateAll(elements =>
          elements.map(element => element.getAttribute('href')));
        const expected = manifest.apps.filter(entry => entry.name !== 'meta-app').map(entry =>
          `https://${entry.hostname || entry.name}.${manifest.domain}/`);
        const missing = expected.filter(destination => !links.includes(destination));
        if (missing.length || links.length !== expected.length) {
          throw new Error(`Meta App destinations differ from deployment manifest: missing=${missing.join(', ')} count=${links.length}/${expected.length}`);
        }
      }
      if (app.name === 'aviation-missions-app') {
        const completed = page.getByRole('button', { name: /Completed/i }).first();
        await completed.waitFor({ timeout: 10_000 });
        await completed.click();
        await page.getByText('Completed missions and feedback').waitFor({ timeout: 10_000 });
        await page.getByRole('button', { name: 'Mark completed' }).waitFor();
        let postedFeedback;
        await page.route('**/missions/424242/completed/777/feedback', async route => {
          postedFeedback = route.request().postDataJSON();
          await route.fulfill({ status: 201, contentType: 'application/json',
            body: JSON.stringify({ feedback: { id: 1, ...postedFeedback } }) });
        });
        await page.route('**/missions/424242/completed', async route => {
          await route.fulfill({ status: 200, contentType: 'application/json',
            body: JSON.stringify({ completions: [{ id: 777, pilot_name: 'Browser Test Pilot',
              completion_date: '2026-10-24', feedback: postedFeedback
                ? [{ id: 1, ...postedFeedback }] : [] }] }) });
        });
        await page.evaluate(() => window.app.viewCompletions(424242));
        await page.locator('.completion-feedback-form input[name=author_name]').fill('Browser Test');
        await page.locator('.completion-feedback-form textarea[name=content]').fill('Synthetic feedback, intercepted in browser.');
        await page.getByRole('button', { name: 'Post feedback' }).click();
        await page.getByText('Synthetic feedback, intercepted in browser.').waitFor();
        if (postedFeedback?.author_name !== 'Browser Test'
          || postedFeedback?.content !== 'Synthetic feedback, intercepted in browser.') {
          throw new Error('Completed mission feedback payload did not match the browser form');
        }
      }
      if (contract.apps[app.name].interaction === 'saved-plans-dialog') {
        await page.getByText('Select a planning mode and enter details to generate a plan').waitFor({ timeout: 10_000 });
        if (await page.getByText(/^Joystick:/).count() || await page.locator('main canvas').count()) {
          throw new Error('Flight Planner initial view contains simulator demo controls or canvas');
        }
        await page.getByRole('button', { name: 'Load Flight Plan' }).click();
        await page.getByRole('dialog', { name: 'Load Flight Plan' }).waitFor({ timeout: 10_000 });
      }
      if (contract.apps[app.name].interaction === 'weight-balance') {
        await page.locator('#registration').fill('N12345');
        await page.locator('#emptyWeight').fill('1500');
        await page.locator('#emptyArm').fill('39');
        await page.locator('#maxGross').fill('2300');
        await page.locator('#fuelArm').fill('48');
        await page.locator('.station-name').first().fill('Front seats');
        await page.locator('.station-arm').first().fill('37');
        await page.locator('.station-weight').first().fill('170');
        await page.locator('.envelope-row').first().locator('.envelope-weight').fill('1500');
        await page.locator('.envelope-row').first().locator('.forward').fill('35');
        await page.locator('.envelope-row').first().locator('.aft').fill('47');
        await page.locator('.envelope-row').nth(1).locator('.envelope-weight').fill('2300');
        await page.locator('.envelope-row').nth(1).locator('.forward').fill('41');
        await page.locator('.envelope-row').nth(1).locator('.aft').fill('47');
        await page.locator('#fuelGallons').fill('40');
        await page.locator('#fuelBurnGallons').fill('20');
        await page.getByRole('button', { name: 'Calculate takeoff and landing' }).click();
        const result = await page.locator('#results').innerText();
        if (!result.includes('1910.00') || !result.includes('1790.00') || !result.includes('Within entered limits')) {
          throw new Error(`Preflight loading result did not match known calculation: ${result}`);
        }
      }
      if (contract.apps[app.name].interaction === 'invalid-chat-request') {
        const invalid = await page.request.post(`https://${hostname}.${manifest.domain}/chat`, { data: {} });
        if (invalid.status() !== 400) throw new Error(`Invalid chat request returned HTTP ${invalid.status()}`);
      }
      if (contract.apps[app.name].interaction === 'solo-pic-upload') {
        const csv = [
          'ForeFlight Logbook Import,This row is required for importing into ForeFlight. Do not delete or modify.,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,',
          ',,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,',
          'Aircraft Table,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,',
          'AircraftID,TypeCode,Year,Make,Model,GearType,EngineType,equipType (FAA),aircraftClass (FAA),complexAircraft (FAA),taa (FAA),highPerformance (FAA),pressurized (FAA),,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,',
          'N125CM,CH7A,,Bellanca,7ECA,fixed_tailwheel,Piston,aircraft,airplane_single_engine_land,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,',
          ',,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,',
          'Flights Table,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,',
          'Date,AircraftID,From,To,TotalTime,Night,ActualInstrument,SimulatedInstrument,CrossCountry,DualGiven,PIC,SIC,DualReceived,Solo,DayLandingsFullStop,NightLandingsFullStop,PilotComments,InstructorComments,Distance',
          '2023-01-01,N125CM,KOAK,KSFO,0.2,0.0,0.0,0.0,0.0,0.0,0.2,0.0,0.0,0.2,1,0,First solo,,10',
          '',
        ].join('\n');
        await page.locator('#file-input').setInputFiles({ name: 'solo-pic-smoke.csv',
          mimeType: 'text/csv', buffer: Buffer.from(csv) });
        const processed = page.waitForResponse(response => response.url().includes('/api/process-logbook'));
        await page.getByRole('button', { name: 'Process Logbook' }).click();
        const upload = await processed;
        if (upload.status() !== 200) throw new Error(`Logbook upload returned HTTP ${upload.status()}`);
        const result = await upload.json();
        if (result.error_count !== 0 || result.entries?.[0]?.pic_time !== 0.2
          || result.entries?.[0]?.solo_time !== 0.2) {
          throw new Error(`Solo/PIC upload validation failed: ${JSON.stringify(result.entries?.[0]?.error_explanation)}`);
        }
        await page.getByRole('button', { name: 'Upload New Logbook' }).waitFor({ timeout: 10_000 });
        if (await page.getByText('Data Validation Errors').count()) throw new Error('Dashboard displays validation errors');

        const patternCsv = csv.replace(
          '2023-01-01,N125CM,KOAK,KSFO,0.2,0.0,0.0,0.0,0.0,0.0,0.2,0.0,0.0,0.2,1,0,',
          '2023-01-01,N125CM,KOAK,KSFO,0.5,0.0,0.0,0.0,0.0,0.0,0.5,0.0,0.0,0.5,8,0,',
        );
        if (patternCsv === csv) throw new Error('Pattern-work fixture was not generated');
        await page.getByRole('button', { name: 'Upload New Logbook' }).click();
        await page.locator('#file-input').setInputFiles({ name: 'tight-pattern-smoke.csv',
          mimeType: 'text/csv', buffer: Buffer.from(patternCsv) });
        const patternProcessed = page.waitForResponse(response => response.url().includes('/api/process-logbook'));
        await page.getByRole('button', { name: 'Process Logbook' }).click();
        const patternUpload = await patternProcessed;
        if (patternUpload.status() !== 200) throw new Error(`Pattern upload returned HTTP ${patternUpload.status()}`);
        const patternResult = await patternUpload.json();
        if (patternResult.error_count !== 0 || patternResult.entries?.[0]?.total_time !== 0.5
          || patternResult.entries?.[0]?.landings_day !== 8) {
          throw new Error(`Pattern upload validation failed: ${JSON.stringify(patternResult.entries?.[0]?.error_explanation)}`);
        }
        await page.getByRole('button', { name: 'Upload New Logbook' }).waitFor({ timeout: 10_000 });
        if (await page.getByText('Data Validation Errors').count()) throw new Error('Dashboard displays pattern validation errors');

        const invalidCodeCsv = csv.replace('N125CM,CH7A,', 'N125CM,C82S,');
        if (invalidCodeCsv === csv) throw new Error('Invalid-code fixture was not generated');
        await page.getByRole('button', { name: 'Upload New Logbook' }).click();
        await page.locator('#file-input').setInputFiles({ name: 'invalid-code-smoke.csv',
          mimeType: 'text/csv', buffer: Buffer.from(invalidCodeCsv) });
        const invalidProcessed = page.waitForResponse(response => response.url().includes('/api/process-logbook'));
        await page.getByRole('button', { name: 'Process Logbook' }).click();
        const invalidUpload = await invalidProcessed;
        if (invalidUpload.status() !== 200) throw new Error(`Invalid-code upload returned HTTP ${invalidUpload.status()}`);
        const invalidResult = await invalidUpload.json();
        const icaoUrl = 'https://www.icao.int/operational-safety/doc-8643-aircraft-type-designators/search';
        if (!invalidResult.entries?.[0]?.error_explanation?.includes(icaoUrl)
          || invalidResult.entries[0].error_explanation.includes('icaodesignators.com')) {
          throw new Error(`ICAO remediation is stale: ${JSON.stringify(invalidResult.entries?.[0]?.error_explanation)}`);
        }
        await page.getByRole('button', { name: 'Expand flight details' }).first().click();
        await page.getByText('Data Validation Errors').waitFor({ timeout: 10_000 });
        await page.getByText(icaoUrl, { exact: false }).waitFor({ timeout: 10_000 });
      }
      if (pageErrors.length) throw new Error(`Browser errors: ${pageErrors.join('; ')}`);
      console.log(`browser ok: ${url}`);
    } catch (error) {
      failures.push(`${app.name}: ${String(error)}`);
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}
if (failures.length) {
  for (const failure of failures) console.error(failure);
  process.exitCode = 1;
}
