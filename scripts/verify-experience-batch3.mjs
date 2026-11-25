/**
 * Batch 3 (experience rebuild 2026-11) independent browser acceptance.
 *
 * Drives an already-running Next production instance (next start, never dev) with
 * Playwright + installed Chrome in isolated contexts. Does not touch business
 * source, data, docs, the public site or Qoder.
 *
 * Coverage:
 *   - Phone procedural 3D exploded view: render, drag rotate, wheel zoom,
 *     explosion slider, reset view, part selection, battery/lithium actions
 *   - Six real deep chains resolve with real content
 *   - Five-step main line (catalog → breakdown → route → ledger → map) via in-page
 *     links only, no browser back
 *   - Other four products render the isometric depth fallback
 *   - Dark/light at 1440 and 390, no horizontal overflow; reduced-motion fallback
 *
 * Usage:
 *   REVIEW_BASE_URL=http://127.0.0.1:4320 \
 *   REVIEW_OUTPUT_DIR=output/qa/experience-rebuild-2026-11/batch-3 \
 *   node scripts/verify-experience-batch3.mjs
 *
 * Exit code: 0 all checks passed; 1 at least one failed check.
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const base = process.env.REVIEW_BASE_URL ?? "http://127.0.0.1:4320";
const output = resolve(process.env.REVIEW_OUTPUT_DIR ?? "output/qa/experience-rebuild-2026-11/batch-3");
await mkdir(output, { recursive: true });

const results = {
  base,
  startedAt: new Date().toISOString(),
  browser: {},
  checks: [],
  observations: [],
  deepChains: {},
  issues: []
};

const checks = results.checks;
const ok = (name, passed, detail = {}) => checks.push({ name, passed: Boolean(passed), ...detail });
const observe = (section, data) => results.observations.push({ section, ...data });
function recordIssue(severity, title, detail) { results.issues.push({ severity, title, detail }); }

async function shot(page, name) {
  await page.screenshot({ path: resolve(output, name), fullPage: false });
}

async function gotoPage(page, path, { waitSelector, retries = 4 } = {}) {
  let response = null;
  let lastError = null;
  for (let i = 0; i <= retries; i += 1) {
    try {
      response = await page.goto(base + path, { waitUntil: "domcontentloaded", timeout: 15000 });
      lastError = null;
      break;
    } catch (e) {
      lastError = e;
      const msg = String(e?.message ?? e);
      if (/ERR_CONNECTION_REFUSED|ECONNREFUSED|net::ERR_|Navigation timeout/i.test(msg) && i < retries) {
        await new Promise((r) => setTimeout(r, 2000));
        continue;
      }
      throw e;
    }
  }
  if (lastError) throw lastError;
  if (waitSelector) {
    try { await page.locator(waitSelector).first().waitFor({ timeout: 10000 }); }
    catch (e) { observe("selector-timeout", { path, error: String(e?.message ?? e).split("\n")[0] }); }
  }
  return response?.status();
}

function attachErrorCapture(page, label) {
  results.pageErrors ??= {};
  results.consoleErrors ??= {};
  results.pageErrors[label] = [];
  results.consoleErrors[label] = [];
  page.on("pageerror", (error) => results.pageErrors[label].push(String(error?.message ?? error)));
  page.on("console", (message) => {
    if (message.type() === "error") {
      const location = message.location();
      const source = location.url ? ` [${location.url}:${location.lineNumber ?? 0}]` : "";
      results.consoleErrors[label].push(message.text().slice(0, 300) + source);
    }
  });
}

async function themeState(page) {
  return page.evaluate(() => ({
    theme: document.documentElement.dataset.theme ?? null,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
  }));
}

async function dismissGuide(page) {  const dialog = page.getByRole("dialog", { name: "Global Chain 新手引导", exact: true });
  try {
    await dialog.waitFor({ state: "visible", timeout: 2000 });
    await dialog.locator('[data-guide-action="skip"]').click();
    await dialog.waitFor({ state: "detached", timeout: 2000 });
  } catch { /* absent or already closed */ }
}

