import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { launchOwnedBrowser } from '../../../deploy/browser-runner.mjs';
let server, child, base, browser;
process.once('exit',()=>{if(child?.exitCode===null)child.kill('SIGTERM');});
const issued='2026-11-16T00:00:00Z';
const hostile='<img src=x onerror="window.providerExecuted=true">';
before(async () => {
  server=createServer((req,res)=>{
    const u=new URL(req.url,'http://fixture'), code=u.searchParams.get('airport'), taf=u.pathname==='/taf';
    res.setHeader('Content-Type','application/json');
    if (code==='KOAK' && taf) { res.writeHead(503);res.end('{}');return; }
    const missing=code==='KSEA'&&taf;
    res.end(JSON.stringify({status:missing?'no_reports':'available',reports:missing?[]:[{icaoId:code,
      ...(taf?{rawTAF:`TAF ${code} 160000Z 1600/1700 P6SM\n FM160600 BKN030 ${hostile}`,issueTime:issued,validTimeFrom:1794787200,validTimeTo:1794873600}
       :{rawOb:`${code} 160000Z 27005KT 10SM FEW020 18/12 A2992`,reportTime:issued})}],
      source:{provider:'Synthetic browser provider',url:'https://example.invalid',retrieved_at_utc:issued}}));
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const reserve=createServer();reserve.listen(0,'127.0.0.1');await once(reserve,'listening');
  const port=reserve.address().port;await new Promise(r=>reserve.close(r));
  child=spawn(process.execPath,['dist/index.js'],{cwd:new URL('..',import.meta.url),env:{...process.env,PORT:String(port),AVIATION_E2E_OFFLINE:'true',AVIATION_WEATHER_API_BASE_URL:`http://127.0.0.1:${server.address().port}`},stdio:'ignore'});
  base=`http://127.0.0.1:${port}`;
  let ready=false;
  for(let i=0;i<60;i++){try{if((await fetch(base+'/health')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
  assert.ok(ready,'weather app started');
  const fallback='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const executablePath=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||(existsSync(chromium.executablePath())?undefined:(existsSync(fallback)?fallback:undefined));
  browser=await launchOwnedBrowser(chromium,{headless:true,...(executablePath?{executablePath}:{})});
});
after(async()=>{
  await browser?.close();
  if(child && child.exitCode===null){const exit=once(child,'exit');child.kill('SIGTERM');await exit;}
  server?.closeAllConnections();if(server)await new Promise(r=>server.close(r));
});
async function pageFor(t,viewport){
 const page=await browser.newPage({viewport});t.after(()=>page.close());const errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});t.after(()=>assert.deepEqual(errors,[]));
 // This boundary stub keeps third-party maps/CDNs outside weather/UI acceptance.
 const leaflet=`const layer=()=>({addTo(){return this},clearLayers(){},bindPopup(){return this},on(){return this}});window.L={map:()=>({setView(){return this},fitBounds(){}}),tileLayer:layer,layerGroup:layer,circleMarker:layer};`;
 await page.route('https://unpkg.com/**',r=>r.fulfill({body:r.request().url().includes('.js')?leaflet:'',contentType:r.request().url().includes('.js')?'application/javascript':'text/css'}));
 await page.route('https://meta-app.jordanhubbard.net/**',r=>r.fulfill({body:'',contentType:'application/javascript'}));
 await page.route(base+'/',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace(/\s+integrity="[^"]*"/g,'')});});
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.locator('#station-list .station-card').first().waitFor();
 return page;
}
for(const [name,viewport] of [['desktop',{width:1280,height:900}],['mobile',{width:390,height:844}]])test(name+': real legacy payloads render both products safely and show missing/failed TAFs',async t=>{
 const page=await pageFor(t,viewport);
 assert.equal(await page.locator('input[name="forecast-day"]').count(),0);
 const card=page.locator('#station-list .station-card').filter({has:page.getByRole('heading',{name:'KSFO',exact:true})});
 await card.locator('details').filter({hasText:'TAF forecast'}).locator('summary').click();
 await card.getByText('TAF KSFO',{exact:false}).waitFor();
 assert.match(await card.innerText(),/Valid 2026-11-16T00:00:00.000Z/);
 assert.equal(await page.locator('#station-list img').count(),0);assert.equal(await page.evaluate(()=>window.providerExecuted),undefined);
 const missing=page.locator('#station-list .station-card').filter({has:page.getByRole('heading',{name:'KSEA',exact:true})});
 await missing.getByText('TAF forecast: no_reports').waitFor();
 await page.getByRole('button',{name:'Get Briefing'}).click();
 await page.locator('#briefing-output').getByText('TAF forecast:',{exact:false}).waitFor();
 assert.match(await page.locator('#briefing-output').innerText(),/METAR observation:/);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:`/tmp/aviation-legacy-taf-${name}.png`,fullPage:true});
 await page.screenshot({path:`/tmp/aviation-legacy-taf-${name}-viewport.png`});
 // A custom station with a provider failure still renders the usable METAR briefing.
 await page.locator('#station-input').fill('KOAK');await page.locator('#station-input').blur();
 await page.getByRole('button',{name:'Get Briefing'}).click();
 await page.locator('#briefing-output').getByText('Provider unavailable',{exact:false}).waitFor();
 assert.match(await page.locator('#briefing-output').innerText(),/KOAK 160000Z/);
});
test('changing station/region aborts stale responses and clears prior briefing',async t=>{
 const page=await pageFor(t,{width:1280,height:900});let release;
 const held=new Promise(r=>release=r);
 await page.route('**/briefing?station=KSFO',async route=>{await held;try{await route.fulfill({body:'STALE KSFO',contentType:'text/plain'});}catch{}});
 await page.getByRole('button',{name:'Get Briefing'}).click();
 await page.locator('#station').selectOption('KLAX');
 assert.match(await page.locator('#briefing-output').innerText(),/Selection changed/);release();
 await page.getByRole('button',{name:'Get Briefing'}).click();
 await page.locator('#briefing-output').getByText('WEATHER BRIEFING: KLAX',{exact:false}).waitFor();
 assert.doesNotMatch(await page.locator('#briefing-output').innerText(),/STALE/);
 let releaseRegion;const pendingRegion=new Promise(r=>releaseRegion=r);
 await page.route('**/stations?region=us-east',async route=>{await pendingRegion;try{await route.fulfill({json:{region:'us-east',stations:[{code:'STALE_REGION'}]}});}catch{}});
 await page.locator('#region').selectOption('us-east');
 await page.locator('#region').selectOption('europe');releaseRegion();
 await page.locator('#station-list').getByRole('heading',{name:'EGLL',exact:true}).waitFor();
 assert.equal(await page.locator('#station-list').getByRole('heading',{name:'KSFO',exact:true}).count(),0);
 assert.doesNotMatch(await page.locator('#station-list').innerText(),/STALE_REGION/);
});
