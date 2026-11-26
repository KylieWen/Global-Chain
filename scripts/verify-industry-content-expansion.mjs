import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const base = process.env.REVIEW_BASE_URL ?? 'http://127.0.0.1:3000';
const output = resolve(process.env.REVIEW_OUTPUT_DIR ?? 'output/qa/2026-10-24-industry-content');
await mkdir(output, { recursive: true });
const manifest = JSON.parse(await readFile('data/published/manifest.json', 'utf8'));
const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = []; const checks = [];
page.on('pageerror', error => errors.push(error.message));
try {
  for (const entry of manifest.fixtures) {
    const fixture = JSON.parse(await readFile(resolve('data/published', entry.path), 'utf8'));
    const network = fixture.industryNetwork;
    if (!network) {
      // Products without a recorded industry network have no industry module;
      // the route must not fabricate topics or relations. Recorded as a scope
      // boundary, not a failing expansion case.
      const response = await page.goto(`${base}/products/${entry.productId}/industry`, { waitUntil: 'networkidle', timeout: 90000 });
      checks.push({ productId: entry.productId, version: entry.datasetVersion, industryNetwork: false, routeStatus: response.status(), expanded: false });
      continue;
    }
    const topic = network.topics.find(topic => topic.kind === 'process' && network.relations.some(relation => relation.toTopicId === topic.id));
    const response = await page.goto(`${base}/products/${entry.productId}/industry?topic=${topic.id}`, { waitUntil: 'networkidle', timeout: 90000 });
    assert.equal(response.status(), 200);
    assert.ok((await page.locator('main').innerText()).includes(topic.label));
    assert.ok(await page.locator('.industry-connection').count() > 0);
    checks.push({ productId: entry.productId, version: entry.datasetVersion, topics: network.topics.length, relations: network.relations.length, connectionsVisible: true });
  }
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto(`${base}/map/china?product=generic-cotton-tshirt`, { waitUntil: 'networkidle' });
  await page.locator('.product-level-nav').getByRole('link', { name: '产业与企业', exact: true }).click();
  await page.waitForURL(/\/industry/);
  await page.locator('.industry-counts').waitFor();
  assert.ok((await page.locator('main').innerText()).includes('40'));
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  await page.screenshot({ path: resolve(output, 'cotton-industry-mobile.png') });
  assert.deepEqual(errors, []);
  await writeFile(resolve(output, 'result.json'), JSON.stringify({ base, checkedAt: new Date().toISOString(), checks, chinaEntry: true, pageErrors: errors }, null, 2));
  console.log(JSON.stringify({ checks, chinaEntry: true, pageErrors: errors }));
} finally { await browser.close(); }