async function readExplorer(page) {
  return page.evaluate(() => {
    const root = document.querySelector(".exploded-explorer");
    if (!root) return { present: false };
    // Rebaseline: the procedural view ships two renderers. The WebGL wrap carries
    // both the shared base class `.exploded-canvas-wrap` and `.exploded-three-wrap`;
    // the kept Canvas2D fallback carries only the base class. Read the mounted
    // wrap's `data-renderer` instead of probing a single canvas class.
    const three = root.querySelector(".exploded-three-wrap");
    const two = root.querySelector(".exploded-canvas-wrap:not(.exploded-three-wrap)");
    const procedural = three ?? two;
    const canvas = procedural?.querySelector("canvas") ?? null;
    const iso = root.querySelector(".exploded-iso");
    const modeBadge = root.querySelector(".exploded-mode-badge")?.textContent.trim() ?? null;
    const gaps = [...root.querySelectorAll(".exploded-gaps li")].map((li) => li.textContent.trim());
    const lanes = [...root.querySelectorAll(".exploded-lane")].map((lane) => ({
      label: lane.textContent.trim(),
      missing: lane.classList.contains("missing")
    }));
    const listItems = [...root.querySelectorAll(".exploded-node-list-item")].map((el) => el.textContent.trim());
    const detailName = root.querySelector(".exploded-detail-header h3")?.textContent.trim() ?? null;
    const actions = [...root.querySelectorAll(".exploded-actions a")].map((a) => ({
      label: a.textContent.trim(),
      href: a.getAttribute("href")
    }));
    const materialChips = [...root.querySelectorAll(".exploded-material-chip")].map((el) => el.textContent.trim());
    const slider = root.querySelector('.exploded-slider input[type="range"]');
    return {
      present: true,
      mode: procedural ? "procedural-3d" : iso ? "iso-layers" : "unknown",
      renderer: procedural?.dataset.renderer ?? null,
      modeBadge,
      gapCount: gaps.length,
      gaps,
      lanes,
      listItemCount: listItems.length,
      listItems,
      detailName,
      actions,
      materialChips,
      hasSlider: Boolean(slider),
      sliderValue: slider ? slider.value : null
    };
  });
}

