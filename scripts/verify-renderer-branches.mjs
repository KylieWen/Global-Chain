/**
 * Renderer-branch regression (model-switch 2026-11).
 *
 * Drives an already-running local Next production instance with Playwright +
 * installed Chrome. Covers the WebGL / Canvas2D fallback branches of both the
 * exploded breakdown viewer and the world map beam layer, the reduced-motion
 * routing, the exploded fallback signal, the map chrome row structure and the
 * home hero flow collapse/expand. Does not touch business source, data, docs
 * or the public site; no new dependencies.
 *
 * Usage:
 *   REVIEW_BASE_URL=http://127.0.0.1:4320 \
 *   REVIEW_OUTPUT_DIR=output/qa/model-switch-2026-11-25/regression-final/verify-renderer-branches \
 *   node scripts/verify-renderer-branches.mjs
 *
 * Renderer contracts (verified against components):
 *   - Exploded: localStorage `globe-chain:exploded-renderer` = webgl|canvas2d;
 *     `.exploded-explorer[data-fallback]`; `.exploded-three-wrap`
 *     (data-renderer=webgl) shares the base `.exploded-canvas-wrap` class; the
 *     kept 2D fallback carries only the base class (data-renderer=canvas2d);
 *     reduced motion routes to 2D; fallback reasons webgl-unavailable /
 *     import-failed / context-lost / low-frame-rate.
 *   - Map: localStorage `globechain-map-renderer` = canvas2d|webgl;
 *     `.beam-layer-host[data-renderer]`; WebGL branch hosts `.beam-webgl-host`.
 *   - Map chrome: `.site-header--map` 64px scoped bar + `.atlas-topline` 56px;
 *     `.atlas-compact-filters` is an absolute floating capsule, not a flow row.
 *   - Home hero: first 8 reportable flows shown; `.home-hero-more` expands the
 *     rest, then reads 收起主流向.
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const base = process.env.REVIEW_BASE_URL ?? "http://127.0.0.1:4320";
const output = resolve(process.env.REVIEW_OUTPUT_DIR ?? "output/qa/model-switch-2026-11-25/regression-final/verify-renderer-branches");
await mkdir(output, { recursive: true });

const SOY_URL = "/map?product=generic-soybean-oil&items=generic-soybean-oil%2Csoybean%2Ccrude-soybean-oil&year=2024";
const PHONE_PRODUCT = "/products/generic-smartphone";

const results = {
  base,
  startedAt: new Date().toISOString(),
  browser: {},
  checks: [],
  observations: [],
  pageErrors: {},
  consoleErrors: {},
  defects: []
};

const checks = results.checks;
const ok = (name, passed, detail = {}) => checks.push({ name, passed, ...detail });
const observe = (section, detail) => results.observations.push({ section, ...detail });
const defect = (title, detail) => results.defects.push({ title, ...detail });

function attachErrorCapture(page, label) {
  results.pageErrors[label] = [];
  results.consoleErrors[label] = [];
  page.on("pageerror", error => results.pageErrors[label].push(String(error?.message ?? error)));
  page.on("console", message => {
    if (message.type() === "error") {
      results.consoleErrors[label].push(message.text().slice(0, 300));
    }
  });
}

async function dismissGuide(page) {
  const dialog = page.getByRole("dialog", { name: "Global Chain 新手引导", exact: true });
  try {
    await dialog.waitFor({ state: "visible", timeout: 2000 });
    await dialog.locator('[data-guide-action="skip"]').click();
    await dialog.waitFor({ state: "detached", timeout: 2000 });
  } catch { /* already closed or absent */ }
}

async function shot(page, name) {
  await page.screenshot({ path: resolve(output, name), fullPage: false });
}

const SKIP_GUIDE = () => localStorage.setItem("global-chain.first-visit-guide.v1", "skipped");

