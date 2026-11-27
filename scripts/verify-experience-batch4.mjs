/**
 * Batch 4 final full acceptance (experience rebuild 2026-11) — DESIGNED, NOT RUN.
 *
 * Scope and rules (see artifacts/batch4-final-audit.md):
 *   - Drives an already-running single Next production instance (`next start`,
 *     never `dev`) through REVIEW_BASE_URL. This script does NOT start/stop the
 *     server, rebuild, touch .next, modify product source/data/docs, the public
 *     site or Qoder, and does not commit anything.
 *   - Real Chrome through Playwright (`channel: "chrome"`) in isolated contexts.
 *   - Per page: pageerror + console error capture, page-level
 *     scrollWidth/clientWidth, and internal scroll-container measurements
 *     (container horizontal scroll is NOT counted as page overflow).
 *   - Matrix: 1440×1000 and 390×844 (isMobile + hasTouch), dark + light,
 *     covering home, the five published products' breakdown / representative
 *     route / world map / China map, and at least one real country ledger.
 *   - China red line: representative dashed connections are region role links,
 *     NOT domestic trade flow. No amount / tonnage / share / width encoding may
 *     appear on domestic edges; missing statistics stay "待核验/未收录".
 *   - Dedicated independent assertions: AC `ac-nb` node detail, cotton T-shirt
 *     empty province state, mobile nav / theme 44px targets, China node hit
 *     target size, and dynamic cross-map filter preservation (world → China →
 *     back to world). The cross-map check complements the parallel China-map
 *     implementation proxy; a lost filter set is recorded as a gap, never rescued
 *     by a `goto` and then judged passing.
 *
 * Usage (run from repo root, against an already-started production instance):
 *   REVIEW_BASE_URL=http://127.0.0.1:4320 \
 *   REVIEW_OUTPUT_DIR=output/qa/experience-rebuild-2026-11/batch-4-final \
 *   node scripts/verify-experience-batch4.mjs
 *
 * Exit code: 0 all checks passed; 1 at least one failed check.
 * Note: 390 is a desktop Chrome viewport simulation — not a physical device,
 * no real GPU / touch / soft-keyboard benchmark claim.
 */
import { chromium } from "playwright";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const base = process.env.REVIEW_BASE_URL ?? "http://127.0.0.1:4320";
const output = resolve(
  process.env.REVIEW_OUTPUT_DIR ?? "output/qa/experience-rebuild-2026-11/batch-4-final"
);
await mkdir(output, { recursive: true });

const results = {
  base,
  startedAt: new Date().toISOString(),
  browser: {},
  matrix: [],
  checks: [],
  observations: [],
  pages: [],
  overflow: [],
  pageErrors: {},
  consoleErrors: {},
  issues: [],
  scenarios: {},
  crossMapState: null
};

const checks = results.checks;
const ok = (name, passed, detail = {}) => checks.push({ name, passed: Boolean(passed), ...detail });
const observe = (section, data) => results.observations.push({ section, ...data });
function recordIssue(severity, title, detail) { results.issues.push({ severity, title, detail }); }

// ---------------------------------------------------------------------------
// Product registry (cross-checked against data/published/manifest.json)
// ---------------------------------------------------------------------------
const FALLBACK_PRODUCTS = [
  "generic-smartphone",
  "generic-cotton-tshirt",
  "generic-soybean-oil",
  "generic-electric-bicycle",
  "generic-home-air-conditioner"
];

const PRODUCT_META = {
  "generic-smartphone": { focus: "battery", ledger: "country-cn" },
  "generic-cotton-tshirt": { focus: null, ledger: "country-cn" },
  "generic-soybean-oil": { focus: "soybean", ledger: "country-cn" },
  "generic-electric-bicycle": { focus: null, ledger: "country-cn" },
  "generic-home-air-conditioner": { focus: null, ledger: "country-cn", chinaNode: "ac-nb", province: "330000" }
};

// Verified real deep-link cases (audit §3.2 / §3.3).
const AC_WORLD_URL =
  "/map?product=generic-home-air-conditioner&layer=trade&items=generic-home-air-conditioner&year=2024&currency=USD&scope=bilateral&country=country-cn&direction=export&measure=quantity";
const AC_CHINA_URL =
  "/map/china?product=generic-home-air-conditioner&province=330000&stage=material&node=ac-nb";
const COTTON_EMPTY_URL = "/map/china?product=generic-cotton-tshirt&province=110000";

// URL filter keys that must survive the world → China → world round trip (R3-1).
const PRESERVED_KEYS = ["layer", "items", "year", "country", "direction", "scope", "currency", "measure", "focus"];