function checkLedgerNames(explorer, contextLabel) {
  const ledgerActions = (explorer?.actions ?? []).filter((action) => action.href?.includes("/ledger/"));
  for (const action of ledgerActions) {
    const match = action.label.match(/^国家账本 ·\s*(.+?)\s*→$/);
    ok(`ledger button on ${contextLabel} names the country/region`, Boolean(match) && match[1].trim().length > 0, action);
  }
  observe("ledger-labels", { context: contextLabel, count: ledgerActions.length });
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
results.browser = { channel: "chrome", headless: true, viewportNote: "desktop + 390 viewport simulation only" };

/* -------------------------------------------------------------------------- */
/* 1. Desktop dark: phone procedural 3D, selection, interactions              */
/* -------------------------------------------------------------------------- */
const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const dPage = await desktop.newPage();
attachErrorCapture(dPage, "phone-1440-dark");

// Step 1: pick the product from the catalog via an in-page card link.
const catalogStatus = await gotoPage(dPage, "/products", { waitSelector: ".product-card" });
await dismissGuide(dPage);
const phoneCard = dPage.locator(".product-card", { hasText: "智能手机" }).first();
const phoneHref = await phoneCard.getAttribute("href");
await phoneCard.click();
await dPage.waitForSelector(".exploded-explorer", { timeout: 10000 });
await dPage.waitForSelector(".exploded-three-wrap, .exploded-canvas-wrap, .exploded-iso", { timeout: 10000 }).catch(() => {});
ok("catalog entry navigates to the phone product page", phoneHref === "/products/generic-smartphone" && dPage.url().includes("/products/generic-smartphone"), { phoneHref, url: dPage.url() });

const dExplorer = await readExplorer(dPage);
const dState = await themeState(dPage);
observe("phone-1440-dark", { status: catalogStatus, ...dState, explorer: dExplorer });

ok("phone product page renders the explorer", dExplorer.present, dExplorer);
ok("phone uses the procedural 3D renderer", dExplorer.mode === "procedural-3d", { mode: dExplorer.mode, badge: dExplorer.modeBadge });
ok("five lanes are listed with unresolved part lane flagged", dExplorer.lanes.length === 5 && dExplorer.lanes.some((lane) => lane.missing), { lanes: dExplorer.lanes });
ok("data gaps are explicitly listed", dExplorer.gapCount > 0, { gaps: dExplorer.gaps });
ok("explorer has an explosion slider", dExplorer.hasSlider, { sliderValue: dExplorer.sliderValue });
ok("desktop dark has no horizontal overflow", !dState.overflow, dState);
checkLedgerNames(dExplorer, "phone-1440-dark");
await shot(dPage, "phone-1440-dark.png");

// Real pointer drag rotates the view; wheel zooms; no errors expected.
const canvas = dPage.locator(".exploded-three-wrap canvas, .exploded-canvas-wrap canvas");
ok("3D canvas is mounted", (await canvas.count()) === 1);
const box = await canvas.boundingBox();
if (box) {
  await dPage.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await dPage.mouse.down();
  await dPage.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 40, { steps: 8 });
  await dPage.mouse.up();
  await dPage.mouse.wheel(0, -240);
  await dPage.mouse.wheel(0, 180);
  observe("canvas-interaction", { dragged: true, wheel: true });
}
await dPage.locator(".exploded-reset").click();
observe("canvas-reset", { clicked: true });

// Explosion slider real input.
const slider = dPage.locator('.exploded-slider input[type="range"]');
await slider.fill("0.15");
await slider.dispatchEvent("input");
const sliderLow = await dPage.evaluate(() => document.querySelector('.exploded-slider input[type="range"]')?.value);
await slider.fill("0.9");
await slider.dispatchEvent("input");
const sliderHigh = await dPage.evaluate(() => document.querySelector('.exploded-slider input[type="range"]')?.value);
ok("explosion slider accepts real input", sliderLow === "0.15" && sliderHigh === "0.9", { sliderLow, sliderHigh });

// Select battery from the real node list.
await dPage.locator(".exploded-node-list-item", { hasText: "电池" }).first().click();
await dPage.waitForTimeout(150);
const batteryExplorer = await readExplorer(dPage);
const batteryRouteAction = batteryExplorer.actions.find((action) => action.href?.includes("focus=battery"));
const lithiumChip = batteryExplorer.materialChips.some((label) => label.includes("锂"));
ok("selecting battery keeps the real item id in the detail panel", batteryExplorer.detailName === "电池", batteryExplorer);
ok("battery detail links to its representative route", Boolean(batteryRouteAction), { actions: batteryExplorer.actions });
ok("battery descendant materials include lithium", lithiumChip, { materialChips: batteryExplorer.materialChips });
checkLedgerNames(batteryExplorer, "phone-battery-selected-1440-dark");
await shot(dPage, "phone-battery-selected-1440-dark.png");

// Five-step line: battery → representative route (deep chain 1) via in-page link.
await dPage.locator(".exploded-actions a", { hasText: "代表性路线" }).first().click();
await dPage.waitForSelector(".route-page, .supply-chain-graph, .step-stack", { timeout: 10000 });
const routeUrl = dPage.url();
const routeHeading = await dPage.locator("h1, h2").first().textContent().catch(() => "");
ok("battery route deep chain loads in-page", routeUrl.includes("/supply-chain") && routeUrl.includes("focus=battery"), { url: routeUrl, heading: routeHeading });
ok("route page names the battery focus", /电池/.test(routeHeading ?? ""), { heading: routeHeading });
await shot(dPage, "route-battery-1440-dark.png");

