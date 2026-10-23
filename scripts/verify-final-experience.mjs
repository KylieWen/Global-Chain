import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const base = process.env.REVIEW_BASE_URL ?? 'http://127.0.0.1:3000';
const output = resolve(process.env.REVIEW_OUTPUT_DIR ?? 'output/qa/final-experience');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const errors = [], checks = [];
page.on('pageerror', error => errors.push(error.message));
const go = async path => {
  const response = await page.goto(base + path, { waitUntil: 'networkidle' });
  assert.equal(response.status(), 200, path);
};
const noOverflow = async () => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), 'No horizontal overflow');
const key = 'global-chain.audience.v1';
try {
  await go('/');
  assert.equal(await page.locator('.persona-choices [aria-pressed=true]').count(), 0);
  const roles = [
    { id: 'explorer', label: '公众探索', first: '地图探索' },
    { id: 'industry', label: '产业参与者', first: '商品与产业' },
    { id: 'researcher', label: '高校研究者', first: '数据与指南' }
  ];
  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const role of roles) {
      await go('/');
      await page.getByRole('group', { name: '选择浏览身份' }).getByRole('button', { name: new RegExp(role.label) }).click();
      await page.locator(`.persona-home[data-persona="${role.id}"]`).waitFor();
      assert.equal(await page.evaluate(storageKey => localStorage.getItem(storageKey), key), role.id);
      assert.ok((await page.locator('.nav-group > summary').first().innerText()).includes(role.first));
      assert.equal(await page.locator('.persona-recommendations a').count(), 3);
      await noOverflow();
      await page.screenshot({ path: resolve(output, `${role.id}-${width}.png`), fullPage: true });
      await go('/map/china?product=generic-home-air-conditioner&stage=material');
      const originalURL = page.url();
      await page.locator('.persona-switcher > summary').click();
      await page.locator('.persona-switcher-menu').getByRole('button', { name: /高校研究者/ }).click();
      assert.equal(page.url(), originalURL, 'Changing perspective preserves the current map filters');
      await page.reload({ waitUntil: 'networkidle' });
      assert.match(await page.locator('.persona-switcher > summary').innerText(), /高校研究者/);
      await noOverflow();
      checks.push({ width, role: role.id, recommendationOrder: true, persistedOnSubpage: true });
    }
  }
  const firstNavSummary = page.locator('.nav-group > summary').first();
  await firstNavSummary.focus();
  await page.keyboard.press('Enter');
  await page.locator('.nav-group[open]').waitFor();
  await page.locator('.persona-switcher > summary').focus();
  await page.keyboard.press('Enter');
  await page.locator('.persona-switcher[open]').waitFor();
  assert.equal(await page.locator('.nav-group[open]').count(), 0);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.persona-switcher').getAttribute('open'), null);
  assert.ok(await page.locator('.persona-switcher > summary').evaluate(element => element === document.activeElement));
  await page.keyboard.press('Enter');
  await page.locator('.persona-switcher[open]').waitFor();
  await firstNavSummary.focus();
  await page.keyboard.press('Enter');
  await page.locator('.nav-group[open]').waitFor();
  assert.equal(await page.locator('.persona-switcher[open]').count(), 0);
  await page.locator('#global-search-input').focus();
  assert.equal(await page.locator('.nav-group[open]').count(), 0);
  checks.push('Keyboard menus are mutually exclusive, Escape restores focus and leaving closes the menu');
  await page.evaluate(storageKey => localStorage.setItem(storageKey, 'administrator'), key);
  await go('/');
  assert.equal(await page.locator('.persona-home').getAttribute('data-persona'), 'explorer');
  assert.equal(await page.locator('.persona-choices [aria-pressed=true]').count(), 0);
  const other = await context.newPage();
  await other.goto(base, { waitUntil: 'networkidle' });
  await other.evaluate(storageKey => localStorage.setItem(storageKey, 'industry'), key);
  await page.locator('.persona-home[data-persona="industry"]').waitFor();
  await other.evaluate(() => localStorage.clear());
  await page.locator('.persona-home[data-persona="explorer"]').waitFor();
  await other.close();
  checks.push('Invalid identity cannot create permissions; preference removal and cross-tab changes stay in sync');

  const restricted = await browser.newContext({ viewport: { width: 390, height: 900 } });
  await restricted.addInitScript(() => {
    Object.defineProperty(Storage.prototype, 'getItem', { value() { throw new DOMException('Storage disabled', 'SecurityError'); } });
    Object.defineProperty(Storage.prototype, 'setItem', { value() { throw new DOMException('Storage disabled', 'SecurityError'); } });
  });
  const restrictedPage = await restricted.newPage();
  restrictedPage.on('pageerror', error => errors.push(error.message));
  await restrictedPage.goto(base, { waitUntil: 'networkidle' });
  await restrictedPage.getByRole('group', { name: '选择浏览身份' }).getByRole('button', { name: /产业参与者/ }).click();
  await restrictedPage.locator('.persona-home[data-persona="industry"]').waitFor();
  await restrictedPage.locator('.persona-recommendations a').first().click();
  await restrictedPage.waitForLoadState('networkidle');
  assert.match(await restrictedPage.locator('.persona-switcher > summary').innerText(), /产业参与者/);
  await restricted.close();
  checks.push('Storage-disabled browsers can switch and continue navigating');
  assert.deepEqual(errors, []);
  await writeFile(resolve(output, 'result.json'), JSON.stringify({ base, checkedAt: new Date().toISOString(), checks, pageErrors: errors }, null, 2));
  console.log(JSON.stringify({ checks, pageErrors: errors }));
} catch (error) {
  await page.screenshot({ path: resolve(output, 'failure.png'), fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