// Known internal horizontal scroll containers (audit §0). Their internal
// scroll is recorded separately and must NOT be counted as page overflow.
const INTERNAL_SCROLL_CONTAINERS = [
  ".product-level-nav",
  ".exploded-node-list",
  ".route-graph-shell",
  ".route-graph",
  ".table-wrap",
  ".data-table",
  ".map-shell",
  ".world-map",
  ".graph-filter-options"
];

let manifestProducts = [];
try {
  const manifest = JSON.parse(await readFile(resolve(process.cwd(), "data/published/manifest.json"), "utf8"));
  manifestProducts = (manifest.fixtures ?? []).map((f) => f.productId);
} catch (e) {
  observe("manifest-read", { error: String(e?.message ?? e), fallback: FALLBACK_PRODUCTS });
}
const products = manifestProducts.length ? manifestProducts : FALLBACK_PRODUCTS;

// Products with recorded China regional nodes come from the regional atlas
// snapshot; uncovered products must render the explicit empty state.
let coveredChinaProducts = new Set();
try {
  const atlas = JSON.parse(await readFile(resolve(process.cwd(), "content/geography/china-supply-atlas-2026-10-23.json"), "utf8"));
  coveredChinaProducts = new Set(atlas.nodes.map((node) => node.productId));
} catch (e) {
  observe("atlas-read", { error: String(e?.message ?? e) });
}
observe("product-registry", { products, source: manifestProducts.length ? "data/published/manifest.json" : "fallback list" });

// ---------------------------------------------------------------------------
// Browser helpers
// ---------------------------------------------------------------------------
async function shot(page, name) {
  await page.screenshot({ path: resolve(output, name), fullPage: false });
}

async function dismissGuide(page) {
  const dialog = page.getByRole("dialog", { name: "Global Chain 新手引导", exact: true });
  try {
    await dialog.waitFor({ state: "visible", timeout: 2000 });
    await dialog.locator('[data-guide-action="skip"]').click();
    await dialog.waitFor({ state: "detached", timeout: 2000 });
  } catch { /* guide already closed or absent */ }
}

/**
 * Initial navigation only. Retries a refused/network failure a few times;
 * after an interaction failure there is deliberately NO goto rescue — a failed
 * interaction stays a failed check.
 */
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
      if (/ERR_CONNECTION_REFUSED|ECONNREFUSED|net::ERR_|Navigation timeout|page\.goto: Timeout|Timeout 15000/i.test(msg) && i < retries) {
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
  await dismissGuide(page);
  return response?.status();
}

