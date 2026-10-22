import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const folder=resolve('output/qa/2026-10-23-claude-completion');await mkdir(folder,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--disable-gpu']});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];const checks=[];page.on('pageerror',error=>errors.push(error.message));
const go=async path=>{const response=await page.goto('http://127.0.0.1:3000'+path,{waitUntil:'networkidle'});assert.equal(response.status(),200);};
const transform=locator=>locator.evaluate(svg=>{const g=[...svg.children].find(el=>el.tagName.toLowerCase()==='g'&&el.hasAttribute('transform'));const m=g.transform.baseVal.consolidate().matrix;return {x:m.e,y:m.f,scale:m.a,ratio:svg.getScreenCTM().a};});
try {
 await go('/products');
 const names=['智能手机','棉质T恤','大豆食用油','电动自行车','家用空调'];
 assert.deepEqual(await page.locator('.product-card h3').allTextContents(),names);
 await go('/versions');assert.deepEqual(await page.locator('.filter-chip').allTextContents(),names);
 checks.push('five canonical product labels agree across catalog and version navigation');
 await go('/map?product=generic-smartphone');
 // Choose an actual filled point, avoiding country bounding boxes and overlaid flow hit areas.
 const hit=await page.locator('.map-country-shape:not(.has-data)').evaluateAll(paths=>{
  for(const el of paths){const b=el.getBBox(),m=el.getScreenCTM();if(b.width<15||b.height<15)continue;
   for(let x=b.x+3;x<b.x+b.width-3;x+=5)for(let y=b.y+3;y<b.y+b.height-3;y+=5){const p=new DOMPoint(x,y);if(!el.isPointInFill(p))continue;const s=p.matrixTransform(m);if(document.elementFromPoint(s.x,s.y)===el)return {x:s.x,y:s.y,label:el.getAttribute('aria-label')};}
  }return null;
 });assert.ok(hit);
 await page.mouse.click(hit.x,hit.y);
 const unknown=page.locator('.map-country-shape[aria-pressed=true]');assert.equal(await unknown.count(),1);assert.equal(await unknown.getAttribute('aria-label'),hit.label);
 assert.equal(await unknown.evaluate(el=>getComputedStyle(el).outlineStyle),'none');
 await page.screenshot({path:resolve(folder,'unknown-country-selected.png')});checks.push('unrecorded country uses its contour and has no rectangular outline');
 await page.getByRole('button',{name:'返回已有记录',exact:true}).click();
 await page.getByRole('button',{name:'放大地图',exact:true}).click();
 const svg=page.locator('.world-country-map');const before=await transform(svg);const bounds=await svg.boundingBox();const url=page.url();
 await page.mouse.move(bounds.x+bounds.width*.5,bounds.y+bounds.height*.5);await page.mouse.down();await page.mouse.move(bounds.x+bounds.width*.5+38,bounds.y+bounds.height*.5+24,{steps:8});await page.mouse.up();
 const after=await transform(svg);assert.ok(Math.abs(after.x-before.x-38/before.ratio)<1);assert.ok(Math.abs(after.y-before.y-24/before.ratio)<1);assert.equal(page.url(),url);assert.equal(await page.locator('.atlas-record-details').count(),0);checks.push({dragScreenDelta:[38,24],mapDelta:[after.x-before.x,after.y-before.y],ratio:before.ratio});
 await go('/trade-guide');const hint=page.locator('.action-hint').first();const link=hint.getByRole('link');
 await page.mouse.move(0,0);assert.equal(await page.getByRole('tooltip').count(),0);await link.hover();await page.waitForTimeout(180);assert.equal(await page.getByRole('tooltip').count(),0);await page.getByRole('tooltip').waitFor();const text=await page.getByRole('tooltip').innerText();assert.ok(text.length>10);await page.keyboard.press('Escape');await page.getByRole('tooltip').waitFor({state:'detached'});await page.mouse.move(0,0);
 await hint.locator('button').click();await page.getByRole('tooltip').waitFor();await page.screenshot({path:resolve(folder,'guide-delayed-explanation.png'),fullPage:true});checks.push({delayedHint:text});
 await go('/products/generic-smartphone/supply-chain?view=all');assert.equal(await page.locator('.graph-node').count(),45);const graph=await page.locator('.route-graph').evaluate(el=>({width:el.viewBox.baseVal.width,height:el.viewBox.baseVal.height}));assert.ok(graph.height<900);await page.locator('.graph-node').first().click();assert.ok(await page.locator('.graph-edge-group.selected').count()>0);assert.ok(await page.locator('.graph-node.muted').count()>0);await page.screenshot({path:resolve(folder,'route-full-selected.png'),fullPage:true});checks.push({fullGraph:graph,nodes:45});
 await page.locator('.graph-filter-options button').nth(1).click();assert.equal(await page.locator('.graph-node.muted').count(),0);assert.equal(await page.locator('.graph-selection').count(),0);checks.push('stage change clears the previous graph selection');
 const steps=page.locator('.step-card-collapsible');assert.ok(await steps.count()>1);const closedHeight=await steps.nth(1).evaluate(el=>el.getBoundingClientRect().height);assert.ok(closedHeight<160);await steps.first().getByRole('link',{name:'下一步 →',exact:true}).click();assert.equal(await steps.nth(1).getAttribute('open'),'');checks.push({closedStepHeight:closedHeight,nextStepOpens:true});
const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});const touch=await mobile.newPage();touch.on('pageerror',error=>errors.push(error.message));const cdp=await mobile.newCDPSession(touch);
 for(const [path,selector] of [['/map?product=generic-smartphone','.world-country-map'],['/map/china?product=generic-home-air-conditioner','.china-supply-map']]) {
  await touch.goto('http://127.0.0.1:3000'+path,{waitUntil:'networkidle'});const target=touch.locator(selector);await target.scrollIntoViewIfNeeded();const rect=await target.boundingBox();const cx=rect.x+rect.width/2,cy=rect.y+rect.height/2;const points=distance=>[{x:cx-distance,y:cy,id:1},{x:cx+distance,y:cy,id:2}];
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points(28)});for(let i=1;i<=10;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points(28+i*4)});await touch.waitForTimeout(20);}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const zoom=await transform(target);assert.ok(zoom.scale>1.7,selector+' pinch');assert.equal(await touch.evaluate(()=>window.visualViewport.scale),1);assert.equal(await touch.locator('.map-country-shape[aria-pressed=true],.regional-node[aria-pressed=true]').count(),0);
  const startY=await touch.evaluate(()=>scrollY);const r=await target.boundingBox();const x=r.x+r.width/2,y=r.y+r.height*.75;await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});for(let i=1;i<=8;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-i*12,id:1}]});await touch.waitForTimeout(20);}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await touch.waitForTimeout(250);const endY=await touch.evaluate(()=>scrollY);assert.ok(endY>startY+20,selector+' one-finger scroll');
  const width=await touch.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));assert.ok(width.scroll<=width.client);checks.push({path,pinchScale:zoom.scale,browserScale:1,oneFingerScroll:[startY,endY],width});await touch.screenshot({path:resolve(folder,selector.includes('world')?'world-touch.png':'china-touch.png'),fullPage:true});
 }
 await mobile.close();assert.deepEqual(errors,[]);
 await writeFile(resolve(folder,'checks.json'),JSON.stringify({checks,pageErrors:errors},null,2));console.log(JSON.stringify({checks,pageErrors:errors}));
} finally {await browser.close();}
