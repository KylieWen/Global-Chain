import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const base = process.env.REVIEW_BASE_URL ?? 'http://127.0.0.1:3000';
const output = resolve(process.env.REVIEW_OUTPUT_DIR ?? 'output/qa/2026-10-24-booth-onboarding');
const storageKey = 'global-chain.first-visit-guide.v1';
const personaKey = 'global-chain.audience.v1';
const guideName = 'Global Chain 新手引导';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome' });
const checks = [];
const errors = [];
let currentPage;
const newPage = async options => {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  currentPage = page;
  return { context, page };
};
const go = async (page, path) => {
  const response = await page.goto(base + path, { waitUntil: 'networkidle', timeout: 60000 });
  assert.equal(response.status(), 200, path);
};
const dialog = page => page.getByRole('dialog', { name: guideName, exact: true });
const action = (page, name) => dialog(page).locator(`[data-guide-action="${name}"]`);
const opened = async (page, step = 'product') => {
  await dialog(page).waitFor({ state: 'visible' });
  await page.locator(`.first-visit-guide[open][data-step="${step}"]`).waitFor();
  assert.ok(await dialog(page).evaluate(element => element.contains(document.activeElement)), 'Keyboard focus stays in the modal guide');
};
const noOverflow = async (page, name) => {
  const dimensions = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  assert.ok(dimensions.scroll <= dimensions.client, `${name}: no horizontal overflow ${JSON.stringify(dimensions)}`);
  if (await dialog(page).isVisible()) {
    const bounds = await dialog(page).boundingBox();
    assert.ok(bounds && bounds.x >= -1 && bounds.x + bounds.width <= dimensions.client + 1, `${name}: modal fits the viewport`);
  }
};
const captureGuide = async (page, filename) => {
  await page.waitForFunction(() => {
    const content = document.querySelector('.first-visit-guide[open] .guide-step-content');
    return content && Number(getComputedStyle(content).opacity) >= .99;
  });
  await page.screenshot({ path: resolve(output, filename) });
};
const reopen = async page => {
  const launcher = page.locator('[data-guide-action="open"]:visible').first();
  assert.ok(await launcher.count(), 'A visible guide launcher remains available');
  await launcher.focus();
  await page.keyboard.press('Enter');
  await opened(page);
  return launcher;
};
const chooseAndFinish = async (page, { productId, persona, expectedPath, screenshot }) => {
  const product = dialog(page).locator(`[data-guide-product="${productId}"]`);
  await product.focus();
  await page.keyboard.press('Space');
  assert.equal(await product.getAttribute('aria-pressed'), 'true');
  const productCopy = (await product.innerText()).trim();
  assert.ok(productCopy.length > 0);
  await action(page, 'next').click();
  await opened(page, 'persona');
  const personaChoice = dialog(page).locator(`[data-guide-persona="${persona}"]`);
  await personaChoice.click();
  assert.equal(await personaChoice.getAttribute('aria-pressed'), 'true');
  await action(page, 'next').click();
  await opened(page, 'preview');
  await noOverflow(page, 'guide preview');
  // Back/forward in the guide must preserve the already chosen perspective.
  await action(page, 'back').click();
  await opened(page, 'persona');
  assert.equal(await dialog(page).locator(`[data-guide-persona="${persona}"]`).getAttribute('aria-pressed'), 'true');
  await action(page, 'next').click();
  await opened(page, 'preview');
  if (screenshot) await captureGuide(page, screenshot);
  await action(page, 'start').click();
  await page.waitForURL(url => url.pathname === expectedPath && (expectedPath.startsWith('/products/') || url.searchParams.get('product') === productId));
  await dialog(page).waitFor({ state: 'hidden' });
  await page.locator('main h1').first().waitFor();
  await noOverflow(page, 'selected destination');
  return productCopy;
};