function attachErrorCapture(page, label) {
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

const isFavicon404 = (m) => /favicon\.ico/.test(m);

/** Baseline totals for a context, so each matrix page can report its own delta. */
function errorBaseline(contextLabel) {
  const pe = results.pageErrors[contextLabel] ?? [];
  const ce = (results.consoleErrors[contextLabel] ?? []).filter((m) => !isFavicon404(m));
  return { pe: pe.length, ce: ce.length };
}

/** Errors accumulated on the context since `baseline` (per-page delta). */
function errorDelta(contextLabel, baseline) {
  const pe = results.pageErrors[contextLabel] ?? [];
  const ce = (results.consoleErrors[contextLabel] ?? []).filter((m) => !isFavicon404(m));
  return {
    pageErrorCount: pe.length - baseline.pe,
    consoleErrorCount: ce.length - baseline.ce,
    pageErrorMessages: pe.slice(baseline.pe, baseline.pe + 5),
    consoleErrorMessages: ce.slice(baseline.ce, baseline.ce + 8)
  };
}

async function themeState(page) {
  return page.evaluate(() => ({
    theme: document.documentElement.dataset.theme ?? null,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  }));
}

/** Page-level overflow + internal scroll-container report. Only pageLevel.overflow fails a check. */
async function measureOverflow(page, label) {
  const report = await page.evaluate((selectors) => {
    const doc = document.documentElement;
    const pageLevel = {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      overflow: doc.scrollWidth > doc.clientWidth + 1
    };
    const containers = selectors.map((sel) => {
      const el = document.querySelector(sel);
      if (!el) return { sel, present: false };
      return {
        sel,
        present: true,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        internalOverflow: el.scrollWidth > el.clientWidth + 1,
        className: String(el.className ?? "").slice(0, 60)
      };
    }).filter((c) => c.present);
    return { pageLevel, containers };
  }, INTERNAL_SCROLL_CONTAINERS);
  results.overflow.push({ label, ...report });
  return report;
}

function readUrlParams(page) {
  return Object.fromEntries(new URL(page.url()).searchParams);
}

async function toggleToLight(page) {
  await page.locator(".theme-switcher").click();
  await page.waitForFunction(() => document.documentElement.dataset.theme === "light", { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(600);
}

/** Probe touch-target heights for the given selector list. */
async function probeTouchTargets(page, contextLabel) {
  const selectors = [
    { sel: ".site-header .nav-group > summary", label: "主导航摘要", min: 44 },
    { sel: ".product-level-nav a", label: "商品导航链接", min: 44 },
    { sel: ".theme-switcher", label: "主题切换按钮", min: 44 },
    { sel: ".regional-toolbar select", label: "中国地图筛选下拉", min: 44 },
    { sel: ".regional-workspace .map-zoom-controls button", label: "中国地图缩放按钮", min: 44 },
    { sel: ".mobile-map-return", label: "返回地图按钮", min: 44 },
    { sel: ".regional-adjacent button", label: "上下游相邻按钮", min: 40 }
  ];
  const report = await page.evaluate((items) => items.map((item) => {
    const els = [...document.querySelectorAll(item.sel)];
    const rects = els.map((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return { height: Math.round(r.height * 10) / 10, minHeight: cs.minHeight, width: Math.round(r.width * 10) / 10, visible: r.width > 0 && r.height > 0 };
    }).filter((r) => r.visible);
    const heights = rects.map((r) => r.height);
    return {
      ...item,
      count: els.length,
      visibleCount: rects.length,
      minHeight: heights.length ? Math.min(...heights) : null,
      heights: rects.slice(0, 6),
      belowTarget: heights.length > 0 && heights.some((h) => h < item.min)
    };
  }), selectors);
  observe("touch-targets", { context: contextLabel, report });
  return report;
}

// ---------------------------------------------------------------------------
// China-map red-line probe: domestic edges are representative role links,
// never a quantified trade flow.
// ---------------------------------------------------------------------------
async function probeChinaRedline(page, product) {
  const report = await page.evaluate(() => {
    const edges = [...document.querySelectorAll(".regional-connection")];
    const nodes = [...document.querySelectorAll(".regional-node")];
    const provinces = [...document.querySelectorAll(".china-province[role=button]")];
    const emptyState = document.querySelectorAll('.regional-empty[role="status"]').length;
    const edgesReport = edges.map((edge) => {
      const attrs = [...edge.attributes].map((a) => a.name);
      const title = edge.querySelector("title")?.textContent ?? "";
      const style = getComputedStyle(edge);
      return {
        title,
        dasharray: style.strokeDasharray,
        strokeWidth: style.strokeWidth,
        forbiddenAttrs: attrs.filter((a) => /data-(value|amount|quantity|width|flow|share|tonnage)|stroke-width-amount/i.test(a)),
        hasAmountText: /\d[\d,.]*\s*(万吨|亿吨|吨|千克|kg|亿美元|亿元|美元|万USD|百万美元|千美元)/i.test(title)
      };
    });
    return {
      edgeCount: edges.length,
      nodeCount: nodes.length,
      provinceCount: provinces.length,
      emptyState,
      edges: edgesReport,
      anyForbiddenAttr: edgesReport.some((e) => e.forbiddenAttrs.length > 0),
      anyAmountText: edgesReport.some((e) => e.hasAmountText),
      nonRepresentativeTitles: edgesReport.filter((e) => !/代表性连接$/.test(e.title)).map((e) => e.title)
    };
  });
  observe("china-redline", { product, ...report });
  return report;
}

// ---------------------------------------------------------------------------
// Matrix page model
// ---------------------------------------------------------------------------
const PAGE_KINDS = [
  {
    id: "product",
    label: "商品拆解",
    path: (p) => `/products/${p}`,
    wait: ".product-overview-intro h1, .context-banner, .product-level-nav"
  },
  {
    id: "route",
    label: "代表性路线",
    path: (p) => `/products/${p}/supply-chain`,
    wait: ".route-page, .product-level-nav, .route-graph-shell, .filter-strip"
  },
  {
    id: "world",
    label: "世界地图",
    path: (p) => `/map?product=${p}`,
    wait: ".atlas-workspace, .world-country-map, svg"
  },
  {
    id: "china",
    label: "中国地图",
    path: (p) => `/map/china?product=${p}`,
    wait: ".regional-workspace, .china-supply-map"
  }
];

const VIEWPORTS = [
  { name: "1440", width: 1440, height: 1000, isMobile: false, hasTouch: false },
  { name: "390", width: 390, height: 844, isMobile: true, hasTouch: true }
];

/** Visit one matrix page, collect errors / overflow / selectors / screenshot. */
async function visitMatrixPage(page, vp, theme, product, kind) {
  const label = `${vp.name}-${theme}-${product}-${kind.id}`;
  const contextLabel = `${vp.name}-matrix`;
  const path = kind.path(product);
  const baseline = errorBaseline(contextLabel);
  let status = null;
  try {
    status = await gotoPage(page, path, { waitSelector: kind.wait });
  } catch (e) {
    recordIssue("阻断", `矩阵页导航失败 ${label}`, String(e?.message ?? e).split("\n")[0]);
  }
  await page.waitForTimeout(800);

  const state = await themeState(page);
  const errors = errorDelta(contextLabel, baseline);
  const overflow = await measureOverflow(page, label);

  const selectorPresent = await page.locator(kind.wait).first().count() > 0;
  ok(`${label} loads HTTP 200`, status === 200, { path, status });
  ok(`${label} key selectors present`, selectorPresent, { wait: kind.wait });
  ok(`${label} no pageerror`, errors.pageErrorCount === 0, errors);
  ok(`${label} no console error`, errors.consoleErrorCount === 0, errors);
  ok(`${label} no page-level horizontal overflow`, !state.overflow, state);

  let redline = null;
  if (kind.id === "china") {
    redline = await probeChinaRedline(page, product);
    ok(`${label} domestic edges carry no amount/width/share encoding`, !redline.anyForbiddenAttr, redline);
    ok(`${label} domestic edges show no tonnage/amount text`, !redline.anyAmountText, redline);
    ok(`${label} edges are labelled representative connections`, redline.nonRepresentativeTitles.length === 0, redline);
    if (coveredChinaProducts.has(product)) {
      ok(`${label} renders provinces and recorded regional nodes`, redline.provinceCount === 34 && redline.nodeCount >= 2, redline);
    } else {
      // No recorded regional entity for this product: provinces still render,
      // but the marker/edge layer must be empty and the empty state must show.
      ok(`${label} uncovered product shows the regional empty state`, redline.provinceCount === 34 && redline.nodeCount === 0 && redline.edgeCount === 0 && redline.emptyState > 0, redline);
    }
  }

  const shotName = `${vp.name}-${theme}-${product}-${kind.id}.png`;
  await shot(page, shotName);
  results.pages.push({
    viewport: vp.name, theme, product, kind: kind.id, label, path,
    status, themeState: state, errors, overflow: overflow.pageLevel,
    internalContainers: overflow.containers, screenshot: shotName, redline
  });
  results.matrix.push({ viewport: vp.name, theme, product, kind: kind.id, path, status, ...state });
}

// ---------------------------------------------------------------------------
// Main flow
// ---------------------------------------------------------------------------
const browser = await chromium.launch({ channel: "chrome", headless: true });
results.browser = { channel: "chrome", headless: true, note: "390 viewport simulation only; no physical-device claim" };

try {
  // =========================================================================
  // A. Matrix: viewports × themes × home / five products × four page kinds,
  //    plus the five product-scoped ledgers (phone CN is the required real one).
  // =========================================================================
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile,
      hasTouch: vp.hasTouch
    });
    const page = await context.newPage();
    attachErrorCapture(page, `${vp.name}-matrix`);

    for (const theme of ["dark", "light"]) {
      if (theme === "light") {
        await gotoPage(page, "/", { waitSelector: "h1" });
        await toggleToLight(page);
      }

      // Home.
      const homeLabel = `${vp.name}-${theme}-home`;
      const homeBaseline = errorBaseline(`${vp.name}-matrix`);
      const homeStatus = await gotoPage(page, "/", { waitSelector: "h1" });
      await page.waitForTimeout(1000);
      const homeState = await themeState(page);
      const homeErrors = errorDelta(`${vp.name}-matrix`, homeBaseline);
      const homeOverflow = await measureOverflow(page, homeLabel);
      const homeMeta = await page.evaluate(() => ({
        h1: document.querySelector("h1")?.textContent?.trim() ?? "",
        entries: [...document.querySelectorAll(".home-product-entry")].map((a) => ({
          label: a.querySelector("strong")?.textContent?.trim() ?? "",
          href: a.getAttribute("href") ?? ""
        }))
      }));
      ok(`${homeLabel} loads HTTP 200`, homeStatus === 200, { status: homeStatus });
      ok(`${homeLabel} lists ${products.length} product entries`, homeMeta.entries.length === products.length, { ...homeMeta, expected: products.length });
      ok(`${homeLabel} entries point to the world map`, homeMeta.entries.every((e) => e.href.startsWith("/map?product=")), homeMeta);
      ok(`${homeLabel} no pageerror`, homeErrors.pageErrorCount === 0, homeErrors);
      ok(`${homeLabel} no console error`, homeErrors.consoleErrorCount === 0, homeErrors);
      ok(`${homeLabel} no page-level horizontal overflow`, !homeState.overflow, homeState);
      await shot(page, `${homeLabel}.png`);
      results.pages.push({ viewport: vp.name, theme, product: null, kind: "home", label: homeLabel, path: "/", status: homeStatus, themeState: homeState, errors: homeErrors, overflow: homeOverflow.pageLevel, internalContainers: homeOverflow.containers, screenshot: `${homeLabel}.png` });

      // Product pages.
      for (const product of products) {
        const meta = PRODUCT_META[product] ?? {};
        for (const kind of PAGE_KINDS) {
          await visitMatrixPage(page, vp, theme, product, kind);
        }
        // Ledger: product-scoped country ledger. country-cn is published for
        // all five per audit §3.2; a non-200 is recorded honestly, not rescued.
        const ledgerPath = `/products/${product}/ledger/${meta.ledger ?? "country-cn"}`;
        const ledgerLabel = `${vp.name}-${theme}-${product}-ledger`;
        const ledgerBaseline = errorBaseline(`${vp.name}-matrix`);
        const ledgerStatus = await gotoPage(page, ledgerPath, { waitSelector: ".ledger-page, .not-found, h1" });
        await page.waitForTimeout(600);
        const ledgerState = await themeState(page);
        const ledgerErrors = errorDelta(`${vp.name}-matrix`, ledgerBaseline);
        const ledgerOverflow = await measureOverflow(page, ledgerLabel);
        const ledgerBody = await page.locator("body").innerText().catch(() => "");
        const ledgerHasContent = (await page.locator(".stat-card, .metric-row, .ledger-snapshot").count()) > 0;
        ok(`${ledgerLabel} real ledger loads HTTP 200`, ledgerStatus === 200, { path: ledgerPath, status: ledgerStatus });
        if (ledgerStatus === 200) {
          ok(`${ledgerLabel} ledger shows metrics or a recorded empty state`, ledgerHasContent || /待核验|未收录|暂无/.test(ledgerBody), { ledgerHasContent });
        }
        ok(`${ledgerLabel} no pageerror`, ledgerErrors.pageErrorCount === 0, ledgerErrors);
        ok(`${ledgerLabel} no console error`, ledgerErrors.consoleErrorCount === 0, ledgerErrors);
        ok(`${ledgerLabel} no page-level horizontal overflow`, !ledgerState.overflow, ledgerState);
        await shot(page, `${ledgerLabel}.png`);
        results.pages.push({ viewport: vp.name, theme, product, kind: "ledger", label: ledgerLabel, path: ledgerPath, status: ledgerStatus, themeState: ledgerState, errors: ledgerErrors, overflow: ledgerOverflow.pageLevel, internalContainers: ledgerOverflow.containers, screenshot: `${ledgerLabel}.png` });
      }
    }
    await context.close();
  }

  // =========================================================================
  // B. Main-line journey (real in-page links only, desktop dark):
  //    home → world map → 拆解 → route → ledger → back to world map.
  //    No browser back, no goto rescue between steps.
  // =========================================================================
  const journeyContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const jPage = await journeyContext.newPage();
  attachErrorCapture(jPage, "journey");
  const journeySteps = [];
  let journeyError = null;
  try {
    await gotoPage(jPage, "/", { waitSelector: "h1" });
    const entry = jPage.locator(".home-product-entry").first();
    const entryHref = await entry.getAttribute("href");
    await Promise.all([
      jPage.waitForURL((u) => u.pathname === "/map", { timeout: 10000 }),
      entry.click()
    ]);
    await dismissGuide(jPage);
    journeySteps.push({ step: "home→world", url: jPage.url(), entryHref });
    ok("journey: home entry opens the world map", /\/map/.test(new URL(jPage.url()).pathname), { url: jPage.url(), entryHref });

    // Rebaseline: the old .path-steps strip was removed; the equivalent journey
    // step now goes through the product level nav (.product-level-nav). Ledger
    // links on route pages live in the node link block, so fall back there.
    const NAV_LABEL_BY_STEP = { "拆解": "商品拆解", "路线": "代表性路线", "账本": "国家账本" };
    const clickStep = async (label) => {
      const navLabel = NAV_LABEL_BY_STEP[label] ?? label;
      const before = jPage.url();
      let target = jPage.locator(".product-level-nav a", { hasText: navLabel }).first();
      if ((await target.count()) === 0) {
        target = jPage.locator(".node-links a, .step-node-list a", { hasText: label }).first();
      }
      if ((await target.count()) === 0) throw new Error(`nav step "${label}" (${navLabel}) not found`);
      await Promise.all([
        jPage.waitForURL((u) => u.toString() !== before, { timeout: 10000 }),
        target.click()
      ]);
      await jPage.waitForLoadState("domcontentloaded");
      await dismissGuide(jPage);
    };

    await clickStep("拆解");
    journeySteps.push({ step: "map→breakdown", url: jPage.url() });
    ok("journey: 拆解 step opens the product breakdown page", /\/products\//.test(new URL(jPage.url()).pathname), { url: jPage.url() });

    await clickStep("路线");
    journeySteps.push({ step: "breakdown→route", url: jPage.url() });
    ok("journey: 路线 step opens the representative route page", /\/supply-chain/.test(new URL(jPage.url()).pathname), { url: jPage.url() });

    await clickStep("账本");
    journeySteps.push({ step: "route→ledger", url: jPage.url() });
    ok("journey: 账本 step opens a ledger or country listing", /\/(ledger\/|countries)/.test(new URL(jPage.url()).pathname), { url: jPage.url() });

    const worldNav = jPage.locator(".product-level-nav a", { hasText: "世界地图" }).first();
    if ((await worldNav.count()) > 0) {
      const before = jPage.url();
      await Promise.all([
        jPage.waitForURL((u) => u.toString() !== before, { timeout: 10000 }),
        worldNav.click()
      ]);
      journeySteps.push({ step: "ledger→world", url: jPage.url() });
      ok("journey: product nav returns to the world map", /\/map/.test(new URL(jPage.url()).pathname), { url: jPage.url() });
    } else {
      recordIssue("重要", "journey: 账本页未找到世界地图导航入口", { url: jPage.url() });
    }
    await shot(jPage, "journey-main-line.png");
  } catch (e) {
    journeyError = String(e?.message ?? e).split("\n")[0];
    recordIssue("重要", "journey: main-line link chain interrupted", journeyError);
  }
  results.scenarios.journey = { steps: journeySteps, error: journeyError };
  await journeyContext.close();

  // =========================================================================
  // C. AC `ac-nb` node detail (dark + light), desktop.
  // =========================================================================
  const acContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const acPage = await acContext.newPage();
  attachErrorCapture(acPage, "china-ac-nb");
  for (const theme of ["dark", "light"]) {
    await gotoPage(acPage, AC_CHINA_URL, { waitSelector: ".regional-workspace, .china-supply-map" });
    await acPage.waitForTimeout(800);
    if (theme === "light") await toggleToLight(acPage);

    // If the deep node did not open the detail, use the real list button.
    const activeDetail = await acPage.locator(".regional-details h2").count();
    if (activeDetail === 0) {
      const listBtn = acPage.locator(".regional-node-list button").first();
      if ((await listBtn.count()) > 0) await listBtn.click();
      await acPage.waitForTimeout(500);
    }
    const detail = await acPage.evaluate(() => {
      const aside = document.querySelector(".regional-details");
      const heading = aside?.querySelector("h2")?.textContent.trim() ?? "";
      const org = aside?.querySelector(".regional-organization")?.textContent.trim() ?? "";
      const body = aside?.textContent ?? "";
      return { heading, org, hasJintian: /金田/.test(body), body: body.slice(0, 200) };
    });
    ok(`AC ac-nb ${theme}: node detail opens`, /铜管|换热材料/.test(detail.heading), detail);
    ok(`AC ac-nb ${theme}: linked organization named`, detail.hasJintian, detail);
    await shot(acPage, `china-ac-nb-detail-1440-${theme}.png`);

    // Light-theme visual probe (audit G1-4 ~ G1-18): record panel/province/label
    // computed colors so the parallel China fix can be verified against them.
    const visual = await acPage.evaluate(() => {
      const panel = document.querySelector(".regional-map-panel");
      const province = document.querySelector(".china-province");
      const label = document.querySelector(".regional-city-labels text");
      const cs = (el) => el ? { bg: getComputedStyle(el).backgroundColor, fill: getComputedStyle(el).fill, color: getComputedStyle(el).color } : null;
      return { panel: cs(panel), province: cs(province), label: cs(label) };
    });
    observe(`china-ac-nb-visual-${theme}`, visual);
  }
  await acContext.close();

  // =========================================================================
  // D. Cotton T-shirt empty province state (Beijing 110000), desktop.
  // =========================================================================
  const cottonContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const cPage = await cottonContext.newPage();
  attachErrorCapture(cPage, "china-cotton-empty");
  await gotoPage(cPage, COTTON_EMPTY_URL, { waitSelector: ".regional-workspace, .china-supply-map" });
  await cPage.waitForTimeout(800);
  const emptyStatus = cPage.getByRole("status").filter({ hasText: "这个区域的资料还在补充" });
  ok("cotton empty state: supplement notice shown", (await emptyStatus.count()) > 0);
  await shot(cPage, "china-cotton-empty-1440.png");
  const restoreBtn = cPage.getByRole("button", { name: "返回全国全部环节", exact: true });
  if ((await restoreBtn.count()) > 0) {
    await restoreBtn.click();
    await cPage.waitForTimeout(500);
    const restoredNodes = await cPage.locator(".regional-node-list button").count();
    ok("cotton empty state: restore button returns to national list", restoredNodes > 0, { restoredNodes });
  } else {
    recordIssue("重要", "cotton empty state: 未找到返回全国全部环节按钮");
  }
  await cottonContext.close();

  // =========================================================================
  // E. Mobile 390: touch targets + China node hit area, dark + light.
  // =========================================================================
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const mPage = await mobileContext.newPage();
  attachErrorCapture(mPage, "mobile-touch");
  for (const theme of ["dark", "light"]) {
    await gotoPage(mPage, `/map/china?product=generic-home-air-conditioner`, { waitSelector: ".regional-workspace, .china-supply-map" });
    await mPage.waitForTimeout(800);
    if (theme === "light") await toggleToLight(mPage);

    const targets = await probeTouchTargets(mPage, `390-${theme}`);
    for (const t of targets) {
      if (t.count > 0) ok(`390 ${theme} ${t.label} meets ${t.min}px target`, !t.belowTarget, t);
    }

    const hitReport = await mPage.evaluate(() => {
      const hits = [...document.querySelectorAll(".regional-node-hit")].map((el) => {
        const r = el.getBoundingClientRect();
        return { width: Math.round(r.width * 10) / 10, height: Math.round(r.height * 10) / 10 };
      });
      const diameters = hits.map((h) => Math.min(h.width, h.height));
      return {
        count: hits.length,
        minDiameter: diameters.length ? Math.min(...diameters) : null,
        medianDiameter: diameters.length ? Number([...diameters].sort((a, b) => a - b)[Math.floor(diameters.length / 2)].toFixed(1)) : null,
        sample: hits.slice(0, 6)
      };
    });
    observe("china-node-hit", { viewport: 390, theme, ...hitReport });
    ok(`390 ${theme} China node hit area ≥44px`, hitReport.count > 0 && (hitReport.minDiameter ?? 0) >= 44, hitReport);
    await shot(mPage, `mobile-390-${theme}-china-ac.png`);
  }
  await mobileContext.close();

  // =========================================================================
  // F. Cross-map round trip: world filters → China → back to world (R3-1).
  //    Independent of the parallel China implementation proxy. If filters are
  //    lost they are recorded as a gap; no goto rescue turns this into a pass.
  // =========================================================================
  const crossContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const xPage = await crossContext.newPage();
  attachErrorCapture(xPage, "cross-map");
  await gotoPage(xPage, AC_WORLD_URL, { waitSelector: ".atlas-workspace, .world-country-map, svg" });
  await xPage.waitForTimeout(1000);
  const beforeParams = readUrlParams(xPage);
  observe("cross-map-before", { url: xPage.url(), params: beforeParams });
  await shot(xPage, "cross-map-world.png");

  const toChinaLink = xPage.locator(".atlas-country-context a, .atlas-directory-link").filter({ hasText: "中国供应链" }).first();
  let reachedChina = false;
  if ((await toChinaLink.count()) > 0) {
    await Promise.all([
      xPage.waitForURL((u) => u.pathname === "/map/china", { timeout: 10000 }),
      toChinaLink.click()
    ]);
    reachedChina = true;
    await dismissGuide(xPage);
    observe("cross-map-china", { url: xPage.url(), params: readUrlParams(xPage) });
    await shot(xPage, "cross-map-china.png");
  } else {
    recordIssue("重要", "cross-map: 世界地图未找到进入中国供应链链接");
  }

  let afterParams = {};
  if (reachedChina) {
    const backLink = xPage.locator(".regional-heading .text-link, .product-level-nav a").filter({ hasText: "返回世界地图" }).first();
    if ((await backLink.count()) > 0) {
      await Promise.all([
        xPage.waitForURL((u) => u.pathname === "/map", { timeout: 10000 }),
        backLink.click()
      ]);
      afterParams = readUrlParams(xPage);
      observe("cross-map-after", { url: xPage.url(), params: afterParams });
      await shot(xPage, "cross-map-returned-world.png");
    } else {
      recordIssue("重要", "cross-map: 中国地图未找到返回世界地图链接");
    }
  }

  const missing = PRESERVED_KEYS.filter((k) => beforeParams[k] && afterParams[k] !== beforeParams[k]);
  const restored = PRESERVED_KEYS.filter((k) => beforeParams[k] && afterParams[k] === beforeParams[k]);
  const preserved = reachedChina && Object.keys(afterParams).length > 0 && missing.length === 0;
  results.crossMapState = {
    worldUrl: AC_WORLD_URL,
    before: beforeParams,
    after: afterParams,
    preservedKeys: restored,
    missingKeys: missing,
    preserved,
    note: preserved
      ? "世界地图筛选在进入中国再返回后保持。"
      : "动态站跨地图筛选未保持或未能往返（R3-1 缺口）；需补齐编码回传或在验收口径中明确不保留该状态。"
  };
  ok("cross-map: world filters preserved after China round trip", preserved, results.crossMapState);
  if (!preserved) recordIssue("重要", "cross-map: 动态站筛选状态未保持", results.crossMapState);
  await crossContext.close();
} finally {
  await browser.close();
}

// ---------------------------------------------------------------------------
// Summarize and write evidence
// ---------------------------------------------------------------------------
const failures = checks.filter((c) => !c.passed);
for (const failure of failures) {
  let severity = "次要";
  if (/pageerror|crash|loads HTTP|200/.test(failure.name)) severity = "阻断";
  else if (/overflow|selectors|preserved|detail|organization|empty state|target|hit area|representative|amount|tonnage|provinces|nodes/.test(failure.name)) severity = "重要";
  recordIssue(severity, failure.name, failure);
}

const allPageErrors = Object.values(results.pageErrors).flat();
const allConsoleErrors = Object.values(results.consoleErrors).flat().filter((m) => !/favicon\.ico/.test(m));

results.finishedAt = new Date().toISOString();
results.summary = {
  total: checks.length,
  passed: checks.length - failures.length,
  failed: failures.length,
  products,
  pageErrorCount: allPageErrors.length,
  consoleErrorCount: allConsoleErrors.length,
  pageErrorPages: Object.entries(results.pageErrors).filter(([, v]) => v.length).map(([k, v]) => ({ page: k, count: v.length, messages: v })),
  consoleErrorPages: Object.entries(results.consoleErrors).filter(([, v]) => v.length).map(([k, v]) => ({ page: k, count: v.length, messages: v.slice(0, 8) }))
};

await writeFile(resolve(output, "result.json"), JSON.stringify(results, null, 2));

// Coverage matrix table for the markdown report.
const matrixRows = results.pages.map((p) => {
  const status = p.status === 200 ? "200" : String(p.status ?? "—");
  const overflow = p.themeState?.overflow ? "横溢" : "正常";
  return `| ${p.viewport} | ${p.theme} | ${p.product ?? "—"} | ${p.kind} | ${status} | ${overflow} | ${p.screenshot} |`;
});

const report = [
  "# 批次 4 最终全量验收报告（动态站）",
  "",
  `- 时间：${results.startedAt} → ${results.finishedAt}`,
  `- 基线：${base}（单个 next start 生产实例；脚本不启停服务、不改源码、不提交）`,
  `- 检查：${results.summary.passed}/${results.summary.total} 通过${failures.length ? `，${failures.length} 失败` : ""}`,
  `- 页面错误：${allPageErrors.length}；控制台错误：${allConsoleErrors.length}`,
  `- 视口：1440×1000 与 390×844（390 为桌面 Chrome 视口模拟，非真机）；深浅双主题`,
  "",
  "## 覆盖矩阵",
  "",
  "| 视口 | 主题 | 商品 | 页面 | HTTP | 横溢 | 截图 |",
  "|---|---|---|---|---|---|---|",
  ...matrixRows,
  "",
  "## 专项断言",
  "",
  `- 主线旅程（首页→世界地图→拆解→路线→账本→回地图）：${results.scenarios.journey?.steps?.length ?? 0} 步真实链接跳转`,
  `- 空调 ac-nb 节点详情：见 \`china-ac-nb-detail-1440-dark/light.png\``,
  `- 棉 T 恤空态（北京 110000）：见 \`china-cotton-empty-1440.png\``,
  `- 跨地图状态保持：${results.crossMapState?.preserved ? "保持" : "未保持/未能往返（R3-1 缺口）"}；缺失参数：${(results.crossMapState?.missingKeys ?? []).join(", ") || "无"}`,
  "",
  "## 口径红线",
  "",
  "- 中国地图虚线是代表性环节联系，不是国内贸易流向；脚本不对国内连线做金额、束宽、份额或流向断言，缺失统计保持未收录呈现。",
  "- 容器内横向滚动（商品导航、路线图、数据表、地图壳、筛选条等）单独记录，不计为页面横溢。",
  "- 交互失败不以二次 goto 恢复后判通过；跨地图筛选丢失记为缺口，不记为通过。",
  "",
  "## 未通过项",
  ...(failures.length === 0 ? ["- 无"] : failures.map((f) => `- ${f.name}：${JSON.stringify(f)}`)),
  "",
  "## 说明",
  "",
  "- 本脚本为批次 4 只读验收设计产物；中国地图视觉对齐由并行实现代理负责，本脚本不修改其产品文件，也不读写 batch-4-china 输出。",
  "- 静态参赛包、公网 Qoder 站与时间轴静态回归沿用既有脚本（verify-competition-china / verify-competition-timeline），不在本脚本范围。"
].join("\n");

await writeFile(resolve(output, "acceptance-report.md"), report);

console.log(JSON.stringify(results.summary, null, 2));
if (failures.length > 0) {
  console.error("FAILURES:\n" + failures.map((f) => `- ${f.name} ${JSON.stringify(f)}`).join("\n"));
  process.exitCode = 1;
}
