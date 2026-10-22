import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const phase=process.argv[2]??'before';
const folder=resolve('output/qa/2026-10-23-claude-completion',phase);await mkdir(folder,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--disable-gpu']});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const rows=[];
for(const [name,path] of [['world','/map?product=generic-smartphone'],['trade','/map?product=generic-smartphone&layer=trade'],['china','/map/china?product=generic-home-air-conditioner'],['full-route','/products/generic-smartphone/supply-chain?view=all'],['guide','/trade-guide'],['catalog','/products']]) {
 await page.goto('http://127.0.0.1:3000'+path,{waitUntil:'networkidle'});
 await page.screenshot({path:resolve(folder,name+'.png'),fullPage:true});
 if(name==='full-route') await page.locator('.visual-graph-section').screenshot({path:resolve(folder,'graph-detail.png')});
 rows.push({name,...await page.evaluate(()=>({width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,countries:[...document.querySelectorAll('.map-country-shape')].slice(0,4).map(el=>({fill:getComputedStyle(el).fill,stroke:getComputedStyle(el).stroke,strokeWidth:getComputedStyle(el).strokeWidth,transition:getComputedStyle(el).transition})),map:document.querySelector('.map-viewport')?{border:getComputedStyle(document.querySelector('.map-viewport')).border,background:getComputedStyle(document.querySelector('.map-viewport')).backgroundColor}:null}))});
}
await writeFile(resolve(folder,'styles.json'),JSON.stringify(rows,null,2));await browser.close();console.log('Captured '+phase);
