import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const builtSite = new URL("../tmp/qoder-competition-web/", import.meta.url);
const localOrigin = "http://competition-china.test";
const site = process.env.CHINA_TEST_BASE_URL ?? localOrigin;
const output = resolve(process.env.CHINA_TEST_OUTPUT_DIR ?? "tmp/competition-china-qa");
const product = "generic-home-air-conditioner";
const worldFilters = {
  product,
  layer: "trade",
  items: product,
  year: "2024",
  currency: "USD",
  scope: "bilateral",
  country: "country-cn",
  direction: "export",
  measure: "quantity"
};
const chinaFilters = { province: "330000", stage: "material", node: "ac-nb" };
const soybeanOil = "generic-soybean-oil";
const soybeanFilters = {
  ...worldFilters,
  product: soybeanOil,
  items: `${soybeanOil},soybean,crude-soybean-oil`,
  direction: "import"
};
const detailHeading = "铜管与换热材料";
const appUrl = (path, query) => new URL(`${path}?${new URLSearchParams(query)}`, site).href;

const select = (page, name) => page.getByRole("combobox", { name, exact: true });
const chinaMap = page => page.getByRole("group", { name: "可交互中国省级供应链地图" });
const details = page => page.getByRole("complementary", { name: "中国产业环节详情" });
const regionalRows = page => details(page).locator(".regional-node-list button");
const activate = (target, touch) => touch ? target.tap() : target.click();

async function selectValue(page, name, value) {
  await page.waitForFunction(({ name, value }) =>
    document.querySelector(`select[aria-label="${name}"]`)?.value === value, { name, value });
}

async function assertWorld(page, scenario) {
  await page.locator(".world-country-map").waitFor();
  const url = new URL(page.url());
  assert.equal(url.pathname, "/map");
  assert.deepEqual(Object.fromEntries(url.searchParams), scenario);
  await selectValue(page, "选择商品", scenario.product);
  await selectValue(page, "选择记录年度", scenario.year);
  await selectValue(page, "选择国家", scenario.country);
  await selectValue(page, "报告方向", scenario.direction);
  assert.equal(await select(page, "箭头粗细").inputValue(), scenario.measure);
  assert.deepEqual(await page.locator(".atlas-item-picker input:checked").evaluateAll(inputs => inputs.map(input => input.value)), scenario.items.split(","));
  await page.locator(".atlas-line-visible").first().waitFor();
}

async function assertChinaDetail(page) {
  await chinaMap(page).waitFor();
  const url = new URL(page.url());
  assert.equal(url.pathname, "/map/china");
  assert.equal(url.searchParams.get("product"), product);
  for (const [key, value] of Object.entries(chinaFilters)) {
    assert.equal(url.searchParams.get(key), value, `China map ${key}`);
  }
  assert.deepEqual(Object.fromEntries(new URLSearchParams(url.searchParams.get("map"))), worldFilters);
  await selectValue(page, "中国地图商品", product);
  await selectValue(page, "中国地图省份", chinaFilters.province);
  await selectValue(page, "中国地图生产环节", chinaFilters.stage);
  await details(page).getByRole("heading", { name: detailHeading, exact: true }).waitFor();
  assert.equal(await chinaMap(page).getByRole("button", { name: /^宁波 · 铜管与换热材料$/ }).getAttribute("aria-pressed"), "true");
}

async function hitMapShape(page, target, touch) {
  await target.scrollIntoViewIfNeeded();
  // Irregular SVG regions may have their bounding-box center outside the painted shape.
  const point = await target.evaluate(shape => {
    const rect = shape.getBoundingClientRect();
    const offsets = [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8];
    for (const dy of offsets) {
      for (const dx of offsets) {
        const x = Math.round(rect.left + dx * rect.width);
        const y = Math.round(rect.top + dy * rect.height);
        if (shape.contains(document.elementFromPoint(x, y))) return { x, y };
      }
    }
    for (let y = Math.ceil(rect.top); y < rect.bottom; y++) {
      for (let x = Math.ceil(rect.left); x < rect.right; x++) {
        if (shape.contains(document.elementFromPoint(x, y))) return { x, y };
      }
    }
    return null;
  });
  assert.ok(point, `An exposed map region is available for ${await target.getAttribute("aria-label")}`);
  if (touch) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
}

