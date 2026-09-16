import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
const base=process.env.DECK_BASE_URL??'http://localhost:3000';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const browser=await chromium.launch(process.env.DECK_BROWSER_PATH?{executablePath:process.env.DECK_BROWSER_PATH}:{channel:'chrome',args:['--disable-gpu','--renderer-process-limit=1']});
const page=await browser.newPage({viewport:{width:1920,height:1080}});const external=[];const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',route=>{const url=new URL(route.request().url());if(['http:','https:'].includes(url.protocol)&&url.origin!==new URL(base).origin){external.push(url.origin);return route.abort()}return route.continue()});
const visited=[];
async function visit(path){const r=await page.goto(base+path,{waitUntil:'networkidle'});assert.ok(r?.ok(),path);assert.equal(await page.locator('.preview-banner').count(),0);visited.push(path)}
try{
 await visit('/');assert.match(await page.locator('h1').innerText(),/一件商品/);const links=await page.locator('nav[aria-label="主导航"]>a').evaluateAll(es=>es.map(e=>e.getAttribute('href')));assert.deepEqual(links.slice(0,4),['/products','/map','/countries','/trade-guide']);
 const product=await page.locator('.visitor-hero-actions a').first().getAttribute('href');assert.ok(product?.startsWith('/products/'));
 await visit('/demo');const steps=await page.locator('.demo-step-card .card-kicker').allTextContents();assert.match(steps[0],/地图/);assert.match(steps[4],/延伸/);
 await visit('/map');await page.waitForFunction(()=>document.querySelectorAll('.map-country-shape').length>100);assert.equal(await page.locator('.map-country-shape.selected').count(),0);assert.ok(await page.locator('.country-trade-line').count()>0);
 const g=page.locator('svg.world-country-map>g').first();const before=await g.getAttribute('transform');await page.getByRole('button',{name:'放大地图',exact:true}).click();assert.notEqual(await g.getAttribute('transform'),before);await page.getByRole('button',{name:'重置',exact:true}).click();assert.equal(await g.getAttribute('transform'),before);
 await page.locator('.map-country-shape.has-data').first().focus();await page.keyboard.press('Enter');await page.waitForURL(url=>url.searchParams.has('country'));await page.waitForLoadState('networkidle');assert.equal(await page.locator('.map-country-shape.selected').count(),1);const ledger=await page.locator('.map-selection-actions a').getAttribute('href');assert.ok(ledger);await visit(ledger);assert.match(await page.locator('h1').innerText(),/国家账本/);assert.ok(await page.locator('.ledger-snapshot').count());
 await visit(product);assert.ok(await page.locator('.product-tree').count());const route=await page.locator('.product-focus-meta a').first().getAttribute('href');assert.ok(route);await visit(route);assert.ok(await page.locator('.route-declaration').count());assert.ok(await page.locator('.route-graph').count());
 await visit('/countries');await visit('/help');assert.match(await page.locator('.intro-copy').innerText(),/分项统计.*覆盖有限/);
 await visit('/trade-guide');const preset=await page.locator('.trade-guide-preset').first().getAttribute('href');assert.ok(preset);await visit(preset);assert.match(await page.locator('.trade-tariff-value').first().innerText(),/0|13|19/);assert.ok(await page.locator('.trade-guide-conclusion a[href^="https://"]').count());
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);await mkdir('.preview/review-fix',{recursive:true});const report={checkedAt:new Date().toISOString(),visited,mainNavigation:true,mapKeyboardSelection:true,mapZoomReset:true,scopedKnownTariff:true,externalRequests:external.length,pageErrors:errors.length};await writeFile('.preview/review-fix/product-validation.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close()}