// Route → ledger (country with a published ledger).
const ledgerLink = dPage.locator(".node-links a, .step-node-list a", { hasText: "国家账本" }).first();
const hasLedgerLink = (await ledgerLink.count()) > 0;
if (hasLedgerLink) {
  try {
    await Promise.all([
      dPage.waitForURL(u => u.pathname.includes("/ledger/"), { timeout: 10000 }),
      ledgerLink.click(),
    ]);
    await dPage.locator(".ledger-page").first().waitFor({ timeout: 10000 });
  } catch (e) { recordIssue("probe", "ledger navigation wait", { error: String(e?.message ?? e).split("\n")[0] }); }
}
const ledgerUrl = dPage.url();
ok("route reaches a country ledger without browser back", hasLedgerLink && ledgerUrl.includes("/ledger/"), { url: ledgerUrl, hasLedgerLink });
await shot(dPage, "ledger-au-1440-dark.png");

// Ledger → world map via in-page navigation.
await Promise.all([
  dPage.waitForURL(u => u.pathname.startsWith("/map"), { timeout: 10000 }),
  dPage.locator(".product-level-nav a", { hasText: "世界地图" }).first().click()
]);
await dPage.waitForSelector(".atlas-workspace, .world-country-map", { timeout: 10000 });
const mapUrl = dPage.url();
ok("ledger returns to the world map in-page", mapUrl.includes("/map"), { url: mapUrl });
await shot(dPage, "map-from-ledger-1440-dark.png");

/* -------------------------------------------------------------------------- */
/* 2. Direct deep chains                                                       */
/* -------------------------------------------------------------------------- */
const deepChains = [
  { id: "route-battery", path: "/products/generic-smartphone/supply-chain?focus=battery", marker: /电池/, markerLabel: "battery route heading" },
  { id: "route-lithium", path: "/products/generic-smartphone/supply-chain?focus=lithium", marker: /锂/, markerLabel: "lithium route heading" },
  { id: "map-route-battery", path: "/map?product=generic-smartphone&layer=supply-chain&focus=battery", marker: null, markerLabel: "map workspace" },
  { id: "map-route-lithium", path: "/map?product=generic-smartphone&layer=supply-chain&focus=lithium", marker: /锂|澳大利亚/, markerLabel: "lithium route node" },
  { id: "map-trade-lithium", path: "/map?product=generic-smartphone&layer=trade&items=lithium", marker: /283691|锂/, markerLabel: "lithium trade record" },
  { id: "ledger-au", path: "/products/generic-smartphone/ledger/country-au", marker: /澳大利亚/, markerLabel: "Australia ledger heading" }
];

for (const chain of deepChains) {
  const cPage = await desktop.newPage();
  attachErrorCapture(cPage, chain.id);
  const status = await gotoPage(cPage, chain.path, { waitSelector: "svg, .route-graph, .ledger-page, .step-stack" });
  await dismissGuide(cPage);
  const bodyText = await cPage.locator("body").innerText().catch(() => "");
  const hasMarker = chain.marker ? chain.marker.test(bodyText) : true;
  const state = await themeState(cPage);
  results.deepChains[chain.id] = { path: chain.path, status, hasMarker, markerLabel: chain.markerLabel, ...state };
  ok(`deep chain ${chain.id} resolves (${status})`, status === 200 && hasMarker, results.deepChains[chain.id]);
  ok(`deep chain ${chain.id} has no overflow`, !state.overflow, state);
  await shot(cPage, `${chain.id}-1440-dark.png`);
  await cPage.close();
}