async function checkWidth(page, step) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth
  }));
  assert.ok(dimensions.content <= dimensions.viewport, `${step} overflows: ${JSON.stringify(dimensions)}`);
  return dimensions;
}

async function verifyLayout(context, layout, touch, errors) {
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(`${layout}: ${error.message}`));
  const initialFilters = { ...worldFilters };
  delete initialFilters.country;
  delete initialFilters.direction;
  delete initialFilters.measure;
  const response = await page.goto(appUrl("/map", initialFilters));
  assert.equal(response.status(), 200);
  await select(page, "选择国家").selectOption(worldFilters.country);
  await page.waitForURL(url => url.searchParams.get("country") === worldFilters.country);
  await select(page, "报告方向").selectOption(worldFilters.direction);
  await page.waitForURL(url => url.searchParams.get("direction") === worldFilters.direction);
  await select(page, "箭头粗细").selectOption(worldFilters.measure);
  await page.waitForURL(url => url.searchParams.get("measure") === worldFilters.measure);
  await assertWorld(page, worldFilters);
  const worldUrl = page.url();

  await activate(page.getByRole("link", { name: /^进入中国供应链/ }), touch);
  await chinaMap(page).waitFor();
  await selectValue(page, "中国地图商品", product);
  assert.equal(await chinaMap(page).locator(".china-province[role=button]").count(), 34);
  assert.ok(await chinaMap(page).locator(".regional-connection").count() > 0);
  const allCount = await regionalRows(page).count();
  assert.ok(allCount > 2);
  await checkWidth(page, `${layout} China map`);
  await page.screenshot({ path: resolve(output, `${layout}-map.png`), fullPage: true });

  await select(page, "中国地图生产环节").selectOption(chinaFilters.stage);
  await page.waitForURL(url => url.searchParams.get("stage") === chinaFilters.stage);
  await details(page).getByRole("button", { name: /查看宁波的铜管与换热材料/ }).waitFor();
  const stageCount = await regionalRows(page).count();
  assert.ok(stageCount > 1 && stageCount < allCount);

  const zhejiang = chinaMap(page).getByRole("button", { name: /^浙江省? · 有已收录产业环节$/ });
  if (touch) {
    const zoom = page.getByRole("button", { name: "放大中国地图", exact: true });
    await zoom.tap();
    await zoom.tap();
  }
  await hitMapShape(page, zhejiang, touch);
  await selectValue(page, "中国地图省份", chinaFilters.province);
  assert.equal(await zhejiang.getAttribute("aria-pressed"), "true");
  assert.deepEqual(await regionalRows(page).evaluateAll(rows => rows.map(row => row.getAttribute("aria-label"))), ["查看宁波的铜管与换热材料"]);
  const filteredUrl = page.url();

  await hitMapShape(page, chinaMap(page).getByRole("button", { name: /^宁波 · 铜管与换热材料$/ }), touch);
  await assertChinaDetail(page);
  const sharedUrl = page.url();
  await activate(details(page).locator("summary").filter({ hasText: "依据与适用范围" }), touch);
  const source = details(page).locator(".regional-sources a").first();
  await source.waitFor();
  assert.match(await source.getAttribute("href"), /^https?:\/\//);
  const dimensions = await checkWidth(page, `${layout} China detail`);
  await page.screenshot({ path: resolve(output, `${layout}-detail.png`), fullPage: true });

  await page.goBack();
  assert.equal(page.url(), filteredUrl);
  await regionalRows(page).first().waitFor();
  await page.goForward();
  await assertChinaDetail(page);
  await page.reload();
  await assertChinaDetail(page);

  const shared = await context.newPage();
  shared.on("pageerror", error => errors.push(`${layout} shared: ${error.message}`));
  try {
    const response = await shared.goto(sharedUrl);
    assert.equal(response.status(), 200);
    await assertChinaDetail(shared);
    await activate(details(shared).getByRole("link", { name: /查看企业能力与上下游/ }), touch);
    await shared.waitForURL(url => url.pathname === `/products/${product}/industry` && url.searchParams.get("topic") === "copper-tube");
    await shared.locator(".industry-selected").getByRole("heading", { name: /铜管/ }).waitFor();
    await shared.locator(".industry-relevant").getByRole("heading", { name: /宁波金田铜管/ }).waitFor();
    await checkWidth(shared, `${layout} industry detail`);
    await shared.reload();
    await activate(shared.getByRole("link", { name: /返回中国供应链/ }), touch);
    await assertChinaDetail(shared);
    assert.equal(shared.url(), sharedUrl);
    await activate(shared.getByRole("link", { name: /返回世界地图/ }), touch);
    await assertWorld(shared, worldFilters);
    assert.equal(shared.url(), worldUrl);
  } finally {
    await shared.close();
  }

  await activate(details(page).getByRole("button", { name: /返回区域列表/ }), touch);
  await regionalRows(page).first().waitFor();
  assert.equal(page.url(), filteredUrl);
  await activate(page.getByRole("link", { name: /返回世界地图/ }), touch);
  await assertWorld(page, worldFilters);
  assert.equal(page.url(), worldUrl);
  await checkWidth(page, `${layout} restored world map`);

  await page.goto(appUrl("/map", soybeanFilters));
  await assertWorld(page, soybeanFilters);
  const productNav = page.getByRole("navigation", { name: "当前商品探索" });
  await activate(productNav.getByRole("link", { name: "中国供应链", exact: true }), touch);
  await chinaMap(page).waitFor();
  await selectValue(page, "中国地图商品", soybeanOil);
  await select(page, "中国地图商品").selectOption(product);
  await selectValue(page, "中国地图商品", product);
  await activate(page.getByRole("link", { name: /返回世界地图/ }), touch);
  await assertWorld(page, soybeanFilters);
  return { layout, touch, allCount, stageCount, dimensions, worldUrl, sharedUrl, restoredItems: soybeanFilters.items.split(",") };
}

