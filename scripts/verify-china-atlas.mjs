import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const base=process.env.REVIEW_BASE_URL??'http://127.0.0.1:3000';
const output=resolve('output/qa/2026-10-23-china-atlas');await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--disable-gpu']});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];const checks=[];
page.on('pageerror',error=>errors.push(error.message));
const go=async path=>{const response=await page.goto(base+path,{waitUntil:'networkidle'});assert.equal(response.status(),200,path);};
const screenshot=name=>page.screenshot({path:resolve(output,name+'.png'),fullPage:true});
try {
  await go('/');
  const heroCta=page.getByRole('link',{name:'从世界地图开始 →'});
  if(await heroCta.count()===0){
    // Static competition shell renders the map directly; its nav carries the world-map entry.
    await page.locator('a[href^="/map"]').first().waitFor();
  }else{
    await heroCta.waitFor();
  }
  await screenshot('home-desktop');
  const manifest=JSON.parse(await readFile('data/published/manifest.json','utf8'));
  const atlas=JSON.parse(await readFile('content/geography/china-supply-atlas-2026-10-23.json','utf8'));
  const covered=new Set(atlas.nodes.map(node=>node.productId));
  const cottonNodes=atlas.nodes.filter(node=>node.productId==='generic-cotton-tshirt');
  const cottonZJNodes=cottonNodes.filter(node=>atlas.places.find(place=>place.id===node.placeId)?.provinceCode==='330000').length;
  const ebikeNodes=atlas.nodes.filter(node=>node.productId==='generic-electric-bicycle').length;
  for(const {productId} of manifest.fixtures){
    await go('/map/china?product='+productId);
    assert.equal(await page.locator('.china-province[role=button]').count(),34);
    if(covered.has(productId)){
      assert.ok(await page.locator('.regional-node').count()>=2,productId);
      assert.equal(await page.locator('.regional-node-list button').count(),await page.locator('.regional-node').count());
    }else{
      // No recorded regional entity: explicit empty state, empty marker layer.
      assert.equal(await page.locator('.regional-node').count(),0,productId);
      assert.equal(await page.locator('.regional-connection').count(),0,productId);
      assert.ok(await page.locator('.regional-empty[role="status"]').count()>0,productId);
      assert.equal(await page.locator('.regional-node-list button').count(),0);
    }
    await screenshot('china-'+productId);
    checks.push({productId,regionalNodes:await page.locator('.regional-node').count(),connections:await page.locator('.regional-connection').count()});
  }
  await go('/map?product=generic-home-air-conditioner');
  const filterToggle=page.locator('.atlas-filters-toggle');
  if(await filterToggle.count()&&await filterToggle.getAttribute('aria-expanded')==='false'){await filterToggle.click();await page.locator('#atlas-filters-body:visible').waitFor({timeout:3000});}
  await page.getByRole('combobox',{name:'选择国家',exact:true}).selectOption('country-cn');
  await page.getByRole('link',{name:'进入中国供应链 →',exact:true}).click();
  await page.waitForURL(/\/map\/china\?/);
  assert.equal(await page.getByRole('combobox',{name:'中国地图商品'}).inputValue(),'generic-home-air-conditioner');
  await page.getByRole('button',{name:'查看宁波的铜管与换热材料',exact:true}).click();
  await page.getByRole('heading',{name:'铜管与换热材料',exact:true}).waitFor();
  assert.ok((await page.locator('.regional-organization').innerText()).includes('金田'));
  await screenshot('china-ac-selected');
  await page.getByRole('link',{name:'查看企业能力与上下游 →',exact:true}).click();
  await page.waitForURL(/\/industry\?/);
  await page.locator('.industry-focus').waitFor({timeout:8000});
  assert.ok((await page.locator('body').innerText()).includes('铜管'));
  checks.push('World China selection -> domestic map -> regional role -> enterprise/topic');
  await go('/map/china?product=generic-cotton-tshirt');
  await page.getByRole('combobox',{name:'中国地图省份'}).selectOption('330000');
  assert.equal(await page.locator('.regional-node-list button').count(),cottonZJNodes);
  await page.getByRole('button',{name:'查看绍兴·柯桥的纺织面料与染整',exact:true}).click();
  await page.getByRole('heading',{name:'纺织面料与染整',exact:true}).waitFor();
  await page.goBack();await page.getByRole('button',{name:'查看绍兴·柯桥的纺织面料与染整',exact:true}).waitFor();
  await page.getByRole('combobox',{name:'中国地图省份'}).selectOption('110000');
  await page.getByRole('status').filter({hasText:'这个区域的资料还在补充'}).waitFor();
  await page.getByRole('button',{name:'返回全国全部环节',exact:true}).click();
  assert.equal(await page.locator('.regional-node-list button').count(),cottonNodes.length);
  const before=await page.locator('.china-supply-map > g').first().getAttribute('transform');
  await page.getByRole('button',{name:'放大中国地图',exact:true}).click();
  assert.notEqual(await page.locator('.china-supply-map > g').first().getAttribute('transform'),before);
  await page.getByRole('button',{name:'复位',exact:true}).click();
  await page.locator('.china-supply-map').hover();
  await page.keyboard.down('Control');await page.mouse.wheel(0,-180);await page.keyboard.up('Control');
  await page.waitForTimeout(150);
  assert.notEqual(await page.locator('.china-supply-map > g').first().getAttribute('transform'),before);
  checks.push('Province filters, empty feedback, browser back, reset and Ctrl+wheel zoom');
  await go('/products/generic-smartphone/materials');
  assert.equal(await page.locator('.material-filter-group').count(),4);
  await page.getByRole('link',{name:'进口',exact:true}).click();
  await page.waitForURL(url=>url.searchParams.get('flow')==='import');await page.waitForLoadState('networkidle');
  assert.equal(await page.getByRole('link',{name:'进口',exact:true}).getAttribute('aria-current'),'page');
  await screenshot('materials-desktop');
  await go('/products/generic-smartphone/supply-chain');
  const focused=await page.locator('.graph-node').count();
  await page.getByRole('link',{name:'展开全部分支 →',exact:true}).click();
  await page.waitForURL(url=>url.searchParams.get('view')==='all');await page.waitForLoadState('networkidle');
  assert.ok(await page.locator('.graph-node').count()>focused);
  await screenshot('route-all-desktop');
  checks.push({defaultFocusedNodes:focused,allRouteNodes:await page.locator('.graph-node').count()});
  for(const width of [1024,390]){
    await page.setViewportSize({width,height:900});await go('/map/china?product=generic-cotton-tshirt');
    const menuSummary=width<=640?page.locator('.nav-group--menu > summary'):null;
    if(menuSummary){await menuSummary.click();}else{await page.locator('.nav-group--groups > summary').filter({hasText:'地图探索'}).click();}
    await page.getByRole('navigation',{name:'主导航'}).getByRole('link',{name:/中国供应链/}).waitFor({state:'visible'});
    await page.keyboard.press('Escape');assert.equal(await page.locator('.nav-group[open]').count(),0);
    if(menuSummary){await menuSummary.click();}else{await page.locator('.nav-group--groups > summary').filter({hasText:'数据与指南'}).click();}
    await page.getByRole('navigation',{name:'主导航'}).getByRole('link',{name:/数据版本/}).waitFor({state:'visible'});
    const dimensions=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
    assert.ok(dimensions.scroll<=dimensions.client+1,JSON.stringify(dimensions));
    await screenshot('china-menu-'+width);await page.keyboard.press('Escape');
    await page.getByRole('combobox',{name:'中国地图商品'}).selectOption('generic-electric-bicycle');
    await page.waitForURL(/product=generic-electric-bicycle/);assert.equal(await page.locator('.regional-node').count(),ebikeNodes);
    await screenshot('china-'+width);checks.push({width,dimensions,menu:'all links accessible'});
  }
  await page.setViewportSize({width:1440,height:1000});
  assert.deepEqual(errors,[]);
  await writeFile(resolve(output,'results.json'),JSON.stringify({checks,errors},null,2));
  console.log(JSON.stringify({checks,errors},null,2));
} catch(error) {await screenshot('failure');await writeFile(resolve(output,'failure.json'),JSON.stringify({checks,errors,error:String(error)},null,2));throw error;} finally {await browser.close();}