/* -------------------------------------------------------------------------- */
/* 3. Light theme desktop                                                      */
/* -------------------------------------------------------------------------- */
await dPage.goto(base + "/products/generic-smartphone", { waitUntil: "domcontentloaded", timeout: 15000 });
await dismissGuide(dPage);
await dPage.waitForSelector(".exploded-three-wrap, .exploded-canvas-wrap, .exploded-iso", { timeout: 10000 }).catch(() => {});
await dPage.locator(".theme-switcher").click();
await dPage.waitForFunction(() => document.documentElement.dataset.theme === "light", { timeout: 3000 }).catch(() => {});
const lightExplorer = await readExplorer(dPage);
const lightState = await themeState(dPage);
observe("phone-1440-light", { ...lightState, explorer: lightExplorer });
ok("light theme phone explorer renders", lightExplorer.present && lightExplorer.mode === "procedural-3d", lightExplorer);
ok("light desktop has no horizontal overflow", !lightState.overflow, lightState);
checkLedgerNames(lightExplorer, "phone-1440-light");
await shot(dPage, "phone-1440-light.png");
await desktop.close();

/* -------------------------------------------------------------------------- */
/* 4. Mobile 390 dark + light                                                  */
/* -------------------------------------------------------------------------- */
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
const mPage = await mobile.newPage();
attachErrorCapture(mPage, "phone-390-dark");
await gotoPage(mPage, "/products/generic-smartphone", { waitSelector: ".exploded-explorer" });
await dismissGuide(mPage);
const mExplorer = await readExplorer(mPage);
const mState = await themeState(mPage);
observe("phone-390-dark", { ...mState, explorer: mExplorer, emulation: "390 viewport only" });
ok("390 dark explorer renders", mExplorer.present, mExplorer);
ok("390 dark has no horizontal overflow", !mState.overflow, mState);
checkLedgerNames(mExplorer, "phone-390-dark");
await shot(mPage, "phone-390-dark.png");

// Select lithium on mobile and verify its three entry points.
await mPage.locator(".exploded-node-list-item", { hasText: "锂" }).first().click();
await mPage.waitForTimeout(150);
const lithiumExplorer = await readExplorer(mPage);
const lithiumRouteMap = lithiumExplorer.actions.find((action) => action.href?.includes("items=lithium"));
const lithiumMaterial = lithiumExplorer.actions.find((action) => action.href?.includes("material=lithium"));
const lithiumLedger = lithiumExplorer.actions.find((action) => action.href?.includes("ledger/country-au"));
ok("lithium detail offers the trade map entry", Boolean(lithiumRouteMap), { actions: lithiumExplorer.actions });
ok("lithium detail offers the material trade entry", Boolean(lithiumMaterial), { actions: lithiumExplorer.actions });
ok("lithium detail offers the Australia ledger entry", Boolean(lithiumLedger), { actions: lithiumExplorer.actions });
ok("lithium Australia ledger button names 澳大利亚", Boolean(lithiumLedger && /澳大利亚/.test(lithiumLedger.label)), { label: lithiumLedger?.label });
checkLedgerNames(lithiumExplorer, "phone-lithium-390-dark");
await shot(mPage, "phone-lithium-390-dark.png");

await mPage.locator(".theme-switcher").click();
await mPage.waitForFunction(() => document.documentElement.dataset.theme === "light", { timeout: 3000 }).catch(() => {});
const mLightState = await themeState(mPage);
observe("phone-390-light", { ...mLightState, emulation: "390 viewport only" });
ok("390 light has no horizontal overflow", !mLightState.overflow, mLightState);
checkLedgerNames(mExplorer, "phone-390-light");
await shot(mPage, "phone-390-light.png");
await mobile.close();

