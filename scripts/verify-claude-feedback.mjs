import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const before = process.argv.includes('--before');
const phase = before ? 'before' : 'after';
const base = process.env.REVIEW_BASE_URL ?? 'http://127.0.0.1:3000';
const output = resolve('output/qa/2026-10-22-claude-feedback', phase);
await mkdir(output, {recursive:true});
const browser = await chromium.launch({channel:'chrome',args:['--disable-gpu']});
const page = await browser.newPage({viewport:{width:1440,height:900}});
const checks=[]; const errors=[];
page.on('pageerror',error=>errors.push(error.message));
const go = async path => {const response=await page.goto(base+path,{waitUntil:'networkidle'});return response.status();};
const shot = name => page.screenshot({path:resolve(output,name+'.png')});
try {
  await go('/map?product=generic-smartphone&layer=supply-chain');
  const initialSelected=await page.locator('.map-country-shape.selected').count();
  await shot('map-default-1440');
  checks.push({defaultSelectedCountries:initialSelected});
  if(!before){
    assert.equal(initialSelected,0,'No country should be selected by default');
    const background=page.locator('.map-country-shape:not(.has-data)').first();
    const originalFill=await background.evaluate(node=>getComputedStyle(node).fill);
    await page.getByRole('combobox',{name:'选择国家',exact:true}).selectOption('country-cn');
    await page.waitForURL(url=>url.searchParams.get('country')==='country-cn');
    await page.waitForLoadState('networkidle');
    assert.equal(await page.locator('.map-country-shape.selected').count(),1);
    assert.equal(await background.evaluate(node=>getComputedStyle(node).fill),originalFill);
    await page.getByRole('button',{name:'清除国家',exact:true}).click();
    await page.waitForURL(url=>!url.searchParams.has('country'));
    const unrecorded=page.locator('.map-country-shape:not(.has-data)').filter({has:page.locator('title',{hasText:/Brazil/})});
    await unrecorded.dispatchEvent('click');
    await page.getByRole('status').filter({hasText:'Brazil'}).waitFor();
    checks.push('Selected country is unique; background unchanged; unrecorded country feedback works');
    const invalidStatus=await go('/map?product=generic-smartphone&country=country-br&focus=battery&year=2023&layer=supply-chain');
    assert.equal(invalidStatus,200);
    assert.match(await page.getByRole('status').innerText(),/已显示全部国家/);
    assert.equal(await page.getByRole('combobox',{name:'选择部件或材料'}).inputValue(),'battery');
    assert.equal(await page.getByRole('combobox',{name:'选择记录年度'}).inputValue(),'2023');
    await page.getByRole('link',{name:'清除链接中的国家筛选'}).click();
    await page.waitForURL(url=>!url.searchParams.has('country'));
    checks.push('Invalid country recovers with component and year preserved');
  }
  await go('/map?product=generic-smartphone&layer=trade&year=2025&country=country-cn');
  const lineWidths=await page.locator('.atlas-line-visible').evaluateAll(nodes=>nodes.map(node=>({width:getComputedStyle(node).strokeWidth,arrow:node.getAttribute('marker-end')})));
  checks.push({tradeWidths:lineWidths});
  await shot('map-trade-1440');
  if(!before){
    assert.ok(lineWidths.length>0&&lineWidths.every(line=>line.arrow));
    await go('/map?product=generic-smartphone&layer=trade&focus=battery&scope=bilateral');
    const widths=await page.locator('.atlas-line-visible').evaluateAll(nodes=>nodes.map(node=>parseFloat(getComputedStyle(node).strokeWidth)));
    assert.ok(new Set(widths).size>1,'Different amount bands should have different widths');
    await go('/map?product=generic-smartphone&layer=trade&scope=world');
    assert.equal(await page.locator('.country-trade-line').count(),0);
    checks.push('Trade amount bands differ; all arrows stay visible; world totals have no bilateral line');
    await go('/search');
    await page.getByRole('textbox',{name:'关键词',exact:true}).fill('制冰');
    await page.getByRole('search',{name:'资料搜索'}).getByRole('button',{name:'搜索',exact:true}).click();
    await page.waitForURL(url=>url.searchParams.get('q')==='制冰');
    assert.ok(await page.getByRole('heading',{name:'上下游与官方入口',exact:true}).count());
    await shot('search-results-1440');
    await go('/industry');
    assert.ok(await page.locator('a[href*="/industry"]').count()>1);
    await page.locator('.product-grid a').first().click();
    await page.waitForURL(/\/products\/[^/]+\/industry/);
    await page.getByRole('heading',{name:'从一个环节，找到上下游',exact:true}).waitFor();
    checks.push('Page search reaches industry results; global industry directory opens a real product network');
  }
  await go('/categories'); await shot('categories-1440');
  if(!before) assert.doesNotMatch(await page.locator('body').innerText(),/现在平台先深度拆解智能手机/);
  const context = await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const mobile=await context.newPage();
  mobile.on('pageerror',error=>errors.push(error.message));
  await mobile.goto(base+'/map?product=generic-smartphone&layer=supply-chain',{waitUntil:'networkidle'});
  await mobile.screenshot({path:resolve(output,'map-390.png')});
  if(!before){
    assert.equal(await mobile.locator('.atlas-country-labels text').count(),0);
    await mobile.getByRole('combobox',{name:'选择国家',exact:true}).selectOption('country-cn');
    await mobile.waitForURL(url=>url.searchParams.get('country')==='country-cn');
    await mobile.waitForLoadState('networkidle');
    const label=mobile.locator('.atlas-country-labels text').filter({hasText:'中国'}).first();
    const size=await label.boundingBox();
    assert.ok(size&&size.height>=10,'Selected country label must be readable on mobile');
    assert.match(await mobile.locator('.map-viewport').evaluate(node=>getComputedStyle(node).touchAction),/pan-y/);
    await mobile.locator('.nav-group > summary').filter({hasText:'数据与指南'}).click();
    await mobile.getByRole('navigation',{name:'主导航'}).getByRole('link',{name:/数据版本/}).waitFor({state:'visible'});
    assert.ok(await mobile.getByRole('navigation',{name:'主导航'}).getByRole('link',{name:/数据版本/}).boundingBox());
    await mobile.screenshot({path:resolve(output,'mobile-navigation.png')});
    const dimensions=await mobile.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
    assert.ok(dimensions.scroll<=dimensions.client+1);
    checks.push({mobileReadableCountry:true,touchAction:'pan-y',navigationAvailable:true,dimensions});
    const cdp=await context.newCDPSession(mobile);
    await mobile.locator('.nav-group > summary').filter({hasText:'数据与指南'}).click();
    await mobile.locator('.world-country-map').scrollIntoViewIfNeeded();
    const box=await mobile.locator('.world-country-map').boundingBox();
    const scrollBefore=await mobile.evaluate(()=>scrollY);
    const touchX=Math.round(box.x+box.width/2); const touchY=Math.round(box.y+box.height*.8);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:touchX,y:touchY}]});
    for(let step=1;step<=6;step++){
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:touchX,y:touchY-step*20}]});
      await mobile.waitForTimeout(30);
    }
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await mobile.waitForTimeout(350);
    const scrollAfter=await mobile.evaluate(()=>scrollY);
    assert.ok(scrollAfter>scrollBefore,'A vertical swipe over the map should scroll the page');
    checks.push({touchScrollBefore:scrollBefore,touchScrollAfter:scrollAfter});
  }
  await context.close();
  if(!before){
    await go('/products');
    const products=[...new Set(await page.locator('a[href^="/products/"]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('href')).filter(href=>/^\/products\/[^/?]+$/.test(href))))];
    assert.equal(products.length,5);
    for(const product of products){
      for(const path of [product,product+'/supply-chain','/map?product='+product.split('/').pop(),product+'/provenance']) assert.equal(await go(path),200,path);
      const exported=await page.request.get(base+'/api/products/'+product.split('/').pop()+'/research-export');
      assert.equal(exported.status(),200);
    }
    checks.push({fiveProductPaths:products,productRouteMapSourceAndExport:true});
    await page.setViewportSize({width:1024,height:900});
    await go('/industry');
    const tablet=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
    assert.ok(tablet.scroll<=tablet.client+1,'Tablet header should not cause horizontal overflow');
    await shot('industry-1024');
    checks.push({tablet});
  }
  assert.deepEqual(errors,[]);
} finally {
  await writeFile(resolve(output,'results.json'),JSON.stringify({checkedAt:new Date().toISOString(),phase,checks,pageErrors:errors},null,2));
  await browser.close();
}
console.log(JSON.stringify(checks));
