import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {browserResearchExport} from './lib/browser-research-export.mjs';

const base=process.env.REVIEW_BASE_URL??'http://127.0.0.1:3000';
const output=resolve(process.env.REVIEW_OUTPUT_DIR??'output/qa/2026-10-23-independent-review');await mkdir(output,{recursive:true});
const manifest=JSON.parse(await readFile('data/published/manifest.json','utf8'));
const browser=await chromium.launch({channel:process.env.CI?undefined:'chrome'});
const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];const checks=[];
await page.addInitScript(()=>localStorage.setItem('global-chain.first-visit-guide.v1','skipped'));
page.on('pageerror',error=>errors.push(error.message));
const go=async path=>{const response=await page.goto(base+path,{waitUntil:'networkidle',timeout:60000});assert.equal(response.status(),200,path);const guide=page.getByRole('dialog',{name:'Global Chain 新手引导',exact:true});if(await guide.isVisible())await guide.locator('[data-guide-action="skip"]').click()};
const shot=async name=>page.screenshot({path:resolve(output,name+'.png'),fullPage:true});
try{
 await go('/map?product=generic-smartphone');assert.equal(await page.locator('.map-country-shape.selected').count(),0);
 await go('/map?product=generic-electric-bicycle&layer=trade&country=country-cn');
 assert.equal(await page.locator('.map-country-shape[aria-label^="新加坡"]').count(),1);assert.ok(await page.locator('.country-trade-line').count()>=2);await shot('singapore-after');checks.push('Singapore outline and bilateral endpoint retained');
 await go('/');await page.getByRole('link',{name:'空调与制冷产业导览 ↗',exact:true}).click();await page.getByRole('heading',{name:'蒸发式冷凝器',exact:true}).waitFor();
 assert.equal(await page.locator('.industry-selected h2').innerText(),'蒸发式冷凝器');
 assert.ok((await page.locator('.industry-flow-columns').innerText()).includes('制冰机'));
 assert.ok(!(await page.locator('.industry-flow-columns').innerText()).includes('企业产品与业务咨询'));
 assert.ok(await page.locator('.industry-company-grid a[href^="https://www.snowman.cn"]').count()>0);await shot('industry-condenser');
 await page.locator('.industry-flow-columns a').filter({hasText:'蒸发式冷凝盘管'}).click();await page.getByRole('heading',{name:'蒸发式冷凝盘管',exact:true}).waitFor();await page.waitForLoadState('networkidle');assert.ok((await page.locator('.industry-flow-columns').innerText()).includes('不锈钢盘管管材'));checks.push('Home -> condenser -> coil -> material; sourced ice application and enterprise links');
 await go('/demo');assert.equal(new URL(page.url()).pathname,'/');assert.ok(await page.locator('main a[href*="industry?topic=evaporative-condenser"]').count()>0);assert.ok(await page.locator('[data-guide-action="open"]:visible').count()>0);assert.equal(await page.locator('nav[aria-label="主导航"] a[href="/demo"]').count(),0);await shot('retired-demo-home');checks.push('Retired demo opens the real homepage and its visitor guide');
 for(const keyword of ['封装','锂','蒸发冷','冷排','GMCC']){await go('/search?q='+encodeURIComponent(keyword));assert.equal(await page.getByRole('heading',{name:'换个关键词试试'}).count(),0,keyword)}checks.push('Node/material search and industry aliases work');
 await go('/trade-guide');
 // The product select only lists products that actually have a recorded guide;
 // iterate the offered options instead of assuming every published fixture appears.
 const offeredGuideProducts=await page.locator('select[name="product"] option').evaluateAll(options=>options.filter(option=>option.value&&!option.disabled).map(option=>option.value));
 assert.ok(offeredGuideProducts.length,'trade guide offers at least one product');
 for(const productId of offeredGuideProducts){
  const entry=manifest.fixtures.find(item=>item.productId===productId);
  await go('/trade-guide');await page.locator('select[name="product"]').selectOption(productId);
  await page.locator('select[name="jurisdiction"]').selectOption('country-cn');
  await page.locator('select[name="direction"]').selectOption('export');
  await page.getByRole('button',{name:'开始查询 →',exact:true}).click();await page.waitForLoadState('networkidle');
  assert.match(await page.locator('.trade-guide-results-heading').innerText(),/1\s*组结果/);
  if(productId!=='generic-smartphone')assert.ok((await page.locator('main').innerText()).includes('中国出口核验导航'));
  const exported=await browserResearchExport(page,`/api/products/${productId}/research-export`);assert.equal(exported.status,200);assert.equal(exported.datasetVersion,entry.datasetVersion);assert.ok(exported.bytes>0);
 }
 await shot('export-guide');checks.push({guideProducts:offeredGuideProducts.length,versionedExports:true});
 const config=JSON.parse(await readFile('content/data-refresh/review-supplement-2026-10-23.json','utf8'));
 let countriesChecked=0;
 for(const descriptor of config.records){
  const old=JSON.parse(await readFile(descriptor.basePath,'utf8'));
  const current=JSON.parse(await readFile(resolve('data/published',manifest.fixtures.find(entry=>entry.productId===descriptor.productId).path),'utf8'));
  for(const entity of old.entities.filter(entity=>!old.macroIndicators.some(row=>row.entityId===entity.id)&&current.macroIndicators.some(row=>row.entityId===entity.id))){
   await go(`/products/${descriptor.productId}/ledger/${entity.id}`);assert.ok(await page.locator('.ledger-snapshot .stat-card').count()>=3);assert.ok((await page.locator('main').innerText()).includes('2025'));countriesChecked++;
  }
 }assert.equal(countriesChecked,12);await shot('new-ledger');checks.push({newCountryProductLedgers:countriesChecked});
 await go('/map?product=generic-smartphone');
 await page.route('**/map?**',async route=>{if(route.request().headers().rsc==='1')await new Promise(resolve=>setTimeout(resolve,700));await route.continue()});
 const filterToggle=page.locator('.atlas-filters-toggle');
 if(await filterToggle.count()&&await filterToggle.getAttribute('aria-expanded')==='false'){await filterToggle.click();await page.locator('#atlas-filters-body:visible').waitFor({timeout:3000});}
 const began=Date.now();await page.getByRole('combobox',{name:'选择国家',exact:true}).selectOption('country-cn');await page.getByRole('status').filter({hasText:'正在更新地图'}).waitFor();checks.push({pendingObservedMs:Date.now()-began});await shot('pending');await page.waitForURL(url=>url.searchParams.get('country')==='country-cn');await page.locator('.atlas-workspace[aria-busy="false"]').waitFor();await page.unrouteAll({behavior:'wait'});
 for(const width of [1024,390]){await page.setViewportSize({width,height:900});await go('/map/china');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth));
  // Narrow headers collapse the grouped nav into a single 菜单 panel.
  const navSummary=width<=640?page.locator('.nav-group--menu > summary'):page.locator('.nav-group--groups > summary').filter({hasText:'数据与指南'});
  await navSummary.click();await page.getByRole('navigation',{name:'主导航'}).getByRole('link',{name:/数据版本/}).waitFor();assert.equal(await page.locator('nav[aria-label="主导航"] a[href="/demo"]').count(),0);await shot(`menu-${width}`)}
 if(['127.0.0.1','localhost'].includes(new URL(base).hostname)){
  const outside=[];await page.route('**/*',route=>{const host=new URL(route.request().url()).hostname;if(!['127.0.0.1','localhost'].includes(host)){outside.push(route.request().url());return route.abort()}return route.continue()});
  for(const path of ['/','/map','/map/china','/products/generic-home-air-conditioner/industry?topic=evaporative-condenser','/trade-guide'])await go(path);
  assert.deepEqual(outside,[]);await page.unrouteAll({behavior:'wait'});checks.push('Local walkthrough uses no external network resources');
  const faulty=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3003'],{cwd:resolve('apps/web'),env:{...process.env,GLOBECHAIN_DATA_MANIFEST:resolve(output,'intentionally-missing-manifest.json')},stdio:'ignore',windowsHide:true});
  const errorPage=await browser.newPage();try{
   for(let attempt=0;attempt<40;attempt++){try{const response=await errorPage.request.get('http://127.0.0.1:3003/api/health');if(response.ok())break}catch{}await new Promise(resolve=>setTimeout(resolve,250))}
   await errorPage.goto('http://127.0.0.1:3003/map');await errorPage.getByRole('heading',{name:'这页暂时没能打开'}).waitFor();assert.ok(!(await errorPage.locator('main').innerText()).includes('intentionally-missing-manifest'));await errorPage.screenshot({path:resolve(output,'error-boundary.png'),fullPage:true});checks.push('Isolated missing-data fault shows the site error boundary without exposing paths');
  }finally{await errorPage.close();faulty.kill()}
 }
 assert.deepEqual(errors,[]);await writeFile(resolve(output,'result.json'),JSON.stringify({base,checkedAt:new Date().toISOString(),checks,pageErrors:errors},null,2));console.log(JSON.stringify({checks,pageErrors:errors}));
}finally{await page.unrouteAll({behavior:'ignoreErrors'});await browser.close()}
