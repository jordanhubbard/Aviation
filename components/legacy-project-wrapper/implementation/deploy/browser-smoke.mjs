#!/usr/bin/env node
// Post-deployment browser gate for the actual public hostnames in apps.json.
import { readFileSync } from 'node:fs';
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

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined;
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
      if (contract.apps[app.name].interaction === 'citation-disclosure') {
        const disclose = page.getByRole('button', { name: /^Show citations for / }).first();
        await disclose.click();
        await page.getByText('Known citations').waitFor({ timeout: 10_000 });
        if (await page.getByRole('alert').count()) throw new Error('Citation disclosure failed');
      }
      if (contract.apps[app.name].interaction === 'saved-plans-dialog') {
        await page.getByRole('button', { name: 'Load Flight Plan' }).click();
        await page.getByRole('dialog', { name: 'Load Flight Plan' }).waitFor({ timeout: 10_000 });
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