try {
  for (const [width, productId, persona, expectedPath] of [
    [1440, 'generic-cotton-tshirt', 'explorer', '/map'],
    [390, 'generic-home-air-conditioner', 'industry', '/map/china']
  ]) {
    const { context, page } = await newPage({ viewport: { width, height: 1000 }, ...(width === 390 ? { isMobile: true, hasTouch: true } : {}) });
    await go(page, '/');
    await opened(page);
    assert.ok(await dialog(page).locator('[data-guide-product]').count() >= 5, 'The five published products are selectable');
    const focusable = await dialog(page).locator('button:visible:not([disabled]), a[href]:visible, input:visible, select:visible').count();
    for (let index = 0; index < focusable + 2; index++) {
      await page.keyboard.press('Tab');
      const focusState = await dialog(page).evaluate(element => ({ inside: element.contains(document.activeElement), activeTag: document.activeElement?.tagName, activeClass: document.activeElement?.className, open: element.open }));
      assert.ok(focusState.inside, `Tab ${index + 1}/${focusable + 2} remains in the open guide: ${JSON.stringify(focusState)}`);
    }
    const firstControl = dialog(page).locator('button:visible:not([disabled]), a[href]:visible, input:visible, select:visible').first();
    const lastControl = dialog(page).locator('button:visible:not([disabled]), a[href]:visible, input:visible, select:visible').last();
    await firstControl.focus();
    await page.keyboard.press('Shift+Tab');
    assert.ok(await lastControl.evaluate(element => element === document.activeElement), 'Shift+Tab wraps from the first to the last guide control');
    await page.keyboard.press('Tab');
    assert.ok(await firstControl.evaluate(element => element === document.activeElement), 'Tab wraps from the last to the first guide control');
    await noOverflow(page, `first visit ${width}`);
    await captureGuide(page, `welcome-${width}.png`);
    const productCopy = await chooseAndFinish(page, { productId, persona, expectedPath, screenshot: `preview-${width}.png` });
    assert.equal(await page.evaluate(key => localStorage.getItem(key), storageKey), 'completed');
    assert.equal(await page.evaluate(key => localStorage.getItem(key), personaKey), persona);
    await page.screenshot({ path: resolve(output, `destination-${width}.png`) });
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await dialog(page).isVisible(), false, 'A completed guide does not repeat on refresh');
    await go(page, '/');
    assert.equal(await dialog(page).isVisible(), false, 'Returning home does not repeat a completed guide');
    const launcher = await reopen(page);
    await page.keyboard.press('Escape');
    await dialog(page).waitFor({ state: 'hidden', timeout: 1500 });
    assert.ok(await launcher.evaluate(element => element === document.activeElement), 'Escape restores focus to the guide launcher');
    await reopen(page);
    const skippedAt = Date.now();
    await action(page, 'skip').click();
    await dialog(page).waitFor({ state: 'hidden', timeout: 1500 });
    const skipMs = Date.now() - skippedAt;
    assert.equal(new URL(page.url()).pathname, '/', 'Skipping stays on the current page');
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await dialog(page).isVisible(), false, 'Skipping does not auto-repeat after refresh');
    await go(page, '/demo');
    assert.equal(new URL(page.url()).pathname, '/', 'Retired demo URL redirects home');
    assert.equal(await page.locator('nav[aria-label="主导航"] a[href="/demo"]').count(), 0, 'There is no separate demo navigation');
    checks.push({ width, productId, persona, productCopy, expectedPath, firstVisit: true, keyboardFocus: true, persistedCompletion: true, reopenAndEscape: true, skipMs, demoRedirect: true, noOverflow: true });
    await context.close();
  }

  // A fresh visitor can leave immediately; this is independent of completion.
  for (const method of ['skip', 'escape']) {
    const { context, page } = await newPage({ viewport: { width: 390, height: 900 } });
    await go(page, '/');
    await opened(page);
    const began = Date.now();
    if (method === 'skip') await action(page, 'skip').click();
    else await page.keyboard.press('Escape');
    await dialog(page).waitFor({ state: 'hidden', timeout: 1500 });
    const elapsedMs = Date.now() - began;
    assert.equal(await page.evaluate(key => localStorage.getItem(key), storageKey), 'skipped');
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await dialog(page).isVisible(), false);
    checks.push({ freshVisitorExit: method, elapsedMs, persistedSkip: true });
    await context.close();
  }

  const { context: restrictedContext, page: restricted } = await newPage({ viewport: { width: 390, height: 900 }, reducedMotion: 'reduce' });
  await restrictedContext.addInitScript(() => {
    for (const method of ['getItem', 'setItem']) Object.defineProperty(Storage.prototype, method, { configurable: true, value() { throw new DOMException('Storage disabled for verification', 'SecurityError'); } });
  });
  await go(restricted, '/');
  await opened(restricted);
  const moving = await dialog(restricted).evaluate(element => [element, ...element.querySelectorAll('*')].flatMap(node => {
    const style = getComputedStyle(node);
    const seconds = value => value.split(',').map(part => part.trim().endsWith('ms') ? parseFloat(part) / 1000 : parseFloat(part));
    const animation = Math.max(...seconds(style.animationDuration));
    const transition = /(^|,|\s)(all|transform)(,|\s|$)/.test(style.transitionProperty) ? Math.max(...seconds(style.transitionDuration)) : 0;
    return animation > .02 || transition > .02 ? [{ tag: node.tagName, className: node.className, animation, transition }] : [];
  }));
  assert.deepEqual(moving, [], 'Reduced-motion mode removes long guide animations/transforms');
  await chooseAndFinish(restricted, { productId: 'generic-soybean-oil', persona: 'researcher', expectedPath: '/products/generic-soybean-oil/provenance', screenshot: 'restricted-reduced-preview-390.png' });
  await restricted.getByRole('link', { name: 'Global Chain 首页', exact: true }).click();
  await restricted.waitForURL(url => url.pathname === '/');
  await restricted.locator('[data-guide-action="open"]:visible').first().waitFor();
  assert.equal(await dialog(restricted).isVisible(), false, 'In-memory dismissal lasts through this visit');
  const restrictedLauncher = await reopen(restricted);
  await action(restricted, 'skip').click();
  await dialog(restricted).waitFor({ state: 'hidden' });
  assert.ok(await restrictedLauncher.evaluate(element => element === document.activeElement));
  checks.push({ restrictedStorage: true, reducedMotion: true, researcherDestination: true, sameVisitReopen: true });
  await restrictedContext.close();

  assert.deepEqual(errors, []);
  const result = { base, checkedAt: new Date().toISOString(), checks, pageErrors: errors };
  await writeFile(resolve(output, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} catch (error) {
  await currentPage?.screenshot({ path: resolve(output, 'failure.png') }).catch(() => {});
  await writeFile(resolve(output, 'failure.json'), JSON.stringify({ base, checkedAt: new Date().toISOString(), error: String(error), checks, pageErrors: errors }, null, 2));
  throw error;
} finally {
  await browser.close();
}
