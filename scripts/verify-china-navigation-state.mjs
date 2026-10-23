import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const base=process.env.REVIEW_BASE_URL??'http://127.0.0.1:3000';
const output=resolve(process.env.REVIEW_OUTPUT_DIR??'output/qa/china-navigation-state');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:process.env.CI?undefined:'chrome'});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const pageErrors=[];const checks=[];
page.on('pageerror',error=>pageErrors.push(error.message));
const path='/map/china?product=generic-home-air-conditioner';
const count=()=>page.locator('.regional-node-list button').count();
const resetLink=()=>page.locator('.product-level-nav').getByRole('link',{name:'中国供应链',exact:true});
const waitStage=stage=>page.waitForFunction(value=>document.querySelector('select[aria-label="中国地图生产环节"]').value===value,stage);
try {
 const response=await page.goto(base+path,{waitUntil:'networkidle'});
 assert.equal(response.status(),200);
 const allCount=await count();assert.ok(allCount>1);
 const stage=page.getByRole('combobox',{name:'中国地图生产环节',exact:true});
 await stage.selectOption('material');
 await page.waitForURL(url=>url.searchParams.get('stage')==='material');
 await page.waitForFunction(total=>{
  const visible=document.querySelectorAll('.regional-node-list button').length;
  return visible>0&&visible<total;
 },allCount);
 const filteredCount=await count();assert.ok(filteredCount>0&&filteredCount<allCount);
 await resetLink().click();await page.waitForURL(url=>!url.searchParams.has('stage'));
 await waitStage('');assert.equal(await count(),allCount);
 checks.push({sameProductNavigationClearsStage:true,allCount,filteredCount});

 await page.goBack();await page.waitForURL(url=>url.searchParams.get('stage')==='material');
 await waitStage('material');assert.equal(await count(),filteredCount);
 await page.goForward();await page.waitForURL(url=>!url.searchParams.has('stage'));
 await waitStage('');assert.equal(await count(),allCount);
 checks.push('Back and forward restore URL, filter and list together');

 await page.goto(base+path+'&stage=material',{waitUntil:'networkidle'});
 await waitStage('material');assert.equal(await count(),filteredCount);
 await page.locator('.regional-node-list button').first().click();
 await page.waitForURL(url=>url.searchParams.has('node'));
 await page.locator('.regional-back').waitFor();
 await resetLink().click();
 await page.waitForURL(url=>!url.searchParams.has('node')&&!url.searchParams.has('stage'));
 await waitStage('');await page.locator('.regional-list-heading').waitFor();
 assert.equal(await count(),allCount);
 assert.equal(await page.locator('.regional-back').count(),0);
 checks.push('A shared filtered URL opens correctly and navigation clears its selected detail');

 await page.reload({waitUntil:'networkidle'});await waitStage('');assert.equal(await count(),allCount);
 await page.screenshot({path:resolve(output,'china-navigation-cleared.png')});
 checks.push('Reload agrees with the cleared URL');
 assert.deepEqual(pageErrors,[]);
 const result={base,checkedAt:new Date().toISOString(),checks,pageErrors};
 await writeFile(resolve(output,'result.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
}finally{await browser.close();}
