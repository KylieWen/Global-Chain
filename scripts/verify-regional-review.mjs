import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const config=JSON.parse(await readFile('content/geography/regional-review-supplement-2026-10-23.json','utf8'));
const atlas=JSON.parse(await readFile(config.outputPath,'utf8'));
const base=process.env.REVIEW_BASE_URL??'http://127.0.0.1:3000';
const output=resolve(process.env.REVIEW_OUTPUT_DIR??'output/qa/2026-10-23-regional-review');await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:process.env.CI?undefined:'chrome'});
const page=await browser.newPage({viewport:{width:1440,height:1100}});const errors=[];const checks=[];
page.on('pageerror',error=>errors.push(error.message));
const go=async productId=>{const response=await page.goto(base+'/map/china?product='+productId,{waitUntil:'networkidle'});assert.equal(response.status(),200);};
try{
 for(const node of config.nodes){
  const place=atlas.places.find(place=>place.id===node.placeId);
  await go(node.productId);
  assert.equal(await page.locator('.regional-node').count(),atlas.nodes.filter(item=>item.productId===node.productId).length);
  await page.getByRole('button',{name:`查看${place.name}的${node.label}`,exact:true}).click();
  await page.getByRole('heading',{name:node.label,exact:true}).waitFor();
  assert.equal(await page.locator('.regional-period').innerText(),node.period.label);
  await page.locator('.regional-sources summary').click();
  for(const id of node.sourceIds){const source=atlas.sources.find(source=>source.id===id);assert.ok(await page.locator(`.regional-sources a[href="${source.url}"]`).count());}
  if(node.id==='soy-tj')assert.equal(await page.locator('.regional-adjacent button').count(),0);
  await page.locator('.regional-method summary').click();assert.ok((await page.locator('.regional-method').innerText()).includes(config.datasetVersion));
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:resolve(output,node.id+'.png'),fullPage:true});
  checks.push({node:node.id,sourceLinks:node.sourceIds.length,period:node.period.label});
 }
 // Dense nearby cities must remain reachable by the actual map markers.
 for(const id of ['phone-sz','phone-dg','ebike-wx','ebike-sz']){
  const node=atlas.nodes.find(item=>item.id===id);const place=atlas.places.find(place=>place.id===node.placeId);
  await go(node.productId);
  await page.locator('.regional-node').and(page.getByRole('button',{name:`${place.name} · ${node.label}`,exact:true})).click({timeout:5000});
  await page.getByRole('heading',{name:node.label,exact:true}).waitFor();
  checks.push({marker:id,clickable:true});
 }
 await page.setViewportSize({width:390,height:900});
 for(const node of config.nodes){await go(node.productId);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth));}
 await page.screenshot({path:resolve(output,'mobile.png'),fullPage:true});
 assert.deepEqual(errors,[]);await writeFile(resolve(output,'result.json'),JSON.stringify({base,checkedAt:new Date().toISOString(),checks,pageErrors:errors},null,2));console.log(JSON.stringify({checks,pageErrors:errors}));
}catch(error){await page.screenshot({path:resolve(output,'failure.png'),fullPage:true}).catch(()=>{});throw error;}finally{await browser.close();}