/** Exploded viewer probe. Runs inside the page. */
function probeExploded() {
  const root = document.querySelector(".exploded-explorer");
  if (!root) return { present: false };
  const three = root.querySelector(".exploded-three-wrap");
  const two = root.querySelector(".exploded-canvas-wrap:not(.exploded-three-wrap)");
  const procedural = three ?? two;
  const items = [...root.querySelectorAll(".exploded-node-list-item")];
  const active = items.find(i => i.getAttribute("aria-pressed") === "true");
  return {
    present: true,
    fallback: root.dataset.fallback || null,
    renderer: procedural?.dataset.renderer ?? null,
    threeWrap: Boolean(three),
    twoWrap: Boolean(two),
    canvases: procedural?.querySelectorAll("canvas").length ?? 0,
    strip: root.querySelectorAll(".exploded-material-strip").length,
    chips: root.querySelectorAll(".exploded-material-strip-chip").length,
    nodeItems: items.length,
    nodeLabel: root.querySelector(".exploded-node-list")?.getAttribute("aria-label") ?? null,
    detailH3: root.querySelector(".exploded-detail-header h3")?.textContent.trim() ?? null,
    slider: Boolean(root.querySelector('.exploded-slider input[type="range"]')),
    reset: root.querySelectorAll(".exploded-reset").length,
    activeLabel: active?.textContent.trim() ?? null
  };
}

