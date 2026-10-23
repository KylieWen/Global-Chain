import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const base = process.env.REVIEW_BASE_URL ?? 'http://127.0.0.1:3000';
const output = resolve(process.env.REVIEW_OUTPUT_DIR ?? 'output/qa/2026-10-23-final-guide-context');
const version = 'globe-chain-smartphone-2026.2';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
const checks = [];
page.on('pageerror', error => errors.push(error.message));
const go = async path => {
  const response = await page.goto(base + path, { waitUntil: 'networkidle' });
  assert.equal(response.status(), 200, path);
};
const expectedVersion = () => assert.equal(new URL(page.url()).searchParams.get('datasetVersion'), version);
const matchingForm = async () => {
  const query = new URL(page.url()).searchParams;
  assert.equal(await page.locator('select[name="jurisdiction"]').inputValue(), query.get('jurisdiction') ?? '', 'country selection matches the displayed query');
  assert.equal(await page.locator('select[name="direction"]').inputValue(), query.get('direction') ?? '', 'direction selection matches the displayed query');
};
try {
  await go(`/trade-guide?product=generic-smartphone&datasetVersion=${version}`);
  await page.locator('.trade-guide-preset').first().click();
  await page.locator('.trade-guide-card').first().waitFor();
  expectedVersion();
  await matchingForm();
  assert.ok(await page.locator('.trade-guide-card').count() > 0);
  checks.push('Historical preset keeps its snapshot');

  await go(`/trade-guide?product=generic-smartphone&datasetVersion=${version}`);
  await page.locator('.trade-guide-summary-action').first().click();
  await page.locator('.trade-guide-card').first().waitFor();
  expectedVersion();
  await matchingForm();
  assert.ok(await page.locator('.trade-guide-card').count() > 0);
  checks.push('Historical guide-card action keeps its snapshot');

  await go(`/trade-guide?product=generic-smartphone&datasetVersion=${version}`);
  await page.locator('select[name="jurisdiction"]').selectOption('country-cn');
  await page.locator('select[name="direction"]').selectOption('export');
  await page.getByRole('button', { name: '开始查询 →', exact: true }).click();
  await page.locator('.trade-guide-card').first().waitFor();
  expectedVersion();
  assert.ok(await page.locator('.trade-guide-card').count() > 0);
  checks.push('Historical query form keeps its snapshot');

  await go(`/trade-guide?product=generic-smartphone&datasetVersion=${version}&jurisdiction=not-covered&direction=export`);
  await page.getByRole('link', { name: '查看全部已收录指南 →', exact: true }).click();
  await page.locator('.trade-guide-summary-card').first().waitFor();
  expectedVersion();
  assert.ok(await page.locator('.trade-guide-summary-card').count() > 0);
  checks.push('Historical empty-query recovery keeps its snapshot');

  for (const suffix of ['', '&datasetVersion=missing-snapshot']) {
    await go('/trade-guide?product=generic-smartphone' + suffix);
    await page.locator('select[name="product"]').selectOption('generic-home-air-conditioner');
    await page.locator('select[name="jurisdiction"]').selectOption('country-cn');
    await page.locator('select[name="direction"]').selectOption('export');
    assert.equal(await page.locator('input[name="datasetVersion"]').count(), 0);
    await page.getByRole('button', { name: '开始查询 →', exact: true }).click();
    await page.locator('.trade-guide-card').first().waitFor();
    assert.equal(new URL(page.url()).searchParams.get('product'), 'generic-home-air-conditioner');
    assert.equal(await page.locator('select[name="product"]').inputValue(), 'generic-home-air-conditioner');
    assert.ok(await page.locator('.trade-guide-card').count() > 0);
    checks.push({ productSwitch: 'generic-home-air-conditioner', unavailableVersionFallback: Boolean(suffix) });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await go(`/trade-guide?product=generic-smartphone&datasetVersion=${version}`);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  await page.screenshot({ path: resolve(output, 'guides-mobile.png'), fullPage: true });
  checks.push('390px historical guide directory has no horizontal overflow');
  assert.deepEqual(errors, []);
  const result = { base, checkedAt: new Date().toISOString(), checks, pageErrors: errors };
  await writeFile(resolve(output, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} catch (error) {
  await page.screenshot({ path: resolve(output, 'failure.png'), fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
