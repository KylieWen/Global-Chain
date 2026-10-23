import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { browserResearchExport } from './lib/browser-research-export.mjs';

const base = process.env.REVIEW_BASE_URL ?? 'http://127.0.0.1:3100';
const output = resolve(process.env.REVIEW_OUTPUT_DIR ?? 'output/qa/browser-smoke');
await mkdir(output, { recursive: true });
const manifest = JSON.parse(await readFile('data/published/manifest.json', 'utf8'));
const navigation = JSON.parse(await readFile('content/demo-navigation.json', 'utf8'));
const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const pageErrors = [];
const externalResources = [];
const checks = [];
page.on('pageerror', error => pageErrors.push(error.message));
// Browsing the published snapshot must work without third-party resources.
await page.route('**/*', route => {
  if (new URL(route.request().url()).origin !== new URL(base).origin) {
    externalResources.push(route.request().url());
    return route.abort();
  }
  return route.continue();
});
const go = async path => {
  const response = await page.goto(base + path, { waitUntil: 'networkidle' });
  assert.equal(response.status(), 200, path);
  const guide = page.getByRole('dialog', { name: 'Global Chain 新手引导', exact: true });
  if (await guide.isVisible()) await guide.locator('[data-guide-action="skip"]').click();
};
try {
  await go('/');
  const industryPath = `/products/${navigation.industry.productId}/industry?topic=${navigation.industry.topicId}`;
  await page.locator(`main a[href="${industryPath}"]`).click();
  await page.locator('.industry-selected h2').waitFor();
  assert.ok((await page.locator('.industry-selected h2').innerText()).trim());
  checks.push('Home industry entry opens its configured topic');
  await go('/demo');
  assert.equal(new URL(page.url()).pathname, '/', 'The retired demo URL opens the actual homepage');
  assert.equal(await page.locator('nav[aria-label="主导航"] a[href="/demo"]').count(), 0);
  assert.ok(await page.locator('[data-guide-action="open"]:visible').count() > 0, 'The actual homepage offers the new visitor guide');
  checks.push('Retired demo redirects to the homepage guide without a separate navigation item');

  for (const { productId, datasetVersion } of manifest.fixtures) {
    await go(`/products/${productId}`);
    await go(`/map?product=${productId}`);
    assert.equal(await page.locator('.map-country-shape.selected').count(), 0, productId);
    const countries = page.getByRole('combobox', { name: '选择国家', exact: true });
    const country = await countries.locator('option').evaluateAll(options => options.find(option => option.value && !option.disabled)?.value);
    assert.ok(country, `${productId}: country options`);
    await countries.selectOption(country);
    await page.waitForURL(url => url.searchParams.get('country') === country);
    await page.locator('.atlas-workspace[aria-busy="false"]').waitFor();
    assert.equal(await page.locator('.map-country-shape.selected').count(), 1, productId);
    await go(`/map/china?product=${productId}`);
    assert.ok(await page.locator('.regional-node').count() > 0, productId);
    const markers = await page.locator('.regional-node').evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label')));
    for (const label of markers) {
      await page.locator('.regional-node').and(page.getByRole('button', { name: label, exact: true })).click();
      assert.equal(await page.locator('.regional-node[aria-pressed="true"]').getAttribute('aria-label'), label);
    }
    const exported = await browserResearchExport(page, `/api/products/${productId}/research-export`);
    assert.equal(exported.status, 200);
    assert.equal(exported.datasetVersion, datasetVersion);
    assert.ok(exported.bytes > 0);
    checks.push({ productId, datasetVersion, mapSelection: true, china: true, export: true });
  }

  await go('/trade-guide');
  const productSelect = page.locator('select[name="product"]');
  const offeredProducts = await productSelect.locator('option').evaluateAll(options => options.filter(option => option.value && !option.disabled).map(option => option.value));
  assert.ok(offeredProducts.length);
  for (const productId of offeredProducts) {
    await go('/trade-guide');
    await productSelect.selectOption(productId);
    const jurisdiction = page.locator('select[name="jurisdiction"]');
    await jurisdiction.selectOption(await jurisdiction.locator('option').evaluateAll(options => options.find(option => option.value)?.value));
    const direction = page.locator('select[name="direction"]');
    await direction.selectOption(await direction.locator('option').evaluateAll(options => options.find(option => option.value)?.value));
    await page.getByRole('button', { name: '开始查询 →', exact: true }).click();
    await page.waitForLoadState('networkidle');
    await page.locator('.trade-guide-results-heading').waitFor();
    assert.match(await page.locator('.trade-guide-results-heading').innerText(), /[1-9]\d*\s*组结果/);
  }
  checks.push({ offeredGuideProducts: offeredProducts.length });
  const historicalVersion = 'globe-chain-smartphone-2026.2';
  await go(`/products/generic-smartphone/provenance?datasetVersion=${historicalVersion}`);
  const historicalDownload = await page.getByRole('link', { name: '下载研究快照（JSON）', exact: true }).getAttribute('href');
  assert.equal(new URL(historicalDownload, base).searchParams.get('datasetVersion'), historicalVersion);
  assert.equal((await browserResearchExport(page, historicalDownload)).datasetVersion, historicalVersion);
  const rejectedVersion = await page.evaluate(async () => {
    const response = await fetch('/api/products/generic-smartphone/research-export?datasetVersion=not-a-published-version');
    return {status:response.status, body:await response.json()};
  });
  assert.equal(rejectedVersion.status, 404);
  assert.equal(rejectedVersion.body.release, undefined);
  checks.push({ historicalExport: historicalVersion, unknownExportVersionRejected: true });
  for (const width of [1024, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await go('/map/china');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
    await page.locator('.nav-group > summary').filter({ hasText: '数据与指南' }).click();
    await page.getByRole('navigation', { name: '主导航' }).getByRole('link', { name: /数据版本/ }).waitFor();
    assert.equal(await page.locator('nav[aria-label="主导航"] a[href="/demo"]').count(), 0);
    await page.screenshot({ path: resolve(output, `menu-${width}.png`), fullPage: true });
    checks.push({ width, menu: true, noOverflow: true });
  }
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(externalResources, []);
  await writeFile(resolve(output, 'result.json'), JSON.stringify({ base, checkedAt: new Date().toISOString(), checks, pageErrors, externalResources }, null, 2));
  console.log(JSON.stringify({ checks, pageErrors, externalResources }));
} catch (error) {
  await page.screenshot({ path: resolve(output, 'failure.png'), fullPage: true }).catch(() => {});
  throw error;
} finally {
  await page.unrouteAll({ behavior: 'wait' });
  await browser.close();
}
