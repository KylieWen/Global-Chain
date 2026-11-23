/**
 * Batch 2 (experience rebuild 2026-11) independent browser acceptance — FINAL.
 *
 * Drives an already-running Next production instance (next start, never dev)
 * with Playwright + installed Chrome in isolated browser contexts. Does not
 * touch business source, data, docs, the public site or Qoder. It must not
 * start/stop the server, rebuild, or modify .next.
 *
 * Probe rules for this final round:
 *   - Config export is accepted only from the real clipboard or a visible
 *     textarea fallback; a localStorage snapshot is NOT a valid export.
 *   - Timeline changes come from real keyboard events / real mouse drags.
 *     A `goto ?year=` fallback can never turn a failed interaction into a
 *     pass. After each interaction the range thumb, visible year label and
 *     URL query must agree with each other.
 *   - Selectors follow the shipped markup: workspace `.atlas-workspace`
 *     (+ `.beam-mode`), record detail `.record-drawer[role=dialog]`.
 *
 * Coverage (per rebuild plan batch 2):
 *   - Soybean oil three-item beam / classic rendering, dark + light, 1440/390
 *   - Record drawer: click + keyboard open, Esc + backdrop close, source /
 *     method retained, no duplicate drawer, amount/quantity contrast
 *   - Multi-item checkboxes; flow settings drawer: 6 sliders, reset,
 *     persistence across reload, real copy/import, invalid JSON
 *   - Mode persistence across reload; reduced-motion static fallback;
 *     restricted storage; zoom / pan; 10x stress cleanup
 *   - Smartphone 2023→2025 timeline: real keyboard, drag, play/pause,
 *     reload restore; 390 viewport-only (no device emulation), no overflow
 *   - rAF frame sampling (median / P95 / max / long-frame ratio) with
 *     particle diagnostics and environment; no fabricated GPU conclusions.
 *
 * Usage:
 *   REVIEW_BASE_URL=http://127.0.0.1:4320 \
 *   REVIEW_OUTPUT_DIR=output/qa/experience-rebuild-2026-11/batch-2-final \
 *   node scripts/verify-experience-batch2.mjs
 *
 * Exit code: 0 all checks passed; 1 at least one failed check.
 */