/** Map beam-layer probe. Runs inside the page. */
function probeMap() {
  const host = document.querySelector(".beam-layer-host");
  const svg = document.querySelector(".world-country-map");
  const compact = document.querySelector(".atlas-compact-filters");
  return {
    renderer: host?.dataset.renderer ?? null,
    canvases: host?.querySelectorAll("canvas").length ?? 0,
    webglHost: document.querySelectorAll(".beam-webgl-host").length,
    svg: Boolean(svg),
    labels: document.querySelectorAll(".atlas-country-labels text").length,
    labelOverlay: document.querySelectorAll(".atlas-label-overlay").length,
    zoomButtons: document.querySelectorAll(".map-zoom-controls button").length,
    records: document.querySelectorAll(".atlas-record").length,
    compactPosition: compact ? getComputedStyle(compact).position : null
  };
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
results.browser.name = "Chrome (Playwright channel=chrome)";
results.browser.headless = true;
results.browser.launchedAt = new Date().toISOString();

try {
  /* ---------------------------------------------------------------------- */
  /* A. Exploded default branch                                             */
  /* ---------------------------------------------------------------------- */
  const defCtx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await defCtx.addInitScript(SKIP_GUIDE);
  const defPage = await defCtx.newPage();
  attachErrorCapture(defPage, "exploded-default");
  await defPage.goto(base + PHONE_PRODUCT, { waitUntil: "networkidle", timeout: 60000 });
  await dismissGuide(defPage);
  await defPage.waitForSelector(".exploded-three-wrap, .exploded-canvas-wrap, .exploded-iso", { timeout: 10000 }).catch(() => {});
  const defExp = await defPage.evaluate(probeExploded);
  observe("exploded-default", defExp);
  ok("exploded default: explorer mounted", defExp.present, defExp);
  ok("exploded default: renderer signal recorded", ["webgl", "canvas2d"].includes(defExp.renderer ?? ""), defExp);
  if (defExp.renderer === "webgl") {
    ok("exploded default: WebGL wrap with material strip", defExp.threeWrap && defExp.strip >= 1 && defExp.chips >= 1 && defExp.canvases === 1, defExp);
  } else {
    ok("exploded default: kept 2D wrap mounted", defExp.twoWrap && defExp.canvases === 1, defExp);
  }
  ok("exploded default: node list labelled 全部部件列表", defExp.nodeLabel === "全部部件列表" && defExp.nodeItems >= 1, defExp);
  ok("exploded default: detail card, slider and reset present", Boolean(defExp.detailH3) && defExp.slider && defExp.reset >= 1, defExp);

  // Real interaction: move selection through the node list, drive the slider, reset.
  const defItems = defPage.locator(".exploded-node-list-item");
  const defCount = await defItems.count();
  let defClicked = null;
  for (let i = 0; i < defCount; i += 1) {
    const item = defItems.nth(i);
    if ((await item.getAttribute("aria-pressed")) !== "true") {
      await item.click();
      defClicked = i;
      break;
    }
  }
  await defPage.waitForTimeout(200);
  const defAfter = await defPage.evaluate(probeExploded);
  ok("exploded default: node-list click moves selection", defClicked !== null && defAfter.activeLabel !== defExp.activeLabel, { before: defExp.activeLabel, after: defAfter.activeLabel, clicked: defClicked });
  await defPage.locator('.exploded-slider input[type="range"]').fill("0.9");
  await defPage.locator('.exploded-slider input[type="range"]').dispatchEvent("input");
  const defSlider = await defPage.locator('.exploded-slider input[type="range"]').inputValue();
  await defPage.locator(".exploded-reset").click();
  ok("exploded default: slider accepts real input", defSlider === "0.9", { slider: defSlider });
  await shot(defPage, "exploded-default.png");
  await defCtx.close();

  /* ---------------------------------------------------------------------- */
  /* B. Exploded forced Canvas2D                                             */
  /* ---------------------------------------------------------------------- */
  const twoCtx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await twoCtx.addInitScript(SKIP_GUIDE);
  await twoCtx.addInitScript(() => localStorage.setItem("globe-chain:exploded-renderer", "canvas2d"));
  const twoPage = await twoCtx.newPage();
  attachErrorCapture(twoPage, "exploded-forced-2d");
  await twoPage.goto(base + PHONE_PRODUCT, { waitUntil: "networkidle", timeout: 60000 });
  await dismissGuide(twoPage);
  await twoPage.waitForSelector(".exploded-three-wrap, .exploded-canvas-wrap, .exploded-iso", { timeout: 10000 }).catch(() => {});
  const twoExp = await twoPage.evaluate(probeExploded);
  observe("exploded-forced-2d", twoExp);
  ok("exploded 2D: forced canvas2d renders 2D wrap", twoExp.present && twoExp.renderer === "canvas2d" && twoExp.twoWrap && !twoExp.threeWrap, twoExp);
  ok("exploded 2D: material strip is WebGL-only by design", twoExp.strip === 0 && twoExp.chips === 0, twoExp);
  ok("exploded 2D: node list, detail card and controls retained", twoExp.nodeItems >= 1 && Boolean(twoExp.detailH3) && twoExp.slider && twoExp.reset >= 1, twoExp);
  const twoItems = twoPage.locator(".exploded-node-list-item");
  let twoClicked = null;
  for (let i = 0; i < await twoItems.count(); i += 1) {
    const item = twoItems.nth(i);
    if ((await item.getAttribute("aria-pressed")) !== "true") { await item.click(); twoClicked = i; break; }
  }
  await twoPage.waitForTimeout(200);
  const twoAfter = await twoPage.evaluate(probeExploded);
  ok("exploded 2D: node-list click still moves selection", twoClicked !== null && twoAfter.activeLabel !== twoExp.activeLabel, { before: twoExp.activeLabel, after: twoAfter.activeLabel });
  await shot(twoPage, "exploded-forced-2d.png");
  await twoCtx.close();

  /* ---------------------------------------------------------------------- */
  /* C. Exploded reduced motion routes to 2D                                 */
  /* ---------------------------------------------------------------------- */
  const motionCtx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  await motionCtx.addInitScript(SKIP_GUIDE);
  const motionPage = await motionCtx.newPage();
  attachErrorCapture(motionPage, "exploded-reduced-motion");
  await motionPage.goto(base + PHONE_PRODUCT, { waitUntil: "networkidle", timeout: 60000 });
  await dismissGuide(motionPage);
  await motionPage.waitForSelector(".exploded-three-wrap, .exploded-canvas-wrap, .exploded-iso", { timeout: 10000 }).catch(() => {});
  const motionExp = await motionPage.evaluate(probeExploded);
  observe("exploded-reduced-motion", motionExp);
  ok("exploded reduced-motion: routes to Canvas2D", motionExp.present && motionExp.renderer === "canvas2d" && !motionExp.threeWrap, motionExp);
  ok("exploded reduced-motion: explorer still usable", motionExp.nodeItems >= 1 && Boolean(motionExp.detailH3) && motionExp.slider, motionExp);
  await shot(motionPage, "exploded-reduced-motion.png");
  await motionCtx.close();

  /* ---------------------------------------------------------------------- */
  /* D. Exploded fallback signal: WebGL context unavailable                 */
  /* ---------------------------------------------------------------------- */
  const fallbackCtx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await fallbackCtx.addInitScript(SKIP_GUIDE);
  await fallbackCtx.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (String(type).toLowerCase().includes("webgl")) return null;
      return original.call(this, type, ...args);
    };
  });
  const fallbackPage = await fallbackCtx.newPage();
  attachErrorCapture(fallbackPage, "exploded-fallback-signal");
  await fallbackPage.goto(base + PHONE_PRODUCT, { waitUntil: "networkidle", timeout: 60000 });
  await dismissGuide(fallbackPage);
  await fallbackPage.waitForSelector(".exploded-three-wrap, .exploded-canvas-wrap, .exploded-iso", { timeout: 10000 }).catch(() => {});
  const fallbackExp = await fallbackPage.evaluate(probeExploded);
  observe("exploded-fallback-signal", fallbackExp);
  ok("exploded fallback: records webgl-unavailable signal", fallbackExp.fallback === "webgl-unavailable", fallbackExp);
  ok("exploded fallback: degrades to 2D wrap without crash", fallbackExp.present && fallbackExp.renderer === "canvas2d", fallbackExp);
  await shot(fallbackPage, "exploded-fallback-webgl-unavailable.png");
  await fallbackCtx.close();

  /* ---------------------------------------------------------------------- */
  /* E. Map default branch                                                   */
  /* ---------------------------------------------------------------------- */
  const mapDefCtx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await mapDefCtx.addInitScript(SKIP_GUIDE);
  const mapDefPage = await mapDefCtx.newPage();
  attachErrorCapture(mapDefPage, "map-default");
  await mapDefPage.goto(base + SOY_URL, { waitUntil: "networkidle", timeout: 60000 });
  await dismissGuide(mapDefPage);
  await mapDefPage.waitForFunction(() => {
    const host = document.querySelector(".beam-layer-host");
    return host && host.dataset.renderer !== "pending";
  }, { timeout: 8000 }).catch(() => {});
  const mapDef = await mapDefPage.evaluate(probeMap);
  observe("map-default", mapDef);
  ok("map default: beam host mounted with renderer signal", ["webgl", "canvas2d"].includes(mapDef.renderer ?? ""), mapDef);
  ok("map default: beam canvas and country SVG present", mapDef.canvases >= 1 && mapDef.svg, mapDef);
  ok("map default: zoom controls and records present", mapDef.zoomButtons >= 3 && mapDef.records > 0, mapDef);
  if (mapDef.renderer === "webgl") {
    ok("map default: WebGL host present", mapDef.webglHost === 1, mapDef);
  } else {
    ok("map default: Canvas2D host with no WebGL wrapper", mapDef.webglHost === 0, mapDef);
  }
  await shot(mapDefPage, "map-default.png");
  await mapDefCtx.close();

  /* ---------------------------------------------------------------------- */
  /* F. Map forced Canvas2D + interaction                                    */
  /* ---------------------------------------------------------------------- */
  const mapTwoCtx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await mapTwoCtx.addInitScript(SKIP_GUIDE);
  await mapTwoCtx.addInitScript(() => localStorage.setItem("globechain-map-renderer", "canvas2d"));
  const mapTwoPage = await mapTwoCtx.newPage();
  attachErrorCapture(mapTwoPage, "map-forced-2d");
  await mapTwoPage.goto(base + SOY_URL, { waitUntil: "networkidle", timeout: 60000 });
  await dismissGuide(mapTwoPage);
  await mapTwoPage.waitForFunction(() => {
    const host = document.querySelector(".beam-layer-host");
    return host && host.dataset.renderer !== "pending";
  }, { timeout: 8000 }).catch(() => {});
  const mapTwo = await mapTwoPage.evaluate(probeMap);
  observe("map-forced-2d", mapTwo);
  ok("map 2D: forced canvas2d host, no WebGL wrapper", mapTwo.renderer === "canvas2d" && mapTwo.webglHost === 0 && mapTwo.canvases >= 1, mapTwo);
  ok("map 2D: country SVG retained", mapTwo.svg && mapTwo.records > 0, mapTwo);

  // Zoom in / reset still work on the 2D branch.
  const mapSvgGroup = mapTwoPage.locator(".world-country-map g").first();
  const transformBefore = await mapSvgGroup.getAttribute("transform");
  await mapTwoPage.locator('.map-zoom-controls button[aria-label="放大地图"]').click();
  const transformZoomed = await mapSvgGroup.getAttribute("transform");
  ok("map 2D: zoom-in changes transform", transformBefore !== transformZoomed, { transformBefore, transformZoomed });
  await mapTwoPage.locator('.map-zoom-controls button:has-text("复位")').click();
  const transformReset = await mapSvgGroup.getAttribute("transform");
  ok("map 2D: reset restores default framing", transformReset === transformBefore, { transformBefore, transformReset });

  // Filter capsule opens its body on the 2D branch.
  const mapToggle = mapTwoPage.locator(".atlas-filters-toggle");
  if (await mapToggle.count()) {
    await mapToggle.first().click();
    await mapTwoPage.waitForTimeout(150);
    const bodyOpen = await mapTwoPage.locator("#atlas-filters-body").getAttribute("data-open");
    ok("map 2D: filter capsule body opens", bodyOpen === "true", { bodyOpen });
  } else {
    ok("map 2D: filter capsule toggle present", false, { note: ".atlas-filters-toggle not found" });
  }
  await shot(mapTwoPage, "map-forced-2d.png");
  await mapTwoCtx.close();

  /* ---------------------------------------------------------------------- */
  /* G. Map forced WebGL                                                     */
  /* ---------------------------------------------------------------------- */
  const mapWebglCtx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await mapWebglCtx.addInitScript(SKIP_GUIDE);
  await mapWebglCtx.addInitScript(() => localStorage.setItem("globechain-map-renderer", "webgl"));
  const mapWebglPage = await mapWebglCtx.newPage();
  attachErrorCapture(mapWebglPage, "map-forced-webgl");
  await mapWebglPage.goto(base + SOY_URL, { waitUntil: "networkidle", timeout: 60000 });
  await dismissGuide(mapWebglPage);
  await mapWebglPage.waitForFunction(() => {
    const host = document.querySelector(".beam-layer-host");
    return host && host.dataset.renderer !== "pending";
  }, { timeout: 8000 }).catch(() => {});
  const mapWebgl = await mapWebglPage.evaluate(probeMap);
  observe("map-forced-webgl", mapWebgl);
  if (mapWebgl.renderer === "webgl") {
    ok("map WebGL: forced webgl host with WebGL wrapper", mapWebgl.webglHost === 1 && mapWebgl.canvases >= 1, mapWebgl);
  } else {
    // Headless GPU/software WebGL unavailable: the layer degrades to 2D. Record
    // the actual branch instead of claiming a WebGL run.
    ok("map WebGL: forced webgl resolved (degraded to 2D in this environment)", mapWebgl.renderer === "canvas2d", { degraded: true, ...mapWebgl });
    defect("map WebGL branch could not render in headless environment", { actualRenderer: mapWebgl.renderer, webglHost: mapWebgl.webglHost });
  }
  await shot(mapWebglPage, "map-forced-webgl.png");
  await mapWebglCtx.close();

  /* ---------------------------------------------------------------------- */
  /* H. Map chrome row structure (wide)                                     */
  /* ---------------------------------------------------------------------- */
  const chromeCtx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await chromeCtx.addInitScript(SKIP_GUIDE);
  const chromePage = await chromeCtx.newPage();
  attachErrorCapture(chromePage, "map-chrome");
  await chromePage.goto(base + SOY_URL, { waitUntil: "networkidle", timeout: 60000 });
  await dismissGuide(chromePage);
  const chrome = await chromePage.evaluate(() => {
    const header = document.querySelector(".site-header");
    const topline = document.querySelector(".atlas-topline");
    const compact = document.querySelector(".atlas-compact-filters");
    const pageRoot = document.querySelector(".atlas-page");
    const flowKids = pageRoot ? [...pageRoot.children].map(el => el.className) : [];
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x * 10) / 10, y: Math.round(r.y * 10) / 10, w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 };
    };
    return {
      headerClass: header?.className ?? null,
      headerHeight: rect(header)?.h ?? null,
      toplineHeight: rect(topline)?.h ?? null,
      compactPosition: compact ? getComputedStyle(compact).position : null,
      compactInFlowKids: flowKids.some(c => String(c).includes("atlas-compact-filters")),
      flowKids,
      compactRect: rect(compact)
    };
  });
  observe("map-chrome", chrome);
  ok("map chrome: scoped 64px header", /site-header--map/.test(chrome.headerClass ?? "") && Math.abs((chrome.headerHeight ?? 0) - 64) <= 4, chrome);
  ok("map chrome: 56px topline row", Math.abs((chrome.toplineHeight ?? 0) - 56) <= 4, chrome);
  ok("map chrome: filter capsule floats absolute, not a flow row", chrome.compactPosition === "absolute" && !chrome.compactInFlowKids, chrome);

  // Non-map page keeps the shared 77px header without the map scope class.
  await chromePage.goto(base + PHONE_PRODUCT, { waitUntil: "networkidle", timeout: 60000 });
  await dismissGuide(chromePage);
  const plainHeader = await chromePage.evaluate(() => {
    const header = document.querySelector(".site-header");
    const r = header?.getBoundingClientRect();
    return { class: header?.className ?? null, height: r ? Math.round(r.height * 10) / 10 : null };
  });
  observe("plain-header", plainHeader);
  // Shared non-overlay header inner min-height is 4.35rem (≈69.6px + 1px border);
  // the 4.75rem overlay bar applies only to home/map. Assert the shipped shared
  // height and the absence of the map scope class.
  ok("plain page: shared header without map scope", !/site-header--map/.test(plainHeader.class ?? "") && Math.abs((plainHeader.height ?? 0) - 70) <= 4, plainHeader);
  await shot(chromePage, "map-chrome.png");
  await chromeCtx.close();

  /* ---------------------------------------------------------------------- */
  /* I. Home hero collapse / expand                                          */
  /* ---------------------------------------------------------------------- */
  const homeCtx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await homeCtx.addInitScript(SKIP_GUIDE);
  const homePage = await homeCtx.newPage();
  attachErrorCapture(homePage, "home-hero");
  await homePage.goto(base + "/", { waitUntil: "networkidle", timeout: 60000 });
  await dismissGuide(homePage);
  const homeBefore = await homePage.evaluate(() => ({
    lines: document.querySelectorAll(".home-hero-line").length,
    endpoints: document.querySelectorAll(".home-hero-endpoint").length,
    more: document.querySelector(".home-hero-more")?.textContent.trim() ?? null,
    expanded: document.querySelector(".home-hero-more")?.getAttribute("aria-expanded") ?? null
  }));
  observe("home-hero-before", homeBefore);
  ok("home hero: default shows at most 8 featured flows", homeBefore.lines >= 1 && homeBefore.lines <= 8, homeBefore);
  ok("home hero: expand entry present with collapsed state", Boolean(homeBefore.more) && /展开其余 \d+ 条流向/.test(homeBefore.more) && homeBefore.expanded === "false", homeBefore);

  await homePage.locator(".home-hero-more").click();
  await homePage.waitForTimeout(200);
  const homeAfter = await homePage.evaluate(() => ({
    lines: document.querySelectorAll(".home-hero-line").length,
    more: document.querySelector(".home-hero-more")?.textContent.trim() ?? null,
    expanded: document.querySelector(".home-hero-more")?.getAttribute("aria-expanded") ?? null
  }));
  observe("home-hero-after", homeAfter);
  ok("home hero: expand reveals the remaining flows", homeAfter.lines > homeBefore.lines && homeAfter.expanded === "true" && /收起主流向/.test(homeAfter.more ?? ""), { before: homeBefore.lines, after: homeAfter.lines, more: homeAfter.more });
  await shot(homePage, "home-hero-expanded.png");
  await homeCtx.close();

  /* ---------------------------------------------------------------------- */
  /* J. Mobile exploded slider stays inside the 390 viewport                */
  /* ---------------------------------------------------------------------- */
  const mobileCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await mobileCtx.addInitScript(SKIP_GUIDE);
  const mobilePage = await mobileCtx.newPage();
  attachErrorCapture(mobilePage, "exploded-mobile");
  await mobilePage.goto(base + PHONE_PRODUCT, { waitUntil: "networkidle", timeout: 60000 });
  await dismissGuide(mobilePage);
  await mobilePage.waitForSelector(".exploded-slider", { timeout: 10000 }).catch(() => {});
  const mobileSlider = await mobilePage.evaluate(() => {
    const input = document.querySelector('.exploded-slider input[type="range"]');
    if (!input) return null;
    const r = input.getBoundingClientRect();
    return { x: Math.round(r.x * 10) / 10, y: Math.round(r.y * 10) / 10, w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10, bottom: Math.round((r.y + r.height) * 10) / 10, viewport: window.innerHeight };
  });
  observe("exploded-mobile-slider", mobileSlider);
  ok("exploded mobile: slider inside 390 viewport", Boolean(mobileSlider) && mobileSlider.bottom <= mobileSlider.viewport - 4, mobileSlider);
  await shot(mobilePage, "exploded-mobile-390.png");
  await mobileCtx.close();
} finally {
  await browser.close();
}

const summary = {
  total: checks.length,
  passed: checks.filter(c => c.passed).length,
  failed: checks.filter(c => !c.passed).length
};
results.finishedAt = new Date().toISOString();
results.summary = summary;
await writeFile(resolve(output, "result.json"), JSON.stringify(results, null, 2));
console.log(JSON.stringify({ summary, defects: results.defects, checks: checks.map(c => ({ name: c.name, passed: c.passed })) }, null, 2));
if (summary.failed > 0) process.exit(1);
