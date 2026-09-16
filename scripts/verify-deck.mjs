import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
const browser=await chromium.launch(process.env.DECK_BROWSER_PATH?{executablePath:process.env.DECK_BROWSER_PATH}:{channel:"chrome",args:["--disable-gpu","--renderer-process-limit=1"]});
const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1,offline:true});
const page=await context.newPage();const external=[];const errors=[];page.on("pageerror",e=>errors.push(e.message));page.on("request",r=>{if(/^https?:/.test(r.url()))external.push(r.url())});
const out=resolve(".preview/review-fix");await mkdir(out,{recursive:true});
try {
 await page.goto(pathToFileURL(resolve("docs/submission/deck/index.html")).href);
 await page.evaluate(()=>document.fonts.ready);
 assert.equal(await page.locator(".slide").count(),10);
 const pages=[];
 for(let i=0;i<10;i++){
  assert.equal(await page.locator(".slide.active").getAttribute("aria-label"),await page.locator(".slide").nth(i).getAttribute("aria-label"));
  const result=await page.locator(".slide.active").evaluate(el=>({title:el.getAttribute("aria-label"),brokenImages:[...el.querySelectorAll("img")].filter(im=>!im.complete||!im.naturalWidth).length,overflow:[...el.querySelectorAll("h1,h2,p,li,.footer")].filter(child=>{const a=child.getBoundingClientRect(),b=el.getBoundingClientRect();return a.left<b.left-1||a.right>b.right+1||a.top<b.top-1||a.bottom>b.bottom+1}).map(el=>el.textContent)}));
  assert.equal(result.brokenImages,0); assert.deepEqual(result.overflow,[]);
  await page.screenshot({path:resolve(out,"slide-"+String(i+1).padStart(2,"0")+".png")});pages.push(result);
  if(i<9)await page.keyboard.press("ArrowRight");
 }
 await page.keyboard.press("ArrowLeft");assert.equal(await page.locator(".slide.active").getAttribute("aria-label"),pages[8].title);
 await page.keyboard.press("Home");assert.equal(await page.locator(".slide.active").getAttribute("aria-label"),pages[0].title);
 await page.pdf({path:resolve("docs/submission/deck/deck.pdf"),printBackground:true,preferCSSPageSize:true});
 await page.goto(pathToFileURL(resolve("docs/submission/deck/index.html")).href+"?print");assert.equal(await page.locator(".slide:visible").count(),10);
 await page.goto(pathToFileURL(resolve("docs/submission/one-page-intro.html")).href);await page.evaluate(()=>document.fonts.ready);
 await page.pdf({path:resolve("docs/submission/one-page-intro.pdf"),printBackground:true,preferCSSPageSize:true});
 await page.setViewportSize({width:794,height:1123});await page.screenshot({path:resolve(out,"one-page-intro.png"),fullPage:true});
 assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
 const result={checkedAt:new Date().toISOString(),slides:pages,offline:true,externalRequests:external.length,pageErrors:errors.length,keyboardNavigation:true,printView:true};
 await writeFile(resolve(out,"deck-validation.json"),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{await browser.close()}