import { chromium } from "playwright";
import { mkdir, writeFile, stat, copyFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const base = process.env.REVIEW_BASE_URL ?? "http://127.0.0.1:4320";
const output = resolve(process.env.REVIEW_OUTPUT_DIR ?? "output/qa/experience-rebuild-2026-11/batch-2-final");
await mkdir(output, { recursive: true });

const SOY_URL = "/map?product=generic-soybean-oil&items=generic-soybean-oil%2Csoybean%2Ccrude-soybean-oil&year=2024";
const PHONE_URL = "/map?product=generic-smartphone&layer=trade&scope=bilateral&items=generic-smartphone&direction=import&currency=USD&country=country-us";

const results = {
  base,
  startedAt: new Date().toISOString(),
  browser: {},
  checks: [],
  observations: [],
  pages: [],
  performance: {},
  stress: {},
  video: {},
  issues: []
};

const checks = results.checks;
const ok = (name, passed, detail = {}) => checks.push({ name, passed: Boolean(passed), ...detail });
const observe = (section, data) => results.observations.push({ section, ...data });
function recordIssue(severity, title, detail) { results.issues.push({ severity, title, detail }); }

async function shot(page, name) {
  await page.screenshot({ path: resolve(output, name), fullPage: false });
}

async function reloadWithRetry(page, retries = 4) {
  for (let i = 0; i <= retries; i++) {
    try {
      return await page.reload({ waitUntil: "domcontentloaded", timeout: 15000 });
    } catch (e) {
      const msg = String(e?.message ?? e);
      if (/REFUSED|ECONNREFUSED|net::ERR_|timeout/i.test(msg) && i < retries) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      throw e;
    }
  }
}

async function dismissGuide(page) {
  const dialog = page.getByRole("dialog", { name: "Global Chain 新手引导", exact: true });
  try {
    await dialog.waitFor({ state: "visible", timeout: 2000 });
    await dialog.locator('[data-guide-action="skip"]').click();
    await dialog.waitFor({ state: "detached", timeout: 2000 });
    return true;
  } catch { /* already closed or absent */ }
  return false;
}

async function gotoPage(page, path, { waitSelector, retries = 4 } = {}) {
  let response = null;
  let lastError = null;
  for (let i = 0; i <= retries; i++) {
    try {
      response = await page.goto(base + path, { waitUntil: "domcontentloaded", timeout: 15000 });
      lastError = null;
      break;
    } catch (e) {
      lastError = e;
      const msg = String(e?.message ?? e);
      if (/ERR_CONNECTION_REFUSED|ECONNREFUSED|net::ERR_|Navigation timeout/i.test(msg) && i < retries) {
        await new Promise(r => setTimeout(r, 2000));
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
  await dismissGuide(page);
  return response?.status();
}

function attachErrorCapture(page, label) {
  results.pageErrors ??= {};
  results.consoleErrors ??= {};
  results.pageErrors[label] = [];
  results.consoleErrors[label] = [];
  page.on("pageerror", error => results.pageErrors[label].push(String(error?.message ?? error)));
  page.on("console", message => {
    if (message.type() === "error") {
      const location = message.location();
      const source = location.url ? ` [${location.url}:${location.lineNumber ?? 0}]` : "";
      results.consoleErrors[label].push((message.text().slice(0, 300) + source));
    }
  });
}

function summarizeErrors(label) {
  const pageErrors = results.pageErrors[label] ?? [];
  const allConsole = results.consoleErrors[label] ?? [];
  const consoleErrors = allConsole.filter(m => !/favicon\.ico/.test(m));
  return {
    pageErrorCount: pageErrors.length,
    consoleErrorCount: consoleErrors.length,
    favicon404: allConsole.some(m => /favicon\.ico/.test(m)),
    pageErrorMessages: pageErrors.slice(0, 5),
    consoleErrorMessages: consoleErrors.slice(0, 8)
  };
}

async function themeState(page) {
  return page.evaluate(() => ({
    theme: document.documentElement.dataset.theme ?? null,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
  }));
}

async function readWorkspace(page) {
  return page.evaluate(() => {
    const w = document.querySelector(".atlas-workspace");
    const chips = [...document.querySelectorAll(".atlas-item-chip")].map(c => {
      const swatch = c.querySelector("i");
      return { label: c.textContent.replace(/×\s*$/, "").trim(), color: swatch ? getComputedStyle(swatch).backgroundColor : null };
    });
    const productSelect = document.querySelector('.atlas-compact-filters select[aria-label="选择商品"]');
    return {
      mode: w?.dataset.flowMode ?? null,
      workspaceClass: w?.className ?? null,
      beamMode: w?.classList.contains("beam-mode") ?? false,
      particles: Number(w?.dataset.particleCount ?? NaN),
      cap: Number(w?.dataset.flowCap ?? NaN),
      level: w?.dataset.adaptiveLevel ?? null,
      canvas: document.querySelectorAll(".beam-layer canvas").length,
      lines: document.querySelectorAll(".atlas-line-visible").length,
      labels: document.querySelectorAll(".atlas-country-labels text").length,
      records: document.querySelectorAll(".atlas-record").length,
      productSelect: productSelect?.value ?? null,
      chips
    };
  });
}

async function readStoredTheme(page) {
  return page.evaluate(() => {
    try { return JSON.parse(window.localStorage.getItem("globechain-theme") ?? "null"); }
    catch { return "unparseable"; }
  });
}

function parseRgb(color) {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color ?? "");
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}
function luminance(rgb) {
  if (!rgb) return null;
  const [r, g, b] = rgb.map(v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrastRatio(fg, bg) {
  const l1 = luminance(parseRgb(fg));
  const l2 = luminance(parseRgb(bg));
  if (l1 === null || l2 === null) return null;
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return Number(((hi + 0.05) / (lo + 0.05)).toFixed(2));
}

async function lineProbe(page) {
  return page.evaluate(() => {
    const w = document.querySelector(".atlas-workspace");
    const lines = [...document.querySelectorAll(".atlas-line-visible")].map(el => {
      const g = el.closest(".country-trade-line");
      return {
        opacity: getComputedStyle(el).opacity,
        active: g?.classList.contains("is-active") ?? false,
        muted: g?.classList.contains("is-muted") ?? false
      };
    });
    return { sectionClass: w?.className ?? "", mode: w?.dataset.flowMode ?? null, count: lines.length, lines };
  });
}

/** Read the record drawer (.record-drawer[role=dialog]) state. */
async function readDrawer(page) {
  return page.evaluate(() => {
    const drawers = [...document.querySelectorAll('.record-drawer[role="dialog"]')];
    const d = drawers[0];
    if (!d) return { count: drawers.length, open: false };
    const heading = d.querySelector("#map-record-title")?.textContent.trim() ?? "";
    const source = d.querySelector(".atlas-near-source")?.textContent.trim() ?? "";
    const methodDt = [...d.querySelectorAll(".atlas-provenance dt")].find(x => x.textContent.trim() === "方法");
    const method = methodDt?.nextElementSibling?.textContent.trim() ?? "";
    const versionDt = [...d.querySelectorAll(".atlas-provenance dt")].find(x => x.textContent.trim() === "数据版本");
    const datasetVersion = versionDt?.nextElementSibling?.textContent.trim() ?? "";
    const panelBg = getComputedStyle(d).backgroundColor;
    const rootBg = getComputedStyle(document.documentElement).getPropertyValue("--bg-elevated").trim();
    const dds = [...d.querySelectorAll(".atlas-values dd")].map(el => ({ text: el.textContent.trim(), color: getComputedStyle(el).color }));
    const dts = [...d.querySelectorAll(".atlas-values dt")].map(el => ({ text: el.textContent.trim(), color: getComputedStyle(el).color }));
    return { count: drawers.length, open: true, heading, source, method, datasetVersion, panelBg, rootBg, dds, dts };
  });
}

const RAF_INIT = `(() => {
  const collector = { samples: [], loops: 0 };
  window.__rafCollector = collector;
  const raf = window.requestAnimationFrame.bind(window);
  let last = 0;
  window.requestAnimationFrame = (cb) => {
    collector.loops++;
    return raf((t) => {
      collector.loops--;
      const now = typeof t === "number" ? t : performance.now();
      if (last) collector.samples.push(now - last);
      last = now;
      cb(t);
    });
  };
})();`;

async function sampleRaf(page, seconds) {
  await page.evaluate(() => { window.__rafCollector.samples.length = 0; });
  await page.waitForTimeout(seconds * 1000);
  return page.evaluate(() => {
    const raw = [...window.__rafCollector.samples].filter(d => d > 0 && d <= 200);
    const s = [...raw].sort((a, b) => a - b);
    const n = s.length;
    const pct = p => n ? s[Math.min(n - 1, Math.floor(p * (n - 1)))] : null;
    const long = s.filter(d => d > 28).length;
    return {
      n,
      medianMs: pct(0.5) === null ? null : Number(pct(0.5).toFixed(2)),
      p95Ms: pct(0.95) === null ? null : Number(pct(0.95).toFixed(2)),
      maxMs: n ? Number(s[n - 1].toFixed(2)) : null,
      approxFps: pct(0.5) ? Number((1000 / pct(0.5)).toFixed(1)) : null,
      longFrameRatio: n ? Number((long / n).toFixed(3)) : null,
      longFrames: long
    };
  });
}

async function setSlider(page, ariaLabel, value) {
  const input = page.locator(`.flow-slider input[aria-label="${ariaLabel}"]`);
  await input.waitFor({ timeout: 5000 });
  // React 19 controlled range: go through the prototype value setter so the
  // synthetic input event is recognized by React's value tracker.
  await input.evaluate((el, v) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(el, String(v));
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

async function sliderValue(page, ariaLabel) {
  return page.locator(`.flow-slider input[aria-label="${ariaLabel}"]`).inputValue();
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
results.browser.name = "Chrome (Playwright channel=chrome)";
results.browser.headless = true;
results.browser.launchedAt = new Date().toISOString();

try {
  // =========================================================================
  // A. Soybean oil · desktop 1440, dark beam
  // =========================================================================
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ["clipboard-read", "clipboard-write"] });
  await desktop.addInitScript(RAF_INIT);
  const dPage = await desktop.newPage();
  attachErrorCapture(dPage, "soy-desktop");

  const statusSoy = await gotoPage(dPage, SOY_URL, { waitSelector: ".atlas-canvas svg" });
  ok("soy map loads HTTP 200", statusSoy === 200, { status: statusSoy, url: dPage.url() });
  await dPage.waitForTimeout(1500);

  const stateA = await readWorkspace(dPage);
  const themeA = await themeState(dPage);
  observe("soy-desktop-initial", { theme: themeA, ...stateA });
  ok("fresh context defaults to dark", themeA.theme === "dark", themeA);
  ok("soy beam: product select matches URL product", stateA.productSelect === "generic-soybean-oil", { productSelect: stateA.productSelect });
  ok("soy beam: particle canvas present", stateA.canvas === 1, { canvas: stateA.canvas });
  ok("soy beam: records listed", stateA.records > 0, { records: stateA.records });
  ok("soy beam: three item chips with distinct colors",
    stateA.chips.length === 3 && new Set(stateA.chips.map(c => c.color)).size === 3,
    { chips: stateA.chips });
  ok("soy beam: country labels rendered", stateA.labels > 0, { labels: stateA.labels });
  ok("soy beam: particle count within cap",
    Number.isFinite(stateA.particles) && Number.isFinite(stateA.cap) && stateA.particles >= 0 && stateA.particles <= stateA.cap,
    { particles: stateA.particles, cap: stateA.cap, level: stateA.level });

  const linesDark = await lineProbe(dPage);
  const guideDark = linesDark.lines.filter(l => !l.active && !l.muted);
  const beamOpacityDark = guideDark.map(l => Number(l.opacity));
  const darkGuidesOk = stateA.beamMode && guideDark.length > 0 && beamOpacityDark.every(o => Number.isFinite(o) && o >= 0.15 && o <= 0.21);
  observe("soy-beam-dark-lines", linesDark);
  ok("beam dark: workspace carries .beam-mode", stateA.beamMode, { workspaceClass: stateA.workspaceClass });
  ok("beam dark: static guide lines computed opacity 0.18", darkGuidesOk, { expected: 0.18, opacities: beamOpacityDark, sample: linesDark.lines.slice(0, 3) });

  await shot(dPage, "soy-1440-beam-dark.png");

  // ---- Record detail drawer: click open, provenance, contrast, keyboard open,
  //      Esc close, reopen, backdrop close, no duplicate drawer. ----
  const firstRecord = dPage.locator(".atlas-record").first();
  if (await firstRecord.count()) {
    await firstRecord.click();
    await dPage.locator('.record-drawer[role="dialog"]').first().waitFor({ timeout: 5000 });
    let detail = await readDrawer(dPage);
    detail.ddContrast = detail.dds.map(d => ({ text: d.text, contrast: contrastRatio(d.color, detail.panelBg === "rgba(0, 0, 0, 0)" ? detail.rootBg : detail.panelBg), color: d.color }));
    observe("soy-desktop-detail", detail);
    ok("soy detail: drawer opens on record click", detail.open && detail.count === 1 && detail.heading.length > 0, { heading: detail.heading, count: detail.count });
    ok("soy detail: no duplicate drawer", detail.count === 1, { count: detail.count });
    ok("soy detail: source visible", detail.source.length > 0, { source: detail.source });
    ok("soy detail: method retained in provenance", detail.method.length > 0, { method: detail.method, datasetVersion: detail.datasetVersion });
    const worstDd = Math.min(...detail.ddContrast.map(d => d.contrast ?? 99));
    ok("soy detail dark: amount/value text contrast ≥ 3", Number.isFinite(worstDd) && worstDd >= 3,
      { panelBg: detail.panelBg, rootBg: detail.rootBg, ddContrast: detail.ddContrast });
    await shot(dPage, "soy-1440-detail-dark.png");

    // Keyboard activation on a geometry line opens the same drawer.
    const line = dPage.locator(".country-trade-line").first();
    if (await line.count()) {
      await line.focus();
      await dPage.keyboard.press("Enter");
      await dPage.waitForTimeout(500);
      const kbDetail = await readDrawer(dPage);
      ok("soy: keyboard Enter on a line opens detail", kbDetail.open && kbDetail.count === 1, { detailCount: kbDetail.count, heading: kbDetail.heading });
    }

    // Esc closes the drawer.
    await dPage.keyboard.press("Escape");
    await dPage.waitForTimeout(400);
    const afterEsc = await dPage.locator('.record-drawer[role="dialog"]').count();
    ok("soy detail: Esc closes drawer", afterEsc === 0, { drawerCount: afterEsc });

    // Reopen, then close via backdrop click.
    await dPage.locator(".atlas-record").first().click();
    await dPage.locator('.record-drawer[role="dialog"]').first().waitFor({ timeout: 5000 });
    const reopenCount = await dPage.locator('.record-drawer[role="dialog"]').count();
    ok("soy detail: reopened without duplicate", reopenCount === 1, { drawerCount: reopenCount });
    await dPage.locator(".record-drawer-backdrop").click();
    await dPage.waitForTimeout(400);
    const afterBackdrop = await dPage.locator('.record-drawer[role="dialog"]').count();
    ok("soy detail: backdrop click closes drawer", afterBackdrop === 0, { drawerCount: afterBackdrop });
  } else {
    recordIssue("重要", "大豆油地图无记录列表项", "未找到 .atlas-record；详情/来源/方法断言未执行。");
  }

  // Zoom / reset controls.
  const svgGroup = dPage.locator(".world-country-map g").first();
  const transformBefore = await svgGroup.getAttribute("transform");
  await dPage.locator('.map-zoom-controls button[aria-label="放大地图"]').click();
  const transformZoomed = await svgGroup.getAttribute("transform");
  ok("map zoom-in changes transform", transformBefore !== transformZoomed, { transformBefore, transformZoomed });
  await dPage.locator('.map-zoom-controls button:has-text("复位")').click();
  const transformReset = await svgGroup.getAttribute("transform");
  ok("map reset restores identity transform", /translate\(0 0\) scale\(1\)/.test(transformReset ?? ""), { transformReset });

  // Classic mode (dark), persistence, then beam persistence after reload.
  await dPage.locator('.flow-mode-controls button:has-text("经典箭头")').click();
  await dPage.waitForTimeout(600);
  const stateClassic = await readWorkspace(dPage);
  const linesClassic = await lineProbe(dPage);
  observe("soy-desktop-classic", { ...stateClassic, lines: linesClassic });
  ok("classic mode: particle canvas removed", stateClassic.canvas === 0, { canvas: stateClassic.canvas });
  ok("classic mode: static arcs retained", stateClassic.lines > 0, { lines: stateClassic.lines });
  ok("classic mode: workspace reports classic", stateClassic.mode === "classic", { mode: stateClassic.mode });
  await shot(dPage, "soy-1440-classic-dark.png");

  const storedClassic = await readStoredTheme(dPage);
  ok("classic choice persisted to localStorage", storedClassic?.tokens?.map?.mode === "static-arc", { stored: storedClassic });
  await reloadWithRetry(dPage);
  await dismissGuide(dPage);
  await dPage.waitForTimeout(1200);
  const afterReloadClassic = await readWorkspace(dPage);
  ok("classic mode persists after reload", afterReloadClassic.mode === "classic" && afterReloadClassic.canvas === 0, afterReloadClassic);

  await dPage.locator('.flow-mode-controls button:has-text("粒子流")').click();
  await dPage.waitForTimeout(800);
  await reloadWithRetry(dPage);
  await dismissGuide(dPage);
  await dPage.waitForTimeout(1200);
  const afterReloadBeam = await readWorkspace(dPage);
  ok("beam mode persists after reload", afterReloadBeam.mode === "beam" && afterReloadBeam.canvas === 1, afterReloadBeam);

  // Light beam.
  await dPage.locator(".theme-switcher").click();
  await dPage.waitForFunction(() => document.documentElement.dataset.theme === "light", { timeout: 3000 }).catch(() => {});
  await dPage.waitForTimeout(1000);
  const stateLight = await readWorkspace(dPage);
  const themeLight = await themeState(dPage);
  const linesLight = await lineProbe(dPage);
  const guideLight = linesLight.lines.filter(l => !l.active && !l.muted);
  const beamOpacityLight = guideLight.map(l => Number(l.opacity));
  observe("soy-desktop-light", { theme: themeLight, ...stateLight, lines: linesLight });
  ok("light beam: canvas present", stateLight.canvas === 1, { canvas: stateLight.canvas });
  ok("light map has no horizontal overflow", !themeLight.overflow, themeLight);
  ok("beam light: static guide lines computed opacity 0.18",
    stateLight.beamMode && guideLight.length > 0 && beamOpacityLight.every(o => Number.isFinite(o) && o >= 0.15 && o <= 0.21),
    { expected: 0.18, opacities: beamOpacityLight, sample: linesLight.lines.slice(0, 3) });
  await shot(dPage, "soy-1440-beam-light.png");

  // Light theme detail contrast.
  await dPage.locator(".atlas-record").first().click();
  await dPage.locator('.record-drawer[role="dialog"]').first().waitFor({ timeout: 5000 });
  const detailLight = await readDrawer(dPage);
  detailLight.ddContrast = detailLight.dds.map(d => ({ text: d.text, contrast: contrastRatio(d.color, detailLight.panelBg === "rgba(0, 0, 0, 0)" ? detailLight.rootBg : detailLight.panelBg), color: d.color }));
  observe("soy-desktop-detail-light", detailLight);
  const worstLight = Math.min(...detailLight.ddContrast.map(d => d.contrast ?? 99));
  ok("soy detail light: amount/value text contrast ≥ 3", detailLight.open && Number.isFinite(worstLight) && worstLight >= 3,
    { panelBg: detailLight.panelBg, rootBg: detailLight.rootBg, ddContrast: detailLight.ddContrast });
  await shot(dPage, "soy-1440-detail-light.png");
  await dPage.keyboard.press("Escape");
  await dPage.waitForTimeout(300);

  // ---- Multi-item checkboxes ----
  const picker = dPage.locator(".atlas-item-picker");
  await picker.locator("summary").click();
  await dPage.waitForTimeout(300);
  const boxes = dPage.locator('.atlas-item-picker input[type="checkbox"]');
  const boxCount = await boxes.count();
  const boxState = await boxes.evaluateAll(els => els.map(el => ({ value: el.value, checked: el.checked, disabled: el.disabled })));
  observe("soy-item-picker", { boxCount, boxState });
  ok("multi-select: item checkboxes rendered", boxCount >= 3, { boxCount, boxState });
  const targetIdx = boxState.findIndex(b => b.checked && !b.disabled);
  if (targetIdx >= 0) {
    const beforeItems = new URL(dPage.url()).searchParams.get("items")?.split(",").filter(Boolean) ?? [];
    await boxes.nth(targetIdx).click();
    await dPage.waitForFunction(({ before }) => {
      const items = new URL(location.href).searchParams.get("items")?.split(",").filter(Boolean) ?? [];
      return items.length === before - 1;
    }, { before: beforeItems.length }, { timeout: 5000 }).catch(() => {});
    await dPage.waitForTimeout(500);
    const afterUncheck = await readWorkspace(dPage);
    const afterItems = new URL(dPage.url()).searchParams.get("items")?.split(",").filter(Boolean) ?? [];
    observe("soy-item-picker-uncheck", { items: afterItems, chips: afterUncheck.chips, records: afterUncheck.records });
    ok("multi-select: unchecking a checkbox removes one item from URL and chips",
      afterItems.length === beforeItems.length - 1 && afterUncheck.chips.length === beforeItems.length - 1,
      { before: beforeItems, after: afterItems, chips: afterUncheck.chips });
    // Re-check to restore.
    await boxes.nth(targetIdx).click();
    await dPage.waitForFunction(({ before }) => {
      const items = new URL(location.href).searchParams.get("items")?.split(",").filter(Boolean) ?? [];
      return items.length === before;
    }, { before: beforeItems.length }, { timeout: 5000 }).catch(() => {});
    await dPage.waitForTimeout(500);
    const afterRecheck = await readWorkspace(dPage);
    const reItems = new URL(dPage.url()).searchParams.get("items")?.split(",").filter(Boolean) ?? [];
    ok("multi-select: re-checking restores all selected items",
      reItems.length === beforeItems.length && afterRecheck.chips.length === beforeItems.length,
      { before: beforeItems, after: reItems, chips: afterRecheck.chips });
  } else {
    recordIssue("重要", "多选面板无可用复选框", boxState);
  }

  // ---- Drawer functional tests (desktop) ----
  await dPage.locator(".flow-settings-open").click();
  await dPage.locator('.flow-drawer[aria-label="调节流动"]').waitFor({ timeout: 5000 });
  const sliderCount = await dPage.locator(".flow-slider input[type=range]").count();
  ok("drawer: six tuning sliders", sliderCount === 6, { sliderCount });
  const drawerModeButtons = await dPage.locator(".flow-mode-switch button").allTextContents();
  observe("soy-desktop-drawer", { sliderCount, drawerModeButtons });
  await shot(dPage, "soy-1440-drawer.png");

  // Adjust two parameters: density + beam width.
  await setSlider(dPage, "粒子量", 1);
  await setSlider(dPage, "束宽", 3);
  await dPage.waitForTimeout(500);
  const densityAfter = await sliderValue(dPage, "粒子量");
  const beamAfter = await sliderValue(dPage, "束宽");
  ok("drawer: density slider applies", Number(densityAfter) === 1, { densityAfter });
  ok("drawer: beam-width slider applies", Number(beamAfter) === 3, { beamAfter });
  const stateAdjusted = await readWorkspace(dPage);
  observe("soy-desktop-adjusted", stateAdjusted);
  await shot(dPage, "soy-1440-beam-adjusted.png");

  // Reset to defaults.
  await dPage.locator('.flow-drawer-actions button:has-text("恢复默认")').click();
  await dPage.waitForTimeout(500);
  const densityReset = await sliderValue(dPage, "粒子量");
  const beamReset = await sliderValue(dPage, "束宽");
  ok("reset: density returns to default 0.6", Number(densityReset) === 0.6, { densityReset });
  ok("reset: beam width returns to default 1", Number(beamReset) === 1, { beamReset });

  // Settings persist across reload: tweak density, reload, reopen, compare.
  await setSlider(dPage, "粒子量", 0.9);
  await dPage.waitForTimeout(300);
  await reloadWithRetry(dPage);
  await dismissGuide(dPage);
  await dPage.waitForTimeout(1200);
  await dPage.locator(".flow-settings-open").click();
  await dPage.locator('.flow-drawer[aria-label="调节流动"]').waitFor({ timeout: 5000 });
  const densityPersist = await sliderValue(dPage, "粒子量");
  const beamPersist = await sliderValue(dPage, "束宽");
  observe("soy-settings-persist", { densityPersist, beamPersist });
  ok("settings: density persists after reload", Number(densityPersist) === 0.9, { densityPersist, beamPersist });

  // Export: real clipboard first; visible textarea fallback only. localStorage is NOT accepted.
  await dPage.locator('.flow-drawer-actions button:has-text("复制配置 JSON")').click();
  await dPage.waitForTimeout(700);
  let exportedJson = null;
  let exportMethod = null;
  let clipErr = null;
  try {
    exportedJson = await dPage.evaluate(() => navigator.clipboard.readText());
    if (exportedJson) exportMethod = "clipboard";
  } catch (e) { exportMethod = "clipboard-read-denied"; clipErr = String(e?.message ?? e); }
  if (!exportedJson) {
    exportedJson = await dPage.locator("#flow-import-text").inputValue().catch(() => "");
    exportMethod = exportedJson ? "textarea-fallback" : "empty";
  }
  let parsedExport = null;
  try { parsedExport = JSON.parse(exportedJson); } catch { parsedExport = null; }
  observe("soy-desktop-export", { exportMethod, clipErr, exportedJson: exportedJson?.slice(0, 400) });
  ok("export: real clipboard or visible textarea produced parseable config",
    parsedExport !== null && parsedExport.version === 1,
    { exportMethod, clipErr, version: parsedExport?.version });

  // Valid import: paste the real exported JSON into the visible textarea.
  if (parsedExport !== null) {
    await dPage.locator("#flow-import-text").fill(exportedJson);
    await dPage.locator('.flow-import button:has-text("导入配置")').click();
    await dPage.waitForTimeout(500);
    const validMsg = await dPage.locator(".flow-drawer-message").first().innerText().catch(() => "");
    const validClass = await dPage.locator(".flow-drawer-message").first().getAttribute("class").catch(() => "");
    const validKind = /flow-message-error/.test(validClass) ? "error" : /flow-message-warn/.test(validClass) ? "warn" : "ok";
    const storedAfterImport = await readStoredTheme(dPage);
    const importApplied = storedAfterImport && storedAfterImport !== "unparseable" && storedAfterImport.version === 1;
    observe("soy-desktop-import-valid", { validMsg, validClass, validKind, storedAfterImport });
    ok("valid import: config applied to persisted theme config", importApplied, { storedAfterImport });
    ok("valid import: ok/warn feedback message shown", validKind !== "error" && /已导入|已保存/.test(validMsg),
      { validMsg, validClass, validKind, importApplied, note: "若配置已生效但消息缺失，按真实产品缺陷记录，不以 localStorage 或二次点击补判通过" });
  } else {
    recordIssue("重要", "valid import 未执行：导出配置为空", { exportMethod });
  }

  // Invalid JSON import.
  await dPage.locator("#flow-import-text").fill("{ this is : not json,,, ");
  await dPage.locator('.flow-import button:has-text("导入配置")').click();
  await dPage.waitForTimeout(500);
  const invalidMsg = await dPage.locator(".flow-drawer-message.flow-message-error").first().innerText().catch(() => "");
  observe("soy-desktop-import-invalid", { invalidMsg });
  ok("invalid JSON: error message shown", invalidMsg.length > 0 && /JSON|无效/.test(invalidMsg), { invalidMsg });

  // Close drawer: close button.
  await dPage.locator(".flow-drawer-close").click();
  await dPage.waitForTimeout(300);
  ok("drawer: closes via close button", (await dPage.locator(".flow-drawer").count()) === 0);

  await desktop.close();

  // -------------------------------------------------------------------------
  // B. Reduced motion: no canvas, static lines retained, no crash
  // -------------------------------------------------------------------------
  const motion = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  const moPage = await motion.newPage();
  attachErrorCapture(moPage, "soy-reduced-motion");
  const statusMotion = await gotoPage(moPage, SOY_URL, { waitSelector: ".atlas-canvas svg" });
  await moPage.waitForTimeout(1200);
  const motionState = await readWorkspace(moPage);
  const motionErrors = summarizeErrors("soy-reduced-motion");
  observe("soy-reduced-motion", { ...motionState, ...motionErrors });
  ok("reduced-motion: loads 200", statusMotion === 200, { status: statusMotion });
  ok("reduced-motion: particle canvas absent", motionState.canvas === 0, { canvas: motionState.canvas });
  ok("reduced-motion: static lines retained", motionState.lines > 0, { lines: motionState.lines });
  ok("reduced-motion: no pageerror", motionErrors.pageErrorCount === 0, motionErrors);
  await shot(moPage, "soy-1440-reduced-motion.png");
  await motion.close();

  // -------------------------------------------------------------------------
  // C. Restricted storage: localStorage/sessionStorage throw; no crash
  // -------------------------------------------------------------------------
  const restricted = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await restricted.addInitScript(() => {
    const denied = () => { throw new DOMException("Storage disabled", "SecurityError"); };
    const fakeStorage = { getItem: denied, setItem: denied, removeItem: denied, clear: denied, key: () => null, length: 0 };
    Object.defineProperty(window, "localStorage", { value: fakeStorage, configurable: true });
    Object.defineProperty(window, "sessionStorage", { value: fakeStorage, configurable: true });
  });
  const rPage = await restricted.newPage();
  attachErrorCapture(rPage, "soy-restricted-storage");
  const statusRestricted = await gotoPage(rPage, SOY_URL, { waitSelector: ".atlas-canvas svg" });
  await rPage.waitForTimeout(1000);
  const restrictedState = await readWorkspace(rPage);
  const restrictedErrors = summarizeErrors("soy-restricted-storage");
  observe("soy-restricted-storage", { ...restrictedState, ...restrictedErrors });
  ok("restricted-storage: loads 200", statusRestricted === 200, { status: statusRestricted });
  ok("restricted-storage: renders without crash", restrictedState.records >= 0 && restrictedErrors.pageErrorCount === 0, restrictedErrors);
  // Mode toggle still works in memory.
  await rPage.locator('.flow-mode-controls button:has-text("经典箭头")').click();
  await rPage.waitForTimeout(500);
  const restrictedAfter = await readWorkspace(rPage);
  ok("restricted-storage: in-memory mode toggle works", restrictedAfter.mode === "classic", restrictedAfter);
  await shot(rPage, "soy-1440-restricted-storage.png");
  await restricted.close();

  // -------------------------------------------------------------------------
  // D. 10x stress: mode switch + drawer open/close; canvas/rAF cleanup
  // -------------------------------------------------------------------------
  const stress = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await stress.addInitScript(RAF_INIT);
  const sPage = await stress.newPage();
  attachErrorCapture(sPage, "soy-stress");
  await gotoPage(sPage, SOY_URL, { waitSelector: ".atlas-canvas svg" });
  await sPage.waitForTimeout(1000);

  await sPage.evaluate(() => {
    window.__stressCounts ??= { added: 0, removed: 0 };
    const obs = new MutationObserver(muts => {
      for (const m of muts) {
        for (const n of m.addedNodes) if (n.querySelector?.("canvas") || n.tagName === "CANVAS") window.__stressCounts.added++;
        for (const n of m.removedNodes) if (n.querySelector?.("canvas") || n.tagName === "CANVAS") window.__stressCounts.removed++;
      }
    });
    obs.observe(document.querySelector(".atlas-canvas"), { childList: true, subtree: true });
    window.__stressObserver = obs;
  });

  const rounds = 10;
  const classicCanvasCounts = [];
  for (let i = 0; i < rounds; i++) {
    await sPage.locator(".flow-settings-open").click();
    await sPage.waitForTimeout(150);
    await sPage.locator(".flow-drawer-close").click();
    await sPage.waitForTimeout(120);
    await sPage.locator('.flow-mode-controls button:has-text("经典箭头")').click();
    await sPage.waitForTimeout(150);
    classicCanvasCounts.push(await sPage.locator(".beam-layer canvas").count());
    await sPage.locator('.flow-mode-controls button:has-text("粒子流")').click();
    await sPage.waitForTimeout(150);
  }
  await sPage.waitForTimeout(500);
  const stressCounts = await sPage.evaluate(() => ({ ...window.__stressCounts, activeLoops: window.__rafCollector.loops }));
  const stressErrors = summarizeErrors("soy-stress");
  results.stress = { rounds, classicCanvasCounts, ...stressCounts, ...stressErrors };
  observe("soy-stress", results.stress);
  ok("stress: canvas removed in every classic round", classicCanvasCounts.every(c => c === 0), { classicCanvasCounts });
  ok("stress: no pageerror over 10 rounds", stressErrors.pageErrorCount === 0, stressErrors);
  ok("stress: no console error over 10 rounds", stressErrors.consoleErrorCount === 0, stressErrors);
  await stress.close();

  // -------------------------------------------------------------------------
  // E. Real WebM recording: particles ≥4s, open drawer, tweak params,
  //    classic → back to beam. Real Playwright screencast, not image→video.
  // -------------------------------------------------------------------------
  const videoContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    recordVideo: { dir: output, size: { width: 1440, height: 1000 } }
  });
  const vPage = await videoContext.newPage();
  attachErrorCapture(vPage, "soy-video");
  await gotoPage(vPage, SOY_URL, { waitSelector: ".atlas-canvas svg" });
  await vPage.waitForTimeout(4000); // particles visible at least 4s
  await vPage.locator(".flow-settings-open").click();
  await vPage.waitForTimeout(600);
  await setSlider(vPage, "粒子量", 0.85);
  await setSlider(vPage, "束宽", 1.8);
  await vPage.waitForTimeout(800);
  await vPage.locator(".flow-drawer-close").click();
  await vPage.waitForTimeout(500);
  await vPage.locator('.flow-mode-controls button:has-text("经典箭头")').click();
  await vPage.waitForTimeout(1200);
  await vPage.locator('.flow-mode-controls button:has-text("粒子流")').click();
  await vPage.waitForTimeout(1200);
  const videoRef = vPage.video();
  await videoContext.close();

  if (videoRef) {
    const srcPath = await videoRef.path();
    const targetPath = resolve(output, "nexus-flow-demo.webm");
    await copyFile(srcPath, targetPath);
    const meta = await stat(targetPath).catch(() => null);
    const head = meta ? await readFile(targetPath).then(b => [...b.subarray(0, 4)]).catch(() => null) : null;
    const isWebm = head && head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3;
    results.video = { path: targetPath, bytes: meta?.size ?? 0, source: srcPath, ebmlMagic: isWebm, head: head?.map(x => x.toString(16)) };
    ok("video: WebM recorded and non-empty", Boolean(meta && meta.size > 0), { bytes: meta?.size ?? 0 });
    ok("video: file has valid EBML/WebM header", Boolean(isWebm), { head: head?.map(x => x.toString(16)) });
  } else {
    recordIssue("阻断", "视频：Playwright 未产生录屏对象", "page.video() 为空");
  }

  // -------------------------------------------------------------------------
  // F. Mobile 390: soy beam dark / light, drawer, return button, overflow
  //    NOTE: 390 is a viewport-only simulation; no device/emulation claims.
  // -------------------------------------------------------------------------
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await mobile.addInitScript(RAF_INIT);
  const mPage = await mobile.newPage();
  attachErrorCapture(mPage, "soy-mobile");
  const statusMobile = await gotoPage(mPage, SOY_URL, { waitSelector: ".atlas-canvas svg" });
  await mPage.waitForTimeout(1200);
  const mState = await readWorkspace(mPage);
  const mTheme = await themeState(mPage);
  observe("soy-mobile-dark", { theme: mTheme, ...mState, emulation: "viewport-only" });
  ok("mobile soy loads 200", statusMobile === 200, { status: statusMobile });
  ok("mobile beam: canvas present", mState.canvas === 1, { canvas: mState.canvas });
  ok("mobile beam: no horizontal overflow", !mTheme.overflow, mTheme);
  const returnBtn = mPage.locator(".mobile-map-return");
  ok("mobile: return-to-map button present", (await returnBtn.count()) > 0, { count: await returnBtn.count() });
  await shot(mPage, "soy-390-beam-dark.png");

  // Mobile drawer open + close via Escape.
  await mPage.locator(".flow-settings-open").click();
  await mPage.locator('.flow-drawer[aria-label="调节流动"]').waitFor({ timeout: 5000 });
  await shot(mPage, "soy-390-drawer.png");
  await mPage.keyboard.press("Escape");
  await mPage.waitForTimeout(300);
  ok("mobile drawer: closes via Escape", (await mPage.locator(".flow-drawer").count()) === 0);

  await mPage.locator(".theme-switcher").click();
  await mPage.waitForFunction(() => document.documentElement.dataset.theme === "light", { timeout: 3000 }).catch(() => {});
  await mPage.waitForTimeout(1000);
  const mLight = await readWorkspace(mPage);
  const mLightTheme = await themeState(mPage);
  observe("soy-mobile-light", { theme: mLightTheme, ...mLight, emulation: "viewport-only" });
  ok("mobile light beam: canvas present", mLight.canvas === 1, { canvas: mLight.canvas });
  ok("mobile light: no horizontal overflow", !mLightTheme.overflow, mLightTheme);
  await shot(mPage, "soy-390-beam-light.png");
  await mobile.close();

  // -------------------------------------------------------------------------
  // G. Smartphone timeline 390: real keyboard, drag, play/pause, reload
  // -------------------------------------------------------------------------
  const tl = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const tPage = await tl.newPage();
  attachErrorCapture(tPage, "phone-timeline");
  const statusTl = await gotoPage(tPage, PHONE_URL, { waitSelector: ".trade-timeline" });
  await tPage.waitForTimeout(1200);

  const readTl = async () => tPage.evaluate(() => {
    const el = document.querySelector('.trade-timeline input[aria-label="贸易年份"]');
    const yearSelect = document.querySelector('.atlas-compact-filters select[aria-label="选择记录年度"]');
    const years = yearSelect ? [...yearSelect.options].map(o => o.value).filter(Boolean).sort() : [];
    const labels = [...document.querySelectorAll(".trade-timeline-track small")].map(s => s.textContent.trim());
    const strong = document.querySelector(".trade-timeline-head strong")?.textContent.trim() ?? "";
    const urlYear = new URL(location.href).searchParams.get("year");
    const yearIndex = years.indexOf(strong);
    return {
      value: el?.value,
      valuetext: el?.getAttribute("aria-valuetext"),
      strong, urlYear, labels, years, yearIndex,
      valueAgrees: el ? Number(el.value) === yearIndex : false,
      records: document.querySelectorAll(".atlas-record").length,
      url: location.href
    };
  });

  /** Poll until range thumb, label and URL agree on `year` (or timeout with evidence). */
  const waitTlYear = async (year, timeoutMs = 5000) => {
    const deadline = Date.now() + timeoutMs;
    let last = await readTl();
    while (Date.now() < deadline) {
      last = await readTl();
      if (last.strong === year && last.urlYear === year && last.valueAgrees) return last;
      await tPage.waitForTimeout(200);
    }
    return last;
  };

  const tlInfo = await readTl();
  observe("phone-timeline-initial", { ...tlInfo, emulation: "viewport-only" });
  ok("phone timeline: loads 200", statusTl === 200, { status: statusTl, url: tPage.url() });
  ok("phone timeline: range control present", tlInfo.value !== undefined, tlInfo);
  ok("phone timeline: records listed", tlInfo.records > 0, { records: tlInfo.records });

  // Keyboard: 2025 -> 2024 -> 2023 with real key events; re-focus each time
  // because navigation can remount the control. No goto fallback.
  const focusRange = async () => {
    const range = tPage.locator('.trade-timeline input[aria-label="贸易年份"]');
    await range.waitFor({ timeout: 5000 });
    await range.focus();
    await tPage.waitForTimeout(150);
  };

  await focusRange();
  await tPage.keyboard.press("ArrowLeft");
  let tl2024 = await waitTlYear("2024");
  observe("phone-timeline-2024-kb", tl2024);
  ok("timeline: ArrowLeft reaches 2024 (thumb/label/URL agree)", tl2024.strong === "2024" && tl2024.urlYear === "2024" && tl2024.valueAgrees, tl2024);

  await focusRange();
  await tPage.keyboard.press("ArrowLeft");
  const tl2023 = await waitTlYear("2023");
  observe("phone-timeline-2023", tl2023);
  ok("timeline: ArrowLeft reaches earliest year 2023 (thumb/label/URL agree)", tl2023.strong === "2023" && tl2023.urlYear === "2023" && tl2023.valueAgrees, tl2023);
  await shot(tPage, "phone-390-timeline-2023.png");

  // Keyboard forward one year.
  await focusRange();
  await tPage.keyboard.press("ArrowRight");
  const tlKb = await waitTlYear("2024");
  ok("timeline: ArrowRight advances back to 2024", tlKb.strong === "2024" && tlKb.urlYear === "2024" && tlKb.valueAgrees, { from: "2023", ...tlKb });

  // Play / pause.
  const playBtn = tPage.locator(".trade-play");
  await playBtn.click();
  await tPage.waitForTimeout(400);
  const playing = await playBtn.getAttribute("aria-pressed");
  ok("timeline: play starts (aria-pressed)", playing === "true", { playing });
  await tPage.waitForTimeout(1600);
  await playBtn.click();
  await tPage.waitForTimeout(300);
  const paused = await playBtn.getAttribute("aria-pressed");
  ok("timeline: pause stops", paused === "false", { paused });

  // Real drag across the track to the latest year (2025), with intermediate
  // moves so the native range picks up each stepped position.
  const box = await tPage.locator('.trade-timeline input[aria-label="贸易年份"]').boundingBox();
  if (box) {
    await tPage.mouse.move(box.x + box.width * 0.05, box.y + box.height / 2);
    await tPage.mouse.down();
    for (const frac of [0.3, 0.55, 0.8, 0.98]) {
      await tPage.mouse.move(box.x + box.width * frac, box.y + box.height / 2, { steps: 4 });
      await tPage.waitForTimeout(200);
    }
    await tPage.mouse.up();
  }
  const tl2025 = await waitTlYear("2025");
  observe("phone-timeline-2025", tl2025);
  ok("timeline: real drag reaches latest year 2025 (thumb/label/URL agree)", tl2025.strong === "2025" && tl2025.urlYear === "2025" && tl2025.valueAgrees, tl2025);
  await shot(tPage, "phone-390-timeline-2025.png");

  // Refresh restores the selected year carried in the URL.
  await reloadWithRetry(tPage);
  await dismissGuide(tPage);
  await tPage.waitForTimeout(1000);
  const tlAfterReload = await readTl();
  observe("phone-timeline-reload", tlAfterReload);
  ok("timeline: selected year 2025 restored after reload", tlAfterReload.strong === "2025" && tlAfterReload.urlYear === "2025" && tlAfterReload.valueAgrees, tlAfterReload);

  const tlErrors = summarizeErrors("phone-timeline");
  ok("timeline: no pageerror", tlErrors.pageErrorCount === 0, tlErrors);
  const tlTheme = await themeState(tPage);
  ok("timeline page: 390 no horizontal overflow", !tlTheme.overflow, tlTheme);
  await tl.close();

  // -------------------------------------------------------------------------
  // H. Performance: rAF sampling ≥8s, desktop + mobile; diagnostics.
  //    Mobile figures are a 390-viewport simulation on this desktop Chrome,
  //    not a physical device benchmark.
  // -------------------------------------------------------------------------
  const perfDesktop = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await perfDesktop.addInitScript(RAF_INIT);
  const pdPage = await perfDesktop.newPage();
  attachErrorCapture(pdPage, "perf-desktop");
  await gotoPage(pdPage, SOY_URL, { waitSelector: ".atlas-canvas svg" });
  await pdPage.waitForTimeout(1200);
  const perfDState = await readWorkspace(pdPage);
  const perfDSample = await sampleRaf(pdPage, 8);
  const perfDEnv = await pdPage.evaluate(() => ({
    hardwareConcurrency: navigator.hardwareConcurrency ?? null,
    deviceMemory: navigator.deviceMemory ?? null,
    devicePixelRatio: window.devicePixelRatio,
    viewport: { w: innerWidth, h: innerHeight },
    userAgent: navigator.userAgent,
    emulation: "desktop viewport"
  }));
  results.performance.desktop = { ...perfDSample, diagnostics: perfDState, env: perfDEnv };
  observe("perf-desktop", results.performance.desktop);
  ok("perf desktop: particles within cap",
    Number.isFinite(perfDState.particles) && perfDState.particles <= perfDState.cap,
    { particles: perfDState.particles, cap: perfDState.cap });
  ok("perf desktop: approx fps meets ≥55 target", (perfDSample.approxFps ?? 0) >= 55, perfDSample);
  await perfDesktop.close();

  const perfMobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await perfMobile.addInitScript(RAF_INIT);
  const pmPage = await perfMobile.newPage();
  attachErrorCapture(pmPage, "perf-mobile");
  await gotoPage(pmPage, SOY_URL, { waitSelector: ".atlas-canvas svg" });
  await pmPage.waitForTimeout(1200);
  const perfMState = await readWorkspace(pmPage);
  const perfMSample = await sampleRaf(pmPage, 8);
  const perfMEnv = await pmPage.evaluate(() => ({
    hardwareConcurrency: navigator.hardwareConcurrency ?? null,
    deviceMemory: navigator.deviceMemory ?? null,
    devicePixelRatio: window.devicePixelRatio,
    viewport: { w: innerWidth, h: innerHeight },
    userAgent: navigator.userAgent,
    emulation: "390 viewport only; no physical device or CPU throttling"
  }));
  results.performance.mobile = { ...perfMSample, diagnostics: perfMState, env: perfMEnv };
  observe("perf-mobile", results.performance.mobile);
  ok("perf mobile: particles within cap",
    Number.isFinite(perfMState.particles) && perfMState.particles <= perfMState.cap,
    { particles: perfMState.particles, cap: perfMState.cap });
  ok("perf mobile: approx fps meets ≥30 target", (perfMSample.approxFps ?? 0) >= 30, perfMSample);
  await perfMobile.close();

  // -------------------------------------------------------------------------
  // I. Side-by-side comparison image: default vs adjusted density/beam width
  // -------------------------------------------------------------------------
  const cmpContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const cPage = await cmpContext.newPage();
  await gotoPage(cPage, SOY_URL, { waitSelector: ".atlas-canvas svg" });
  await cPage.waitForTimeout(1200);
  await shot(cPage, "soy-1440-beam-default.png");
  await cPage.locator(".flow-settings-open").click();
  await cPage.waitForTimeout(300);
  await setSlider(cPage, "粒子量", 1);
  await setSlider(cPage, "束宽", 3);
  await cPage.waitForTimeout(800);
  await shot(cPage, "soy-1440-beam-adjusted-cmp.png");
  await cmpContext.close();

  const base64Default = (await readFile(resolve(output, "soy-1440-beam-default.png"))).toString("base64");
  const base64Adjusted = (await readFile(resolve(output, "soy-1440-beam-adjusted-cmp.png"))).toString("base64");
  const cmpHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;background:#0d1626;color:#e8eef6;font-family:sans-serif;display:flex;gap:16px;padding:16px}
    figure{margin:0;flex:1}figcaption{margin-bottom:8px}img{width:100%;border:1px solid #33475e}</style></head>
    <body><figure><figcaption>默认（粒子量 60% · 束宽 1.0×）</figcaption><img src="data:image/png;base64,${base64Default}"></figure>
    <figure><figcaption>调高（粒子量 100% · 束宽 3.0×）</figcaption><img src="data:image/png;base64,${base64Adjusted}"></figure></body></html>`;
  const cmpPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await cmpPage.setContent(cmpHtml, { waitUntil: "load" });
  await cmpPage.waitForTimeout(300);
  await cmpPage.screenshot({ path: resolve(output, "soy-beam-compare.png"), fullPage: false });
  await cmpPage.context().close();
} finally {
  await browser.close();
}

// ---------------------------------------------------------------------------
// Summarize
// ---------------------------------------------------------------------------
const failures = checks.filter(c => !c.passed);
for (const failure of failures) {
  let severity = "次要";
  if (/pageerror|crash|video: WebM|canvas absent|no pageerror/i.test(failure.name)) severity = "阻断";
  else if (/200|persist|detail|source|method|records|labels|overflow|fps|cap|import|export|drawer|timeline|keyboard|play|drag|sliders|return|checkbox|contrast|opacity|duplicate/i.test(failure.name)) severity = "重要";
  recordIssue(severity, failure.name, failure);
}

results.finishedAt = new Date().toISOString();
results.summary = {
  total: checks.length,
  passed: checks.length - failures.length,
  failed: failures.length,
  pageErrorPages: Object.entries(results.pageErrors ?? {}).filter(([, v]) => v.length).map(([k, v]) => ({ page: k, count: v.length, messages: v })),
  consoleErrorPages: Object.entries(results.consoleErrors ?? {}).filter(([, v]) => v.length).map(([k, v]) => ({ page: k, count: v.length, messages: v.slice(0, 8) }))
};

await writeFile(resolve(output, "result.json"), JSON.stringify(results, null, 2));
await writeFile(resolve(output, "performance.json"), JSON.stringify(results.performance, null, 2));
console.log(JSON.stringify({
  total: results.summary.total,
  passed: results.summary.passed,
  failed: results.summary.failed,
  performance: results.performance,
  video: results.video,
  pageErrors: results.summary.pageErrorPages,
  consoleErrors: results.summary.consoleErrorPages
}, null, 2));
if (failures.length > 0) {
  console.error("FAILURES:\n" + failures.map(f => `- ${f.name} ${JSON.stringify(f)}`).join("\n"));
  process.exitCode = 1;
}
