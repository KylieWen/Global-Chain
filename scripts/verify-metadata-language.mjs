import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

const base = process.env.REVIEW_BASE_URL ?? 'http://127.0.0.1:3000';
const output = resolve(process.env.REVIEW_OUTPUT_DIR ?? 'output/review/metadata-language-2026-10-24');
const product = 'generic-smartphone';
const historicalVersion = 'globe-chain-smartphone-2026.2';
const manifest = JSON.parse(await readFile('data/published/manifest.json', 'utf8'));
const active = manifest.fixtures.find(entry => entry.productId === product);
assert.ok(active);
const currentFixture = JSON.parse(await readFile(resolve('data/published', active.path), 'utf8'));
const historicalFixture = JSON.parse(await readFile(resolve('data/published/releases', product, historicalVersion, 'fixture.json'), 'utf8'));
// Use the same schema boundary as the fixture loader: it supplies documented
// defaults and strips extra source-file fields before the runtime export.
// Vite is already supplied by the existing Vitest dependency; no listener or
// additional runtime dependency is installed for this verification.
const localRequire = createRequire(import.meta.url);
const vitestRequire = createRequire(localRequire.resolve('vitest/package.json'));
const { createServer } = vitestRequire('vite');
const schemaLoader = await createServer({ root: resolve('.'), configFile: false, logLevel: 'error', server: { middlewareMode: true, preTransformRequests: false }, appType: 'custom' });
let expectedSnapshots;
try {
  const { ProductFixtureSchema } = await schemaLoader.ssrLoadModule('/packages/contracts/src/index.ts');
  expectedSnapshots = [currentFixture, historicalFixture].map(fixture => ProductFixtureSchema.parse(fixture));
} finally { await schemaLoader.close(); }
await mkdir(output, { recursive: true });

const readyDeadline = Date.now() + 60000;
while (true) {
  try {
    const response = await fetch(base + '/api/health', { signal: AbortSignal.timeout(2000) });
    if (response.ok && (await response.json()).service === 'web') break;
  } catch { /* The owner may still be starting the completed production build. */ }
  if (Date.now() > readyDeadline) throw new Error('Local production health did not become ready within 60 seconds');
  await new Promise(resolveWait => setTimeout(resolveWait, 800));
}

const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
const checks = [];
page.on('pageerror', error => errors.push(error.message));
const go = async path => {
  const response = await page.goto(base + path, { waitUntil: 'networkidle' });
  assert.equal(response.status(), 200, path);
};
const openDetails = async details => {
  assert.equal(await details.count(), 1, 'Unique intended disclosure');
  if (!(await details.evaluate(element => element.open))) await details.locator(':scope > summary').click();
  assert.equal(await details.evaluate(element => element.open), true);
};
const checkMetadata = async (scope, name, requireObserved = false) => {
  const items = await scope.locator('.metadata-item').evaluateAll(elements => elements.filter(element => element.getClientRects().length).map(element => ({
    label: element.querySelector('.metadata-label')?.textContent.trim() ?? '',
    value: element.querySelector('.metadata-value')?.textContent.trim() ?? ''
  })));
  assert.ok(items.length > 0, `${name}: visible metadata exists`);
  const forbidden = /^(?:method|datasetVersion|contentVersion|dataStatus|(?:金额|数量)\s*dataStatus)$/i;
  for (const item of items) {
    assert.ok(!forbidden.test(item.label), `${name}: untranslated label ${item.label}`);
    if (item.label === '整理方法') assert.ok(!/^(official|derived|curated|mock)$/.test(item.value), `${name}: untranslated method ${item.value}`);
    if (/^(数据状态|金额状态|数量状态)$/.test(item.label)) {
      assert.ok(item.value.length > 0, `${name}: status must have readable text`);
      assert.ok(!/^(observed|estimated|unknown|missing|withheld|invalid)$/.test(item.value), `${name}: untranslated status ${item.value}`);
    }
  }
  if (requireObserved) assert.ok(items.some(item => item.label === '数据状态' && item.value === '已观测'), `${name}: observed status remains explicit`);
  checks.push({ name, visibleMetadata: items.length, labelsTranslated: true, statusesNonempty: true, statusesTranslated: true });
};
const noOverflow = async name => {
  const dimensions = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  assert.ok(dimensions.scroll <= dimensions.client, `${name}: document overflow ${JSON.stringify(dimensions)}`);
  checks.push({ name, noOverflow: true, dimensions });
};
const captureViewport = async (target, filename) => {
  const headerSpace = await page.locator('.site-header').evaluate(element => element.getBoundingClientRect().height + 18);
  await target.evaluate((element, offset) => window.scrollBy({ top: element.getBoundingClientRect().top - offset, behavior: 'instant' }), headerSpace);
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
  await page.screenshot({ path: resolve(output, filename), fullPage: false });
};

