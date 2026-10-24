import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const base=process.env.REVIEW_BASE_URL??'http://127.0.0.1:3000';
const output=resolve(process.env.REVIEW_OUTPUT_DIR??'output/qa/mobile-layout');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome'});const results=[];
try {
 for(const [width,height] of [[360,800],[390,844],[430,932],[844,390]]){
  const page=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true});
  await page.addInitScript(()=>localStorage.setItem('global-chain.first-visit-guide.v1','skipped'));
  for(const path of ['/','/map?product=generic-home-air-conditioner','/map/china?product=generic-home-air-conditioner','/products/generic-cotton-tshirt/industry','/products/generic-smartphone/provenance']){
   await page.goto(base+path,{waitUntil:'networkidle',timeout:90000});
   results.push({width,height,path,...await page.evaluate(()=>({headerHeight:document.querySelector('.site-header').getBoundingClientRect().height,navHeight:document.querySelector('.product-level-nav')?.getBoundingClientRect().height,mapTop:document.querySelector('.world-country-map,.china-supply-map')?.getBoundingClientRect().top,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth}))});
   if(path.startsWith('/map'))await page.screenshot({path:resolve(output,`${path.startsWith('/map/china')?'china':'world'}-${width}.png`)});
  }
  await page.close();
 }
 await writeFile(resolve(output,'layout.json'),JSON.stringify({base,checkedAt:new Date().toISOString(),results},null,2));
 console.log(JSON.stringify(results));
} finally {await browser.close();}
