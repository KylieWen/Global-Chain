import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir,writeFile,readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const base=process.env.REVIEW_BASE_URL??'http://127.0.0.1:3000';
const output=resolve(process.env.REVIEW_OUTPUT_DIR??'output/qa/2026-10-24-mobile-usage-local');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome'});
const errors=[];const checks=[];
const before=JSON.parse(await readFile('output/qa/2026-10-24-mobile-before/layout.json','utf8')).results;
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
await context.addInitScript(()=>localStorage.setItem('global-chain.first-visit-guide.v1','skipped'));
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
const packets=[];page.on('request',request=>{if(new URL(request.url()).pathname==='/api/usage')packets.push(JSON.parse(request.postData()));});
const go=async path=>{assert.equal((await page.goto(base+path,{waitUntil:'networkidle',timeout:90000})).status(),200);};
try {
 for(const [width,height] of [[360,800],[390,844],[430,932],[844,390]]){
  await page.setViewportSize({width,height});
  for(const path of ['/map?product=generic-home-air-conditioner','/map/china?product=generic-home-air-conditioner','/products/generic-cotton-tshirt/industry','/products/generic-smartphone/provenance']){
   await go(path);
   await page.waitForFunction(()=>{const nav=document.querySelector('.product-level-nav')?.getBoundingClientRect();const a=document.querySelector('.product-level-nav [aria-current="page"]')?.getBoundingClientRect();return nav&&a&&a.left>=nav.left-1&&a.right<=nav.right+1;});
   const dimensions=await page.evaluate(()=>({header:document.querySelector('.site-header').getBoundingClientRect().height,nav:document.querySelector('.product-level-nav').getBoundingClientRect().height,mapTop:document.querySelector('.world-country-map,.china-supply-map')?.getBoundingClientRect().top,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,selectedVisible:(()=>{const nav=document.querySelector('.product-level-nav').getBoundingClientRect();const active=document.querySelector('.product-level-nav [aria-current="page"]').getBoundingClientRect();return active.left>=nav.left-1&&active.right<=nav.right+1;})()}));
   assert.ok(dimensions.header<=110,JSON.stringify({width,path,dimensions}));assert.ok(dimensions.nav<=62);assert.ok(!dimensions.overflow,JSON.stringify({width,path,dimensions}));assert.ok(dimensions.selectedVisible,JSON.stringify({width,path,dimensions}));
   const prior=before.find(row=>row.width===width&&row.path===path);
   // Keep 44px touch controls while requiring more of the map in the first screen.
   if(width<=640&&dimensions.mapTop)assert.ok(dimensions.mapTop<prior.mapTop-(path.startsWith('/map/china')?100:50),JSON.stringify({prior,dimensions}));
   checks.push({width,height,path,...dimensions});
   if(width===390)await page.screenshot({path:resolve(output,`${path.includes('/china')?'china':path.startsWith('/map')?'world':path.endsWith('industry')?'industry':'sources'}-390.png`)});
  }
 }
 await page.setViewportSize({width:390,height:844});await go('/map?product=generic-home-air-conditioner');
 await page.getByRole('button',{name:'打开搜索',exact:true}).click();await page.locator('#global-search-input').fill('PRIVATE-SEARCH-NEVER-STORE');
 assert.equal(await page.locator('#global-search-input').evaluate(el=>document.activeElement===el),true);
 await page.keyboard.press('Escape');await page.locator('#global-search-input').waitFor({state:'hidden'});
 await page.getByRole('button',{name:'放大地图',exact:true}).click();
 await page.getByRole('combobox',{name:'选择记录年度',exact:true}).selectOption({index:0});
 await page.waitForTimeout(5500);
 assert.ok(packets.flatMap(p=>p.events).some(e=>e.event==='map_zoom'));
 for(const row of packets.flatMap(p=>p.events))assert.deepEqual(Object.keys(row).sort(),['device','event','page']);
 assert.ok(!JSON.stringify(packets).includes('PRIVATE-SEARCH'));
 await page.locator('.usage-preference > summary').click();await page.getByRole('checkbox',{name:'允许匿名使用统计'}).uncheck();
 const stoppedAt=packets.length;await page.reload({waitUntil:'networkidle'});await page.waitForTimeout(5500);
 assert.equal(packets.length,stoppedAt,'Opt-out prevents requests after reload');
 const privacyContext=await browser.newContext();await privacyContext.addInitScript(()=>Object.defineProperty(navigator,'globalPrivacyControl',{value:true}));
 const privacyPage=await privacyContext.newPage();let restrictedRequests=0;privacyPage.on('request',r=>{if(r.url().endsWith('/api/usage'))restrictedRequests++;});
 await privacyPage.goto(base+'/map',{waitUntil:'networkidle'});await privacyPage.waitForTimeout(5500);assert.equal(restrictedRequests,0);await privacyContext.close();
 const invalid=await page.request.post(base+'/api/usage',{headers:{origin:base},data:{events:[{event:'page_view',page:'home',device:'phone',search:'private'}]}});assert.equal(invalid.status(),400);
 const cross=await page.request.post(base+'/api/usage',{headers:{origin:'http://outside.example'},data:{events:[{event:'page_view',page:'home',device:'phone'}]}});assert.equal(cross.status(),403);
 assert.equal((await page.request.get(base+'/api/usage')).status(),405);
 assert.deepEqual(errors,[]);
 const result={base,checkedAt:new Date().toISOString(),checks,packets:packets.length,optOutPersists:true,globalPrivacyControl:true,searchTextExcluded:true,crossOriginRejected:true,publicReadRejected:true,pageErrors:errors};
 await writeFile(resolve(output,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
} finally {await browser.close();}
