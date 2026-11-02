// Built SDK consumer smoke: real browser and HTTP failure/success fixtures, no production secrets.
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const impl=fileURLToPath(new URL('../../..',import.meta.url));
const root=resolve(impl,'../../..');
const require=createRequire(impl+'/package.json');
const {chromium}=require('@playwright/test');
const {traceE2EBrowser}=require(impl+'/packages/shared-sdk/dist/e2e/index.js');
const dist=resolve(impl+'/apps/g1000-simulator/frontend/dist');
const secret='synthetic-sensitive-settings-fixture';
let successful=false,configured=false;
const server=createServer(async(req,res)=>{
 const path=new URL(req.url,'http://fixture').pathname;
 if(path==='/api/settings'){
  res.setHeader('content-type','application/json');res.end(JSON.stringify({services:[{id:'openweather',configured,fields:[{key:'api_key',configured}]}]}));return;
 }
 if(path==='/api/settings/secrets'){
  let raw='';for await(const chunk of req)raw+=chunk;
  const body=JSON.parse(raw);
  if(body.service!=='openweather'||body.key!=='api_key'||body.value!==secret){res.writeHead(400);res.end('{}');return;}
  if(successful)configured=true;
  res.setHeader('content-type','application/json');res.end(JSON.stringify(successful?{success:true,service:body.service,key:body.key}:{success:false,error:secret}));return;
 }
 let file=resolve(dist,'.'+decodeURIComponent(path));
 if(!file.startsWith(dist+sep)||!existsSync(file)||path==='/settings'||path==='/')file=dist+'/index.html';
 const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml'};
 res.setHeader('content-type',types[extname(file)]||'application/octet-stream');res.end(readFileSync(file));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const executable=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const browser=traceE2EBrowser(await chromium.launch({headless:true,...(executable?{executablePath:executable}:{})}), 'g1000-simulator', root+'/_build/settings-client-traces');
const output=root+'/_build/settings-client-captures';mkdirSync(output,{recursive:true});
try{
 for(const [name,viewport] of [['desktop',{width:1280,height:720}],['mobile',{width:390,height:844}]]){
  successful=false;configured=false;
  const context=await browser.newContext({viewport});
  const page=await context.newPage();const errors=[];
  page.on('pageerror',e=>{errors.push(e.message);console.error('PAGEERROR',e.message);});page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route('https://meta-app.jordanhubbard.net/feedback-widget.js',route=>route.fulfill({status:200,contentType:'text/javascript',body:readFileSync(impl+'/apps/meta-app/public/feedback-widget.js','utf8')}));
  await page.goto(base+'/settings');
  await page.getByText('OpenWeatherMap',{exact:true}).click();
  await page.getByPlaceholder('Enter API Key',{exact:true}).first().fill(secret);
  await page.getByRole('button',{name:'Save',exact:true}).first().click();
  await page.getByText('Secret save was not confirmed',{exact:true}).waitFor();
  if(await page.getByText('Saved successfully.',{exact:true}).count()||configured)throw Error('False save displayed success');
  if((await page.locator('body').innerText()).includes(secret))throw Error('Secret leaked into error text');
  await page.screenshot({path:output+'/'+name+'-rejected.png',fullPage:true});
  successful=true;
  await page.getByRole('button',{name:'Save',exact:true}).first().click();
  await page.getByText('Saved successfully.',{exact:true}).waitFor();
  await page.getByText('Configured ✓',{exact:true}).waitFor();
  if(!configured)throw Error('Confirmed write was not observed');
  if(errors.length)throw Error('Browser errors: '+errors.join('; '));
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Document overflows');
  await page.screenshot({path:output+'/'+name+'-confirmed.png',fullPage:true});
  await context.close();console.log(name+': false success rejected, secret redacted, confirmed save accepted');
 }
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