await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const errors = [];
const checks = [];
try {
  for (const [layout, viewport, touch] of [
    ["desktop", { width: 1440, height: 900 }, false],
    ["mobile", { width: 390, height: 844 }, true]
  ]) {
    const context = await browser.newContext({ viewport, isMobile: touch, hasTouch: touch });
    context.setDefaultTimeout(10_000);
    try {
      if (site === localOrigin) {
        await context.route(`${localOrigin}/**`, route => {
          const pathname = new URL(route.request().url()).pathname;
          const asset = /\.(css|js|json)$/.test(pathname) ? pathname.slice(1) : "index.html";
          return route.fulfill({ path: fileURLToPath(new URL(asset, builtSite)) });
        });
      }
      const result = await verifyLayout(context, layout, touch, errors);
      checks.push(result);
      console.log(`${layout}: China entry, stage filter, province and city ${touch ? "tap" : "click"}, linked industry detail, sharing, history and world filters passed`);
    } catch (error) {
      const activePage = context.pages()[0];
      await activePage?.screenshot({ path: resolve(output, `${layout}-failure.png`), fullPage: true }).catch(() => {});
      throw error;
    } finally {
      await context.close();
    }
  }
  assert.deepEqual(errors, []);
  await writeFile(resolve(output, "result.json"), JSON.stringify({ site, checks, errors }, null, 2));
} finally {
  await browser.close();
}
