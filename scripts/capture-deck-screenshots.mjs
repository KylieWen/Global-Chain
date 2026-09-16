import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { createHash } from "node:crypto";
const base = process.env.DECK_BASE_URL ?? "http://localhost:3000";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname)) throw Error("Use a local published server");
const manifestPath = resolve("data/published/active-manifest.json");
const manifest = JSON.parse(await readFile(manifestPath,"utf8"));
const fixture = JSON.parse(await readFile(resolve(dirname(manifestPath),manifest.fixtures[0].path),"utf8"));
if(fixture.datasetVersion.status !== "published") throw Error("Only published screenshots are allowed");
const product = fixture.productId;
const out = resolve("docs/submission/deck/assets");
await mkdir(out,{recursive:true});
const browser = await chromium.launch(process.env.DECK_BROWSER_PATH ? {executablePath:process.env.DECK_BROWSER_PATH} : {channel:"chrome",args:["--disable-gpu","--renderer-process-limit=1"]});
const context = await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:2});
const page = await context.newPage();
const errors=[]; page.on("pageerror",error=>errors.push(error.message));
const records=[];
async function visit(url){ const response=await page.goto(base+url,{waitUntil:"networkidle"}); if(!response?.ok())throw Error(url+" failed"); await page.evaluate(()=>document.fonts.ready); await page.addStyleTag({content:".site-header{position:static!important}"}); if(await page.locator(".preview-banner").count())throw Error("Draft page"); }
async function capture(name,selector,url){ const target=selector?page.locator(selector).first():page; await target.screenshot({path:resolve(out,name),animations:"disabled",...(["country-ledger.png","trade-guide.png"].includes(name)?{clip:{x:320,y:0,width:1280,height:1000}}:{})});records.push({file:name,url,selector:selector??"viewport",...(["country-ledger.png","trade-guide.png"].includes(name)?{clip:{x:320,y:0,width:1280,height:1000}}:{}),sha256:createHash("sha256").update(await readFile(resolve(out,name))).digest("hex")}); }
try {
  await visit("/"); await capture("home.png",null,"/");
  const map="/map?product="+encodeURIComponent(product);
  await visit(map); await page.waitForFunction(()=>document.querySelectorAll(".map-country-shape").length>100 && document.querySelectorAll(".country-trade-line").length>0);
  if(await page.locator(".map-country-shape.selected").count()!==0)throw Error("Unselected map highlights countries");
  await capture("map-hero.png",".map-viewport",map);
  const country=page.locator(".map-country-shape.has-data").first(); await country.click(); await page.waitForURL(url=>url.searchParams.has("country")); await page.waitForLoadState("networkidle");
  await page.locator(".map-country-shape.selected").waitFor(); if(await page.locator(".map-country-shape.selected").count()!==1)throw Error("Country selection is ambiguous");
  await capture("map-interaction.png",".country-map-workspace",page.url().replace(base,""));
  const overview="/products/"+encodeURIComponent(product); await visit(overview);
  await capture("breakdown-tree.png",'[aria-labelledby="breakdown-title"]',overview);
  const route=await page.locator(".product-focus-meta a").first().getAttribute("href"); if(!route)throw Error("No published component route");
  await visit(route); await capture("supply-chain-route.png",".route-graph-shell",route);
  // Select a ledger with published macro and product observations, from the current fixture.
  const entity=fixture.entities.find(e=>fixture.macroIndicators.some(o=>o.entityId===e.id || o.countryEntityId===e.id) && fixture.tradeObservations.some(o=>o.reporterEntityId===e.id));
  if(!entity)throw Error("No ledger candidate");
  const ledger=overview+"/ledger/"+encodeURIComponent(entity.id); await visit(ledger);
  await page.locator('details[aria-labelledby="trade-title"] > summary').click();
  // Hide unrelated surrounding sections for a readable, authentic combined crop; never alter facts.
  await page.addStyleTag({content:'.site-header,.site-footer,.breadcrumbs,.context-banner,.page-intro,.exploration-nav,.content-column>.stat-grid,.warning-panel,details:not([aria-labelledby="trade-title"]),.status-legend {display:none!important} .content-column {max-width:1280px!important} .content-column>.section-block:not([aria-labelledby="trade-title"]){display:none!important}'});
  await page.evaluate(()=>window.scrollTo(0,0)); await capture("country-ledger.png",null,ledger);
  const guide="/trade-guide?product="+encodeURIComponent(product)+"&jurisdiction="+fixture.tradeGuides[0].scope.jurisdictionEntityId+"&direction="+fixture.tradeGuides[0].scope.direction;
  await visit(guide); await page.addStyleTag({content:".site-header,.breadcrumbs,.context-banner,.page-intro,.trade-guide-workbench,.trade-guide-intro-grid,.trade-guide-results-heading{display:none!important}"}); await page.evaluate(()=>window.scrollTo(0,0)); await capture("trade-guide.png",null,guide);
  if(errors.length)throw Error(errors.join("\n"));
  await writeFile(resolve(out,"capture-manifest.json"),JSON.stringify({capturedAt:new Date().toISOString(),datasetVersion:fixture.datasetVersion.version,fixtureSha256:manifest.fixtureSha256,viewport:{width:1920,height:1080,deviceScaleFactor:2},mapZoom:1,records},null,2));
  console.log(JSON.stringify(records,null,2));
} finally {await browser.close();}
