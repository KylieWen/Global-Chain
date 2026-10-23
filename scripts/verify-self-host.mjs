import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir,readFile,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { browserResearchExport } from './lib/browser-research-export.mjs';

const base=process.env.REVIEW_BASE_URL??'http://62.171.148.193';
const output=resolve(process.env.REVIEW_OUTPUT_DIR??'output/deploy/live-verification');await mkdir(output,{recursive:true});
const products=JSON.parse(await readFile('data/published/manifest.json','utf8')).fixtures;
const browser=await chromium.launch({channel:'chrome',args:['--disable-gpu']});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];const checks=[];
page.on('pageerror',error=>errors.push(error.message));
const go=async path=>{const response=await page.goto(base+path,{waitUntil:'networkidle',timeout:60000});assert.equal(response.status(),200,path);};
try {
 const health=await page.request.get(base+'/api/health');assert.equal(health.status(),200);assert.equal((await health.json()).service,'web');
 for(const {productId,datasetVersion} of products){
  for(const path of [`/products/${productId}`,`/products/${productId}/supply-chain`,`/products/${productId}/provenance`,`/map?product=${productId}`,`/map/china?product=${productId}`])await go(path);
  assert.ok(await page.locator('.regional-node').count()>0);
  const exported=await browserResearchExport(page,`/api/products/${productId}/research-export`);assert.equal(exported.status,200);assert.equal(exported.datasetVersion,datasetVersion);assert.ok(exported.bytes>0);
  checks.push({productId,datasetVersion,pages:5,export:true});
 }
 await go('/map?product=generic-home-air-conditioner');
 await page.getByRole('combobox',{name:'选择国家',exact:true}).selectOption('country-cn');await page.waitForURL(url=>url.searchParams.get('country')==='country-cn');await page.waitForLoadState('networkidle');
 assert.equal(await page.locator('.map-country-shape.selected').count(),1);
 await page.screenshot({path:resolve(output,'world-desktop.png'),fullPage:true});
 await page.getByRole('link',{name:'进入中国供应链 →',exact:true}).click();await page.waitForURL(/\/map\/china\?/);await page.waitForLoadState('networkidle');
 await page.getByRole('button',{name:'查看宁波的铜管与换热材料',exact:true}).click();await page.getByRole('heading',{name:'铜管与换热材料',exact:true}).waitFor();
 assert.ok((await page.locator('.regional-organization').innerText()).includes('金田'));
 await page.screenshot({path:resolve(output,'china-selected-desktop.png'),fullPage:true});
 checks.push('World -> China -> regional role -> enterprise works over the public URL');
 await go('/map?product=generic-smartphone&datasetVersion=globe-chain-smartphone-2026.2');
 assert.ok((await page.locator('.atlas-reading-notes a').getAttribute('href')).includes('datasetVersion=globe-chain-smartphone-2026.2'));
 await go('/products/generic-smartphone/provenance?datasetVersion=globe-chain-smartphone-2026.2');await page.locator('.context-banner summary').click();assert.ok((await page.locator('.context-banner').innerText()).includes('globe-chain-smartphone-2026.2'));
 const historicalDownload=await page.getByRole('link',{name:'下载研究快照（JSON）',exact:true}).getAttribute('href');
 assert.ok(historicalDownload.includes('datasetVersion=globe-chain-smartphone-2026.2'));
 assert.equal((await browserResearchExport(page,historicalDownload)).datasetVersion,'globe-chain-smartphone-2026.2');
 checks.push('Historical source page downloads the selected 2026.2 snapshot');
 for(const width of [1024,390]){
  await page.setViewportSize({width,height:900});await go('/map/china?product=generic-home-air-conditioner');
  const dimensions=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));assert.ok(dimensions.scroll<=dimensions.client);
  await page.locator('.nav-group > summary').filter({hasText:'数据与指南'}).click();await page.getByRole('navigation',{name:'主导航'}).getByRole('link',{name:/进出口指南/}).waitFor();
  await page.screenshot({path:resolve(output,`china-menu-${width}.png`),fullPage:true});checks.push({width,dimensions});
 }
 assert.deepEqual(errors,[]);
 await writeFile(resolve(output,'result.json'),JSON.stringify({base,checkedAt:new Date().toISOString(),checks,pageErrors:errors},null,2));
 console.log(JSON.stringify({base,checks,pageErrors:errors}));
} finally {await browser.close();}