try {
  if (process.env.METADATA_SCREENSHOTS_ONLY === '1') {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await go(`/products/${product}/provenance`);
      await captureViewport(page.locator('.route-methodology'), `source-route-${width}.png`);
      await go(`/products/${product}/evidence-gaps`);
      const priorityGap = page.locator('.evidence-gap-registry-progressive > .evidence-gap-list > .evidence-gap-card-human').first();
      await openDetails(priorityGap.locator('.evidence-gap-audit'));
      await captureViewport(priorityGap, `gap-audit-${width}.png`);
    }
    const capture = { base, checkedAt: new Date().toISOString(), scope: 'Screenshot recapture only; natural viewport and existing sticky header', pageErrors: errors };
    await writeFile(resolve(output, 'screenshots-result.json'), JSON.stringify(capture, null, 2));
    console.log(JSON.stringify(capture));
  } else {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await go(`/products/${product}/ledger/country-cn`);
    await openDetails(page.locator('details').filter({ has: page.locator(':scope > summary', { hasText: /^国家与版本信息$/ }) }));
    const versionInformation = page.locator('details').filter({ has: page.locator(':scope > summary', { hasText: /^国家与版本信息$/ }) });
    assert.ok(!(await versionInformation.innerText()).includes('published'));
    await openDetails(page.locator('details[aria-labelledby="macro-title"]'));
    await checkMetadata(page.locator('details[aria-labelledby="macro-title"]'), `ledger-macro-${width}`, true);
    await page.locator('.interpreted-metric').first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(output, `ledger-macro-${width}.png`) });

    await openDetails(page.locator('details[aria-labelledby="trade-title"]'));
    const tradeCard = page.locator('.trade-observation-card').first();
    await openDetails(tradeCard.locator('details.reading-details'));
    await checkMetadata(tradeCard, `ledger-trade-${width}`);
    const qualityDetails = page.locator('.quality-details').first();
    await openDetails(qualityDetails);
    const qualityText = await qualityDetails.locator('code').innerText();
    assert.ok(currentFixture.tradeObservations.some(record => record.qualityNote === qualityText), 'Original quality JSON is not translated or rewritten');
    const originalQuality = JSON.parse(qualityText);
    assert.ok(originalQuality.requestUrl && originalQuality.rawResponseSha256);
    checks.push({ name: `quality-json-${width}`, rawFieldsAndValuesPreserved: true });
    await noOverflow(`ledger-expanded-${width}`);

    await go(`/products/${product}/provenance`);
    await checkMetadata(page.locator('.route-methodology'), `source-route-${width}`);
    await checkMetadata(page.locator('section[aria-labelledby="indicator-definitions-title"]'), `source-indicators-${width}`);
    const compactGaps = page.locator('section[aria-labelledby="provenance-gaps-title"]');
    await checkMetadata(compactGaps.locator('.evidence-gap-card').first(), `source-compact-gap-${width}`);
    assert.ok(!(await page.locator('section[aria-labelledby="research-export-title"]').innerText()).includes('published'));
    assert.ok(!(await page.locator('section[aria-labelledby="policy-title"]').innerText()).includes('unknown'));
    const sourceHref = currentFixture.sources.find(source => source.url)?.url;
    assert.ok(sourceHref);
    assert.ok((await page.locator('.source-metadata a').evaluateAll(links => links.map(link => link.href))).includes(sourceHref));
    const excerpt = currentFixture.evidence.find(record => record.excerpt && /[A-Za-z]{4}/.test(record.excerpt))?.excerpt;
    assert.ok(excerpt, 'Fixture has an original English excerpt to protect');
    assert.ok((await page.locator('.resolved-evidence:not(.compact-evidence)').innerText()).includes(excerpt), 'Original English evidence excerpt is preserved');
    const materialMetadata = await page.locator('section[aria-labelledby="material-observations-title"] .fact-metadata-grid').allInnerTexts();
    assert.ok(materialMetadata.length > 0);
    assert.ok(materialMetadata.every(text => !/金额状态：(?:observed|estimated|unknown|withheld|invalid)|数量状态：(?:observed|estimated|unknown|withheld|invalid)/.test(text)));
    await noOverflow(`source-${width}`);
    await captureViewport(page.locator('.route-methodology'), `source-route-${width}.png`);

    await go(`/products/${product}/evidence-gaps`);
    const priorityGap = page.locator('.evidence-gap-registry-progressive > .evidence-gap-list > .evidence-gap-card-human').first();
    await openDetails(priorityGap.locator('.evidence-gap-audit'));
    await checkMetadata(priorityGap, `gap-priority-audit-${width}`);
    await openDetails(page.locator('.evidence-gap-all'));
    const remainingGap = page.locator('.evidence-gap-all .evidence-gap-card-human').first();
    await openDetails(remainingGap.locator('.evidence-gap-audit'));
    await checkMetadata(remainingGap, `gap-secondary-audit-${width}`);
    assert.ok((await priorityGap.locator('code').allTextContents()).some(text => text.startsWith('gap-')), 'Gap record IDs remain available');
    await noOverflow(`gaps-expanded-${width}`);
    await captureViewport(priorityGap, `gap-audit-${width}.png`);
  }

  for (const fixture of expectedSnapshots) {
    const version = fixture.datasetVersion.version;
    const exported = await page.evaluate(async endpoint => {
      const response = await fetch(endpoint, { signal: AbortSignal.timeout(60000) });
      return { status: response.status, json: await response.json() };
    }, `/api/products/${product}/research-export?datasetVersion=${encodeURIComponent(version)}`);
    assert.equal(exported.status, 200);
    assert.equal(exported.json.release.datasetVersion.version, version);
    assert.equal(exported.json.formatVersion, 'product-research-export.v1');
    assert.equal(isDeepStrictEqual(exported.json.snapshot, fixture), true, `${version}: complete snapshot remains identical to schema-normalized immutable fixture`);
    assert.ok(exported.json.snapshot.macroIndicators.some(record => record.method === 'official' && record.dataStatus === 'observed' && record.sourceId));
    assert.ok(exported.json.snapshot.storyGraph.flows.every(record => record.value === null && record.valueDataStatus === 'unknown'));
    checks.push({ name: 'research-export', version, completeSchemaNormalizedSnapshotUnchanged: true, originalKeysAndStatusesPreserved: true });
  }
  assert.deepEqual(errors, []);
  const result = { base, checkedAt: new Date().toISOString(), scope: 'Local metadata-language presentation only; no injected CSS', checks, pageErrors: errors };
  await writeFile(resolve(output, 'result.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  }
} catch (error) {
  const overflow = await page.evaluate(() => [...document.querySelectorAll('main *')].map(element => {
    const rect = element.getBoundingClientRect();
    return { tag: element.tagName, className: element.className, id: element.id, left: rect.left, right: rect.right, width: rect.width, text: element.textContent.trim().slice(0, 140), leaf: element.children.length === 0 };
  }).filter(item => item.right > document.documentElement.clientWidth + 1 || item.left < -1).sort((a, b) => Number(b.leaf) - Number(a.leaf) || b.right - a.right).slice(0, 35));
  const culprit = await page.evaluate(() => {
    const heading = [...document.querySelectorAll('.evidence-heading')].find(element => element.getBoundingClientRect().right > document.documentElement.clientWidth);
    return heading ? [heading, ...heading.children, heading.parentElement, heading.parentElement.parentElement, heading.parentElement.parentElement.parentElement].map(element => {
      const rect = element.getBoundingClientRect(); const style = getComputedStyle(element);
      return { tag: element.tagName, className: element.className, text: element.textContent.trim().slice(0, 500), left: rect.left, right: rect.right, width: rect.width, display: style.display, minWidth: style.minWidth, overflowWrap: style.overflowWrap, whiteSpace: style.whiteSpace, gridTemplateColumns: style.gridTemplateColumns };
    }) : [];
  });
  await writeFile(resolve(output, 'failure-details.json'), JSON.stringify({ url: page.url(), error: String(error), checks, overflow, culprit, pageErrors: errors }, null, 2));
  await page.screenshot({ path: resolve(output, 'failure.png'), fullPage: false }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