/* -------------------------------------------------------------------------- */
/* 5. Isometric fallback for the other four products                          */
/* -------------------------------------------------------------------------- */
const isoProducts = [
  { id: "generic-soybean-oil", shot: "soybean-oil-iso-1440-dark.png" },
  { id: "generic-cotton-tshirt", shot: "cotton-tshirt-iso-1440-dark.png" },
  { id: "generic-electric-bicycle", shot: "electric-bicycle-iso-1440-dark.png" },
  { id: "generic-home-air-conditioner", shot: "home-ac-iso-1440-dark.png" }
];
const isoContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
for (const product of isoProducts) {
  const iPage = await isoContext.newPage();
  attachErrorCapture(iPage, `iso-${product.id}`);
  const status = await gotoPage(iPage, `/products/${product.id}`, { waitSelector: ".exploded-explorer" });
  await dismissGuide(iPage);
  const explorer = await readExplorer(iPage);
  const state = await themeState(iPage);
  observe(`iso-${product.id}`, { status, ...state, explorer });
  ok(`${product.id} uses the isometric fallback`, explorer.present && explorer.mode === "iso-layers", { mode: explorer.mode });
  ok(`${product.id} has no horizontal overflow`, !state.overflow, state);
  checkLedgerNames(explorer, `iso-${product.id}`);
  await shot(iPage, product.shot);
  await iPage.close();
}
await isoContext.close();

/* -------------------------------------------------------------------------- */
/* 6. Reduced motion fallback                                                  */
/* -------------------------------------------------------------------------- */
const motionContext = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
const rPage = await motionContext.newPage();
attachErrorCapture(rPage, "reduced-motion");
await gotoPage(rPage, "/products/generic-smartphone", { waitSelector: ".exploded-explorer" });
await dismissGuide(rPage);
const rExplorer = await readExplorer(rPage);
const rState = await themeState(rPage);
observe("reduced-motion", { ...rState, explorer: rExplorer });
ok("reduced-motion still renders the exploded view", rExplorer.present, rExplorer);
ok("reduced-motion has no overflow", !rState.overflow, rState);
checkLedgerNames(rExplorer, "reduced-motion");
await shot(rPage, "phone-reduced-motion.png");
await motionContext.close();

/* -------------------------------------------------------------------------- */
/* Error roll-up                                                               */
/* -------------------------------------------------------------------------- */
const allPageErrors = Object.values(results.pageErrors ?? {}).flat();
const allConsoleErrors = Object.values(results.consoleErrors ?? {}).flat().filter((m) => !/favicon\.ico/.test(m));
ok("no page errors across acceptance pages", allPageErrors.length === 0, { count: allPageErrors.length, messages: allPageErrors.slice(0, 5) });
ok("no console errors across acceptance pages", allConsoleErrors.length === 0, { count: allConsoleErrors.length, messages: allConsoleErrors.slice(0, 8) });

const passed = checks.filter((check) => check.passed).length;
const failed = checks.filter((check) => !check.passed);
results.summary = { total: checks.length, passed, failed: failed.length };
results.finishedAt = new Date().toISOString();

await writeFile(resolve(output, "result.json"), JSON.stringify(results, null, 2));

const report = [
  "# 批次3 体验重构验收报告",
  "",
  `- 时间：${results.startedAt} → ${results.finishedAt}`,
  `- 基线：${base}（单个 next start 生产实例，非 dev）`,
  `- 检查：${passed}/${checks.length} 通过${failed.length ? `，${failed.length} 失败` : ""}`,
  `- 页面错误：${allPageErrors.length}；控制台错误：${allConsoleErrors.length}`,
  "",
  "## 深链",
  ...Object.entries(results.deepChains).map(([id, chain]) => `- \`${chain.path}\` → HTTP ${chain.status}，标记「${chain.markerLabel}」${chain.hasMarker ? "命中" : "未命中"}${chain.overflow ? "，存在横溢" : ""}`),
  "",
  "## 未通过项",
  ...(failed.length === 0 ? ["- 无"] : failed.map((check) => `- ${check.name}：${JSON.stringify(check)}`)),
  "",
  "## 说明",
  "- 390 为桌面 Chrome 视口模拟，不代表真机 GPU/触屏实测。",
  "- 装配体/零件层级缺口按真实 BOM 字段保留，未伪造父子关系。"
].join("\n");
await writeFile(resolve(output, "acceptance-report.md"), report);

await browser.close();
console.log(JSON.stringify(results.summary, null, 2));
if (failed.length > 0) process.exit(1);
