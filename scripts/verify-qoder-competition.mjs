import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.REVIEW_BASE_URL ?? "https://globechain-lwf8uwcgl59.qoder.zone";
const output = process.env.REVIEW_OUTPUT_DIR ?? "output/qa/qoder-competition-public";
const manifest = JSON.parse(await readFile("data/published/manifest.json", "utf8"));
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const errors = [];
const products = [];
try {
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await desktop.newPage();
  page.on("pageerror", error => errors.push(error.message));
  const snapshots = await desktop.request.get(new URL("/fixtures.json", base).href);
  assert.equal(snapshots.status(), 200);
  const published = await snapshots.json();
  assert.deepEqual(published.map(fixture => [fixture.productId, fixture.datasetVersion.version]),
    manifest.fixtures.map(fixture => [fixture.productId, fixture.datasetVersion]));
  for (const [index, fixture] of manifest.fixtures.entries()) {
    assert.deepEqual(published[index], JSON.parse(await readFile("data/published/" + fixture.path, "utf8")));
  }

  for (const { productId } of manifest.fixtures) {
    const response = await page.goto(new URL("/map?product=" + productId, base).href);
    assert.equal(response.status(), 200);
    await page.locator(".world-country-map").waitFor();
    assert.equal(await page.getByRole("combobox", { name: "选择商品" }).inputValue(), productId);
    await page.getByRole("link", { name: "商品拆解", exact: true }).click();
    await page.getByRole("heading", { name: "商品拆解" }).waitFor();
    await page.getByRole("link", { name: "资料来源", exact: true }).click();
    await page.reload();
    await page.getByRole("heading", { name: "资料来源" }).waitFor();
    products.push(productId);
  }

  const demo = new URL("/map?product=generic-soybean-oil&items=generic-soybean-oil%2Csoybean%2Ccrude-soybean-oil&year=2024", base).href;
  const layouts = [];
  for (const [name, context] of [
    ["desktop", desktop],
    ["mobile", await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })]
  ]) {
    const demoPage = await context.newPage();
    demoPage.on("pageerror", error => errors.push(error.message));
    assert.equal((await demoPage.goto(demo)).status(), 200);
    await demoPage.locator(".world-country-map").waitFor();
    const paths = demoPage.locator(".atlas-line-visible");
    const colors = await paths.evaluateAll(lines => [...new Set(lines.map(line => line.style.stroke))]);
    const widths = await paths.evaluateAll(lines => [...new Set(lines.map(line => line.style.strokeWidth))]);
    assert.equal(colors.length, 3);
    assert.ok(widths.length > 1);
    assert.equal(await demoPage.getByRole("combobox", { name: "选择记录年度" }).inputValue(), "2024");
    assert.ok(await demoPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await demoPage.screenshot({ path: output + "/" + name + "-soybean.png", fullPage: name === "mobile" });
    await demoPage.locator(".country-trade-line").first().focus();
    await demoPage.keyboard.press("Enter");
    const details = demoPage.locator(".atlas-record-details");
    await details.waitFor();
    await details.getByText("贸易金额", { exact: true }).waitFor();
    assert.ok(await details.locator(".atlas-near-source a").count());
    if (name === "desktop") {
      await details.getByText("资料与方法", { exact: true }).click();
      await details.getByText("数据版本", { exact: true }).waitFor();
      await demoPage.screenshot({ path: output + "/desktop-source.png" });
      await details.getByRole("link", { name: "国家账本 →" }).click();
      await demoPage.getByRole("heading", { name: "国家账本", exact: true }).waitFor();
      await demoPage.goBack();
      await demoPage.locator(".world-country-map").waitFor();
    }
    await demoPage.getByRole("combobox", { name: "箭头粗细" }).selectOption("quantity");
    await demoPage.waitForURL(url => url.searchParams.get("measure") === "quantity");
    await demoPage.reload();
    assert.equal(await demoPage.getByRole("combobox", { name: "箭头粗细" }).inputValue(), "quantity");
    await demoPage.getByRole("button", { name: "移除大豆", exact: true }).click();
    await demoPage.waitForURL(url => !url.searchParams.get("items")?.split(",").includes("soybean"));
    await demoPage.goBack();
    await demoPage.waitForURL(url => url.searchParams.get("items")?.split(",").includes("soybean"));
    layouts.push({ name, colors: colors.length, widths: widths.length });
  }
  assert.deepEqual(errors, []);
  const evidence = { checkedAt: new Date().toISOString(), base, demo, products, layouts, pageErrors: errors };
  await writeFile(output + "/verification.json", JSON.stringify(evidence, null, 2) + "\n");
  console.log(JSON.stringify(evidence));
} finally {
  await browser.close();
}
