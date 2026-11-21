import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {asset} from '../../deploy/aviation-data-qualification.mjs';
import {launchOwnedBrowser} from '../../deploy/browser-runner.mjs';
const raw='<img src=x onerror="window.injected=true"> KFST ORIGINAL METAR';
const report=(status='suspicious')=>({station_id:'KFST',status,checked_at_utc:'2026-11-20T12:00:00Z',
 target:{station_id:'KFST',observed_at_epoch:1795175400,original:{rawOb:raw}},
 neighbors:[{station_id:'KAAA',category:'IFR',distance_nm:30,observed_at_epoch:1795175400,ceiling_ft:600,visibility_sm:2,exclusion:null,original:{rawOb:'KAAA ORIGINAL IFR'}},
 {station_id:'KBBB',category:'IFR',distance_nm:50,observed_at_epoch:1795175400,exclusion:'elevation_difference',original:{rawOb:'KBBB ORIGINAL'}}],
 flags:status==='suspicious'?[{code:'regional_disagreement',explanation:'VFR conflicts with nearby IFR observations.'}]:[],
 qualifying_neighbors:3,ifr_neighbors:3,forecast_context:[{original_forecast:'TAF ORIGINAL TEMPO',period:{changeIndicator:'TEMPO'},observed_votes:0}],
 source:{metar:{provider:'Synthetic NOAA',retrieved_at_utc:'2026-11-20T12:00:00Z'}},truncated:true,errors:[],limitations:['Disagreement is not proof of sensor failure.']});
test('METAR review preserves evidence on desktop and mobile with explicit requests and stale-result fencing',async t=>{
 const events=[];const browser=await launchOwnedBrowser(chromium,{headless:true},{report:e=>{events.push(e);console.error(JSON.stringify(e));}});
 t.after(async()=>{await browser.close();assert.ok(events.some(e=>e.phase==='process.exit'&&e.code===0&&e.signal===null));assert.ok(!events.some(e=>e.phase==='server.kill'||e.status==='recovered'));});
 async function setup(t,respond=()=>({body:report()}),width=1280){
  const page=await browser.newPage({viewport:{width,height:844}});page.setDefaultTimeout(5000);t.after(()=>page.close());const calls=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));t.after(()=>assert.deepEqual(errors,[]));
  await page.route('https://meta-app.jordanhubbard.net/**',async route=>{const url=new URL(route.request().url());calls.push(url);assert.ok(url.pathname.endsWith('/metar-consistency'));
   const result=await respond(url);await route.fulfill({status:result.status??200,contentType:'application/json',body:JSON.stringify(result.body),headers:{'access-control-allow-origin':'*'}}).catch(e=>{if(!/closed|cancel|abort/i.test(e.message))throw e;});});
  await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><aviation-data-panel airports="KFST KMAF"></aviation-data-panel>');await page.addScriptTag({content:asset});
  return {page,panel:page.locator('aviation-data-panel'),calls};
 }
 for(const width of [1280,390])await t.test('original observations, exclusions, UTC and literal source text at '+width,async t=>{
  const {page,panel,calls}=await setup(t,undefined,width);assert.equal(calls.length,0);
  await panel.getByRole('button',{name:'Check METAR consistency',exact:true}).click();await panel.getByText(/Suspicious METAR — investigate/).waitFor();
  assert.equal(calls.length,1);assert.equal(calls[0].searchParams.get('airport'),'KFST');assert.match(await panel.locator('.consistency-results').innerText(),/elevation_difference/);
  assert.equal(await panel.locator('.consistency-results pre').first().textContent(),raw);assert.equal(await panel.locator('img').count(),0);assert.equal(await page.evaluate(()=>window.injected),undefined);
  assert.match(await panel.locator('.consistency-results').innerText(),/2026-11-20 11:50:00 UTC/);assert.match(await panel.locator('.consistency-results').innerText(),/not proof of sensor failure/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 });
 for(const [status,label]of [['no_conflict_detected','does not validate the report'],['insufficient_evidence','Insufficient evidence'],['unavailable','evidence unavailable']])await t.test(status+' remains explicit',async t=>{
  const {panel}=await setup(t,()=>({body:report(status)}));await panel.getByRole('button',{name:'Check METAR consistency',exact:true}).click();await panel.locator('.consistency-status').filter({hasText:label}).waitFor();
 });
 await t.test('failure and selection changes discard stale warnings',async t=>{
  const {page,panel,calls}=await setup(t,async()=>{await new Promise(r=>setTimeout(r,150));return {body:report()};});
  await panel.getByRole('button',{name:'Check METAR consistency',exact:true}).click();await panel.getByLabel('METAR station',{exact:true}).fill('KMAF');
  await page.waitForTimeout(250);assert.equal(await panel.locator('.consistency-results').textContent(),'');assert.equal(calls.length,1);
  await panel.getByRole('button',{name:'Check METAR consistency',exact:true}).click();await panel.getByText(/original METAR has not been validated/).waitFor(); // wrong-station reply is rejected
 });
 await t.test('route context and disconnected panels abort outstanding work',async t=>{
  const {page,panel}=await setup(t,async()=>{await new Promise(r=>setTimeout(r,150));return {body:report()};});
  await panel.getByRole('button',{name:'Check METAR consistency',exact:true}).click();await panel.evaluate(n=>n.setAttribute('airports','KSFO KOAK'));await page.waitForTimeout(250);assert.equal(await panel.locator('.consistency-results').textContent(),'');
 });
});
