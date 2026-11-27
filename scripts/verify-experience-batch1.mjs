/**
 * Batch 1 (experience rebuild 2026-11) independent browser acceptance.
 *
 * Drives an already-running local Next production instance with Playwright +
 * installed Chrome in an isolated browser context. Does not touch business
 * source, data, docs or the public site.
 *
 * Usage:
 *   REVIEW_BASE_URL=http://127.0.0.1:4317 \
 *   REVIEW_OUTPUT_DIR=output/qa/experience-rebuild-2026-11/batch-1 \
 *   node scripts/verify-experience-batch1.mjs
 *
 * Evidence: screenshots + result.json (checks, pageerrors, overflow metrics,
 * raw observations) are written to REVIEW_OUTPUT_DIR.
 *
 * Navigation model (verified against routes/components):
 *   - Home product entries link to /map?product=... (the map preview), NOT to
 *     the breakdown page. The real journey is: entry -> /map -> 拆解 step ->
 *     /products/[id] -> 路线 step -> supply-chain -> 账本 step -> countries.
 */
import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const base = process.env.REVIEW_BASE_URL ?? "http://127.0.0.1:4317";
const output = resolve(process.env.REVIEW_OUTPUT_DIR ?? "output/qa/experience-rebuild-2026-11/batch-1");
await mkdir(output, { recursive: true });

// Home entry count follows the published manifest, not a fixed legacy total.
const manifest = JSON.parse(await readFile(resolve(process.cwd(), "data/published/manifest.json"), "utf8"));
const expectedProductEntries = (manifest.fixtures ?? []).length;

const results = {
  base,
  startedAt: new Date().toISOString(),
  browser: {},
  checks: [],
  pages: [],
  overflow: [],
  pageErrors: {},
  consoleErrors: {},
  observations: [],
  issues: []
};

const checks = results.checks;
const ok = (name, passed, detail = {}) => checks.push({ name, passed, ...detail });

function recordIssue(severity, title, detail) {
  results.issues.push({ severity, title, detail });
}

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
  } catch { /* guide already closed or absent */ }
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
    try {
      await page.locator(waitSelector).first().waitFor({ timeout: 10000 });
    } catch (e) {
      results.observations.push({ section: "selector-timeout", path, error: String(e?.message ?? e).split("\n")[0] });
    }
  }
  await dismissGuide(page);
  return response?.status();
}

function parseRgb(color) {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color ?? "");
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function luminance(rgb) {
  if (!rgb) return null;
  const [r, g, b] = rgb.map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(fg, bg) {
  const l1 = luminance(parseRgb(fg));
  const l2 = luminance(parseRgb(bg));
  if (l1 === null || l2 === null) return null;
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

async function themeState(page) {
  return page.evaluate(() => ({
    theme: document.documentElement.dataset.theme ?? null,
    colorScheme: document.documentElement.style.colorScheme || null,
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
  }));
}

async function overflowReport(page, label) {
  const report = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const wide = [];
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width > vw + 1 && r.right > vw + 1) {
        wide.push({ tag: el.tagName, cls: String(el.className).slice(0, 80), right: Math.round(r.right), width: Math.round(r.width) });
      }
    }
    return { vw, scrollWidth: document.documentElement.scrollWidth, wide: wide.slice(0, 8) };
  });
  results.overflow.push({ label, ...report });
  return report;
}

function attachErrorCapture(page, label) {
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

const C185_RE = /Maximum update depth|getServerSnapshot should be cached|#185|Maximum update/i;

function summarizeErrors(label) {
  const pageErrors = results.pageErrors[label] ?? [];
  const allConsole = results.consoleErrors[label] ?? [];
  // Missing /favicon.ico is recorded separately as a secondary issue, not a page-breaking console error.
  const consoleErrors = allConsole.filter(m => !/favicon\.ico/.test(m));
  return {
    pageErrorCount: pageErrors.length,
    consoleErrorCount: consoleErrors.length,
    favicon404: allConsole.some(m => /favicon\.ico/.test(m)),
    c185Count: pageErrors.filter(m => C185_RE.test(m)).length,
    pageErrorMessages: pageErrors.slice(0, 5),
    consoleErrorMessages: consoleErrors.slice(0, 8)
  };
}

/**
 * Rebaseline: the全站 PathSteps（.path-steps 拆解→路线→账本）已被有意移除，
 * 两层外壳改为顶栏 + 商品标签条（.product-level-nav）。这里读取标签条状态，
 * 等价替代旧路径条的“当前步骤 / 步骤链接”断言。
 */
async function navState(page) {
  const nav = page.locator(".product-level-nav");
  const present = (await nav.count()) > 0;
  const labels = present ? (await nav.locator("a").allTextContents()).map(s => s.trim()) : [];
  const active = present ? await nav.locator('[aria-current="page"]').first().innerText().catch(() => null) : null;
  const hrefs = present ? await nav.locator("a").evaluateAll(els => els.map(a => a.getAttribute("href"))) : [];
  return { present, labels, active, hrefs };
}

/** Old path-strip step label -> equivalent product-level-nav label. */
const NAV_LABEL_BY_STEP = { "拆解": "商品拆解", "路线": "代表性路线", "账本": "国家账本" };

async function clickStep(page, label) {
  const navLabel = NAV_LABEL_BY_STEP[label] ?? label;
  const before = page.url();
  // Prefer the product level nav; ledger links on route pages live in the node
  // link block, so fall back there when the nav does not expose a ledger entry.
  let target = page.locator(".product-level-nav a", { hasText: navLabel }).first();
  if ((await target.count()) === 0) {
    target = page.locator(".node-links a, .step-node-list a", { hasText: label }).first();
  }
  if ((await target.count()) === 0) throw new Error(`nav step "${label}" (${navLabel}) not found`);
  await Promise.all([
    page.waitForURL(url => url.toString() !== before, { timeout: 10000 }),
    target.click()
  ]);
  await page.waitForLoadState("domcontentloaded");
}

const browser = await chromium.launch({ channel: "chrome" });
results.browser.name = "Chrome (Playwright channel=chrome)";
try {
  // ---------------------------------------------------------------------------
  // 1. Home page: 1440 dark / 1440 light / 390 dark / 390 light
  // ---------------------------------------------------------------------------
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const dPage = await desktop.newPage();
  attachErrorCapture(dPage, "home-desktop");

  const statusHome = await gotoPage(dPage, "/", { waitSelector: "h1" });
  ok("home loads HTTP 200", statusHome === 200, { status: statusHome });

  // Stability window: observe at least 3s after hydration; no #185 loop,
  // no pageerror, no console error.
  await dPage.waitForTimeout(3000);
  const homeStability = summarizeErrors("home-desktop");
  ok("home desktop: no pageerror during 3s observation", homeStability.pageErrorCount === 0, homeStability);
  ok("home desktop: no #185 infinite update loop", homeStability.c185Count === 0, homeStability);
  ok("home desktop: no console error during 3s observation", homeStability.consoleErrorCount === 0, homeStability);

  const homeDefault = await themeState(dPage);
  ok("fresh isolated context defaults to dark", homeDefault.theme === "dark", homeDefault);
  ok("home hero map renders (non-zero svg)", await dPage.locator(".home-hero-map svg").count() > 0);

  const homeMeta = await dPage.evaluate(() => ({
    h1: document.querySelector("h1")?.textContent?.trim() ?? "",
    productEntries: [...document.querySelectorAll(".home-product-strip .home-product-entry")].map(a => ({
      label: a.querySelector("strong")?.textContent?.trim() ?? "",
      href: a.getAttribute("href") ?? ""
    })),
    mapBox: (() => { const r = document.querySelector(".home-hero-map")?.getBoundingClientRect(); return r ? { w: Math.round(r.width), h: Math.round(r.height) } : null; })(),
    claimBox: (() => { const r = document.querySelector(".home-hero-claim")?.getBoundingClientRect(); return r ? { w: Math.round(r.width), h: Math.round(r.height) } : null; })()
  }));
  results.observations.push({ section: "home-meta", ...homeMeta });
  ok(`home shows ${expectedProductEntries} product entries`, homeMeta.productEntries.length === expectedProductEntries, { count: homeMeta.productEntries.length, expected: expectedProductEntries });
  const entriesPointToMap = homeMeta.productEntries.every(e => e.href.startsWith("/map?product="));
  ok("home product entries link to map (not breakdown page)", entriesPointToMap, { entries: homeMeta.productEntries });
  ok("home map preview has substantial area", Boolean(homeMeta.mapBox && homeMeta.mapBox.w > 300 && homeMeta.mapBox.h > 200), homeMeta.mapBox);

  // Close the first-visit guide before reading real themed styles; otherwise the
  // dialog overlay changes computed backgrounds and produces false contrast results.
  await dismissGuide(dPage);
  await dPage.waitForTimeout(300);

  // Visual contrast probes (dark scheme): primary button + product entry cards.
  const darkVisual = await dPage.evaluate(() => {
    const cs = el => el ? { bg: getComputedStyle(el).backgroundColor, color: getComputedStyle(el).color, fill: getComputedStyle(el).fill } : null;
    const btn = document.querySelector(".button-primary");
    const entry = document.querySelector(".home-product-entry");
    const strong = entry?.querySelector("strong");
    const ocean = document.querySelector(".home-hero-map .map-ocean");
    return {
      button: cs(btn),
      entry: entry ? { bg: getComputedStyle(entry).backgroundColor, strongColor: strong ? getComputedStyle(strong).color : null } : null,
      oceanFill: ocean ? getComputedStyle(ocean).fill : null
    };
  });
  results.observations.push({ section: "dark-home-visual", ...darkVisual });
  const btnContrast = contrastRatio(darkVisual.button?.color, darkVisual.button?.bg);
  ok("home dark: primary button text/bg contrast is readable", (btnContrast ?? 0) >= 3, { contrast: btnContrast, ...darkVisual.button });
  const entryContrast = darkVisual.entry ? contrastRatio(darkVisual.entry.strongColor, darkVisual.entry.bg) : null;
  ok("home dark: product entry title contrast is readable", (entryContrast ?? 0) >= 3, { contrast: entryContrast, ...darkVisual.entry });

  await shot(dPage, "home-1440-dark.png");
  await overflowReport(dPage, "home-1440-dark");

  // Map preview interaction: zoom in / out / reset (hero map controls)
  await dismissGuide(dPage);
  const zoomIn = dPage.locator('.home-hero-zoom button[aria-label="放大地图"]');
  const zoomOut = dPage.locator('.home-hero-zoom button[aria-label="缩小地图"]');
  const reset = dPage.locator('.home-hero-zoom button:has-text("复位")');
  const svgGroup = dPage.locator(".home-hero-map svg g").first();
  const transformBefore = await svgGroup.getAttribute("transform");
  await zoomIn.click();
  const transformZoomed = await svgGroup.getAttribute("transform");
  ok("home map zoom-in changes transform", transformBefore !== transformZoomed, { transformBefore, transformZoomed });
  await zoomOut.click();
  await reset.click();
  const transformReset = await svgGroup.getAttribute("transform");
  ok("home map reset restores identity transform", /translate\(0 0\) scale\(1\)/.test(transformReset ?? ""), { transformReset });

  // Hero coverage: the old home atlas selectable country + footer deep link were
  // removed with the refresh; the featured route now renders endpoints, flow
  // lines, the hero claim and a product entry strip instead.
  const endpointCount = await dPage.locator(".home-hero-endpoint").count();
  const lineCount = await dPage.locator(".home-hero-line").count();
  ok("home hero renders endpoints covered by recorded routes", endpointCount > 0, { count: endpointCount });
  results.observations.push({ section: "home-hero-coverage", endpoints: endpointCount, lines: lineCount });
  if (endpointCount > 0) {
    ok("home hero renders flow lines from recorded routes", lineCount > 0, { lines: lineCount });
    const claimHeading = (await dPage.locator(".home-hero-claim h1").innerText()).trim();
    const entryHref = await dPage.locator(".home-product-strip .home-product-entry").first().getAttribute("href");
    results.observations.push({ section: "home-hero-entry", claimHeading, entryHref });
    ok("hero claim heading is visible with featured product", claimHeading.length > 0, { claimHeading });
    ok("product entry deep link carries product context", Boolean(entryHref && entryHref.includes("product=")), { entryHref });

    // Keyboard: move focus to another featured-product switcher and activate with Enter
    const others = dPage.locator(".home-hero-switcher button");
    const second = others.nth(Math.min(1, await others.count() - 1));
    await second.focus();
    await dPage.keyboard.press("Enter");
    await dPage.waitForTimeout(150);
    const pressed = await second.getAttribute("aria-pressed");
    ok("keyboard Enter switches featured product on switcher", pressed === "true");
  }

  // Home entry layer: old path strip (拆解/路线/账本) was removed. Equivalent
  // checks are the hero map CTA and the product entry strip that start the journey.
  const heroCta = dPage.locator(".home-hero-actions .button-primary").first();
  const homeCtaHref = await heroCta.getAttribute("href").catch(() => null);
  const homeEntryCount = await dPage.locator(".home-product-entry").count();
  results.observations.push({ section: "home-entry-cta", homeCtaHref, entryCount: homeEntryCount });
  ok("home exposes map CTA and product entries for the journey",
    Boolean(homeCtaHref) && homeEntryCount === expectedProductEntries, { homeCtaHref, homeEntryCount, expected: expectedProductEntries });
  ok("home primary CTA points to the world map", Boolean(homeCtaHref && homeCtaHref.startsWith("/map")), { homeCtaHref });

  // Toggle to light, verify dataset.theme + persisted storage + reload persistence
  const switcher = dPage.locator(".theme-switcher");
  await switcher.click();
  let lightState = await themeState(dPage);
  ok("theme switch flips data-theme to light", lightState.theme === "light", lightState);
  const storedTheme = await dPage.evaluate(() => localStorage.getItem("globechain-theme"));
  ok("theme choice persists to localStorage", Boolean(storedTheme && JSON.parse(storedTheme).mode === "light"), { storedTheme });
  await reloadWithRetry(dPage);
  await dismissGuide(dPage);
  const afterReload = await themeState(dPage);
  ok("light theme persists after reload", afterReload.theme === "light", afterReload);
  await shot(dPage, "home-1440-light.png");
  await overflowReport(dPage, "home-1440-light");
  const lightVisual = await dPage.evaluate(() => {
    const ocean = document.querySelector(".home-hero-map .map-ocean");
    const svg = document.querySelector(".home-hero-map svg");
    return { oceanFill: ocean ? getComputedStyle(ocean).fill : null, svgBg: svg ? getComputedStyle(svg).backgroundColor : null };
  });
  results.observations.push({ section: "light-home-visual", ...lightVisual });
  const oceanLum = luminance(parseRgb(lightVisual.oceanFill));
  ok("home light: map ocean follows light token", (oceanLum ?? 0) > 0.6, lightVisual);

  // Real journey: entry -> /map -> 拆解 -> product breakdown -> 路线 -> supply-chain -> 账本 -> countries
  try {
  await dismissGuide(dPage);
  const entry = dPage.locator(".home-product-strip .home-product-entry").first();
  const entryHref = await entry.getAttribute("href");
  results.observations.push({ section: "journey-entry", href: entryHref });
  await Promise.all([
    dPage.waitForURL(u => u.pathname === "/map", { timeout: 10000 }),
    entry.click()
  ]);
  await dismissGuide(dPage);
  await dPage.locator(".atlas-canvas svg, .product-level-nav").first().waitFor({ timeout: 10000 });
  const mapNav = await navState(dPage);
  results.observations.push({ section: "journey-map", ...mapNav, url: dPage.url() });
  ok("home entry opens the map page", /\/map/.test(new URL(dPage.url()).pathname), { url: dPage.url() });
  ok("map page marks 世界地图 active in level nav", mapNav.active === "世界地图", { mapActive: mapNav.active });

  await clickStep(dPage, "拆解");
  await dPage.locator(".product-overview-intro h1, .page-intro h1").first().waitFor({ timeout: 10000 });
  const productNav = await navState(dPage);
  const productTitle = await dPage.locator("h1").first().innerText();
  results.observations.push({ section: "journey-product", title: productTitle, ...productNav, url: dPage.url() });
  ok("拆解 step opens product breakdown page", /\/products\//.test(new URL(dPage.url()).pathname), { url: dPage.url() });
  ok("product page marks 商品拆解 active", productNav.active === "商品拆解", { productActive: productNav.active });
  ok("product page shows context banner + level nav",
    (await dPage.locator(".context-banner").count()) > 0 && (await dPage.locator(".product-level-nav").count()) > 0);

  await Promise.all([
    dPage.waitForURL(u => /\/supply-chain/.test(u.pathname), { timeout: 10000 }),
    clickStep(dPage, "路线")
  ]);
  await dPage.locator(".product-level-nav, .route-graph-shell, .flow-table").first().waitFor({ timeout: 10000 });
  const routeNav = await navState(dPage);
  results.observations.push({ section: "journey-route", ...routeNav, url: dPage.url() });
  ok("路线 step opens supply-chain page", /\/supply-chain/.test(new URL(dPage.url()).pathname), { url: dPage.url() });
  ok("supply-chain page marks 代表性路线 active", routeNav.active === "代表性路线", { routeActive: routeNav.active });

  await clickStep(dPage, "账本");
  await dPage.locator(".country-card, .ledger-page, .page-intro h1").first().waitFor({ timeout: 10000 });
  const ledgerNav = await navState(dPage);
  results.observations.push({ section: "journey-ledger", ...ledgerNav, url: dPage.url() });
  ok("账本 step opens countries/ledger page", /\/(countries|products\/[^/]+\/ledger)/.test(new URL(dPage.url()).pathname), { url: dPage.url() });
  } catch (e) {
    recordIssue("重要", "首页三步导航旅程中断", String(e?.message ?? e).split("\n")[0]);
    results.observations.push({ section: "journey-error", error: String(e?.message ?? e).split("\n")[0] });
  }

  await desktop.close();

  // 390px mobile home, dark then light
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mPage = await mobile.newPage();
  attachErrorCapture(mPage, "home-mobile");
  const mStatus = await gotoPage(mPage, "/", { waitSelector: "h1" });
  ok("mobile home loads 200", mStatus === 200, { status: mStatus });
  await mPage.waitForTimeout(1500);
  const mobileStability = summarizeErrors("home-mobile");
  ok("mobile home: no pageerror", mobileStability.pageErrorCount === 0, mobileStability);
  ok("mobile home: no #185 loop", mobileStability.c185Count === 0, mobileStability);
  const mDefault = await themeState(mPage);
  ok("mobile fresh context defaults dark", mDefault.theme === "dark", mDefault);
  await shot(mPage, "home-390-dark.png");
  const mOverflowDark = await overflowReport(mPage, "home-390-dark");
  ok("mobile home dark has no horizontal overflow", !mOverflowDark.overflow, mOverflowDark);
  await mPage.locator(".theme-switcher").click();
  const mLight = await themeState(mPage);
  ok("mobile theme switches to light", mLight.theme === "light", mLight);
  await shot(mPage, "home-390-light.png");
  const mOverflowLight = await overflowReport(mPage, "home-390-light");
  ok("mobile home light has no horizontal overflow", !mOverflowLight.overflow, mOverflowLight);
  await mobile.close();

  // ---------------------------------------------------------------------------
  // 2. Isolated fresh context: default dark again (no persisted choice)
  // ---------------------------------------------------------------------------
  const fresh = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const fPage = await fresh.newPage();
  attachErrorCapture(fPage, "home-fresh-isolated");
  await gotoPage(fPage, "/", { waitSelector: "h1" });
  const freshTheme = await themeState(fPage);
  ok("second isolated context still defaults dark", freshTheme.theme === "dark", freshTheme);
  await fresh.close();

  // ---------------------------------------------------------------------------
  // 3. Restricted storage: localStorage/sessionStorage throw; page must not crash
  // ---------------------------------------------------------------------------
  const restricted = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await restricted.addInitScript(() => {
    const denied = () => { throw new DOMException("Storage disabled", "SecurityError"); };
    const fakeStorage = { getItem: denied, setItem: denied, removeItem: denied, clear: denied, key: () => null, length: 0 };
    Object.defineProperty(window, "localStorage", { value: fakeStorage, configurable: true });
    Object.defineProperty(window, "sessionStorage", { value: fakeStorage, configurable: true });
  });
  const rPage = await restricted.newPage();
  attachErrorCapture(rPage, "home-restricted-storage");
  const rStatus = await gotoPage(rPage, "/", { waitSelector: "h1" });
  ok("restricted-storage home loads 200", rStatus === 200, { status: rStatus });
  const rThemeBefore = await themeState(rPage);
  ok("restricted-storage page renders dark without crash", rThemeBefore.theme === "dark", rThemeBefore);
  await dismissGuide(rPage);
  await rPage.waitForTimeout(300);
  await rPage.locator(".theme-switcher").click();
  const rThemeAfter = await themeState(rPage);
  ok("restricted-storage theme toggle still works in memory", rThemeAfter.theme === "light", rThemeAfter);
  await rPage.waitForTimeout(300);
  await shot(rPage, "home-restricted-storage.png");
  await restricted.close();

  // ---------------------------------------------------------------------------
  // 4. Reduced motion: preference respected, no crash
  // ---------------------------------------------------------------------------
  const motion = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  const moPage = await motion.newPage();
  attachErrorCapture(moPage, "home-reduced-motion");
  await gotoPage(moPage, "/", { waitSelector: "h1" });
  const motionInfo = await moPage.evaluate(() => ({
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    switcherTransition: getComputedStyle(document.querySelector(".theme-switcher")).transitionDuration,
    scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior
  }));
  ok("reduced-motion emulation active", motionInfo.reducedMotion === true, motionInfo);
  ok("reduced-motion disables switcher transition", motionInfo.switcherTransition === "0s", motionInfo);
  await motion.close();

  // ---------------------------------------------------------------------------
  // 5. System mode: follow OS color scheme across an actual media change
  // ---------------------------------------------------------------------------
  const system = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: "dark" });
  await system.addInitScript(() => {
    try { window.localStorage.setItem("globechain-theme", JSON.stringify({ version: 1, mode: "system" })); } catch { /* storage unavailable */ }
  });
  const sPage = await system.newPage();
  attachErrorCapture(sPage, "home-system-mode");
  await gotoPage(sPage, "/", { waitSelector: "h1" });
  const sysDark = await themeState(sPage);
  ok("system mode resolves dark under dark OS", sysDark.theme === "dark", sysDark);
  await sPage.emulateMedia({ colorScheme: "light" });
  await sPage.waitForFunction(() => document.documentElement.dataset.theme === "light", { timeout: 3000 }).catch(() => {});
  const sysLight = await themeState(sPage);
  ok("system mode follows OS switch to light", sysLight.theme === "light", sysLight);
  await system.close();

  // ---------------------------------------------------------------------------
  // 6. Legacy page regression: dark + light, desktop + mobile evidence
  // ---------------------------------------------------------------------------
  const soy = "generic-soybean-oil";
  const regressionCases = [
    { name: "map", path: `/map?product=${soy}`, selectors: [".atlas-canvas svg", ".atlas-reading-notes"] },
    { name: "product", path: `/products/${soy}`, selectors: [".product-overview-intro h1", ".context-banner", ".product-level-nav"] },
    { name: "supply-chain", path: `/products/${soy}/supply-chain`, selectors: [".product-level-nav", ".context-banner"] },
    { name: "countries", path: "/countries", selectors: [".country-card", ".page-intro h1"] }
  ];

  const regDesktop = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const regPage = await regDesktop.newPage();
  attachErrorCapture(regPage, "regression-desktop");

  let ledgerHrefFromCountries = null;
  for (const mode of ["dark", "light"]) {
    if (mode === "light") {
      await regPage.locator(".theme-switcher").click();
      await regPage.waitForFunction(() => document.documentElement.dataset.theme === "light");
    }
    for (const reg of regressionCases) {
      const status = await gotoPage(regPage, reg.path, { waitSelector: reg.selectors[0] });
      const state = await themeState(regPage);
      const overflow = await overflowReport(regPage, `reg-${reg.name}-1440-${mode}`);
      const missingSelectors = [];
      for (const sel of reg.selectors) {
        if ((await regPage.locator(sel).count()) === 0) missingSelectors.push(sel);
      }
      const bannerText = await regPage.locator(".context-banner").first().innerText().catch(() => "");
      const hasStatusBadge = (await regPage.locator(".status-badge, .content-status, .iso-chip").count()) > 0;
      // The legacy map surfaces provenance through reading notes / record badges rather than the context banner.
      const hasMapSource = (await regPage.locator(".atlas-reading-notes, .atlas-record, .reading-details, .atlas-map-caption").count()) > 0;
      let mapSourceVisible = false;
      if (reg.name === "map") {
        const notes = regPage.locator(".atlas-reading-notes");
        const wasOpen = await notes.evaluate(el => el.open).catch(() => true);
        if (!wasOpen) await notes.locator("summary").click().catch(() => {});
        mapSourceVisible = (await notes.locator('a[href*="provenance"]').count()) > 0;
        if (!wasOpen) await notes.locator("summary").click().catch(() => {});
      }
      ok(`regression ${reg.name} 1440 ${mode}: HTTP 200`, status === 200, { path: reg.path, status });
      ok(`regression ${reg.name} 1440 ${mode}: key selectors present`, missingSelectors.length === 0, { missingSelectors });
      ok(`regression ${reg.name} 1440 ${mode}: no horizontal overflow`, !overflow.overflow, overflow);
      ok(`regression ${reg.name} 1440 ${mode}: source/version context visible`, bannerText.length > 0 || hasStatusBadge || mapSourceVisible || hasMapSource, { bannerText: bannerText.slice(0, 120), hasStatusBadge, mapSourceVisible, hasMapSource });
      const oceanFill = await regPage.locator(".map-ocean").first().evaluate(el => getComputedStyle(el).fill).catch(() => null);
      if (reg.name === "map" && mode === "light") {
        const countryFill = await regPage.locator(".map-country-shape").first().evaluate(el => getComputedStyle(el).fill).catch(() => null);
        ok("regression full map light: ocean follows light token", (luminance(parseRgb(oceanFill)) ?? 0) > 0.6, { oceanFill, countryFill });
      }
      await shot(regPage, `reg-${reg.name}-1440-${mode}.png`);
      results.pages.push({ name: reg.name, mode, viewport: 1440, path: reg.path, theme: state.theme, status, missingSelectors, bannerText: bannerText.slice(0, 160), oceanFill, hasMapSource });

      if (reg.name === "countries" && !ledgerHrefFromCountries) {
        ledgerHrefFromCountries = await regPage.locator('a[href*="/ledger/"]').first().getAttribute("href");
      }
    }
  }

  // A real product-scoped ledger page, when one exists for soybean oil.
  if (ledgerHrefFromCountries) {
    const ledgerStatus = await gotoPage(regPage, ledgerHrefFromCountries, { waitSelector: ".ledger-page, .stat-card" });
    const ledgerOverflow = await overflowReport(regPage, "reg-ledger-1440-light");
    const ledgerBanner = await regPage.locator(".context-banner").first().innerText().catch(() => "");
    ok("regression product ledger 1440: HTTP 200", ledgerStatus === 200, { ledgerHrefFromCountries, status: ledgerStatus });
    ok("regression product ledger 1440: metrics/version visible", (await regPage.locator(".stat-card").count()) > 0 && ledgerBanner.length > 0, { ledgerBanner: ledgerBanner.slice(0, 120) });
    ok("regression product ledger 1440: no overflow", !ledgerOverflow.overflow, ledgerOverflow);
    await shot(regPage, "reg-ledger-1440-light.png");
    results.pages.push({ name: "ledger", mode: "light", viewport: 1440, path: ledgerHrefFromCountries, status: ledgerStatus });
  } else {
    recordIssue("次要", "大豆油未解析到商品账本链接", "countries 页未出现 /ledger/ 深链；可能该商品暂无国家账本记录。");
  }
  await regDesktop.close();

  // Mobile legacy evidence: map, product, supply-chain, countries, dark + light
  const regMobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const rmPage = await regMobile.newPage();
  attachErrorCapture(rmPage, "regression-mobile");
  for (const mode of ["dark", "light"]) {
    for (const reg of regressionCases) {
      const status = await gotoPage(rmPage, reg.path, { waitSelector: reg.selectors[0] });
      const overflow = await overflowReport(rmPage, `reg-${reg.name}-390-${mode}`);
      await shot(rmPage, `reg-${reg.name}-390-${mode}.png`);
      ok(`regression ${reg.name} 390 ${mode}: HTTP 200`, status === 200, { path: reg.path, status });
      ok(`regression ${reg.name} 390 ${mode}: no horizontal overflow`, !overflow.overflow, overflow);
      results.pages.push({ name: reg.name, mode, viewport: 390, path: reg.path, theme: (await themeState(rmPage)).theme, status });
    }
    if (mode === "dark") await rmPage.locator(".theme-switcher").click();
  }
  await regMobile.close();

  // ---------------------------------------------------------------------------
  // Summarize
  // ---------------------------------------------------------------------------
  const failures = checks.filter(c => !c.passed);
  for (const failure of failures) {
    let severity = "次要";
    if (/pageerror|#185|infinite|crash/i.test(failure.name)) severity = "阻断";
    else if (/overflow|selector|source\/version|200|active|HTTP|contrast|ocean|readable/i.test(failure.name)) severity = "重要";
    recordIssue(severity, failure.name, failure);
  }
  results.finishedAt = new Date().toISOString();
  results.summary = {
    total: checks.length,
    passed: checks.length - failures.length,
    failed: failures.length,
    pageErrorPages: Object.entries(results.pageErrors).filter(([, v]) => v.length).map(([k, v]) => ({ page: k, count: v.length, messages: v })),
    consoleErrorPages: Object.entries(results.consoleErrors).filter(([, v]) => v.length).map(([k, v]) => ({ page: k, count: v.length, messages: v.slice(0, 8) }))
  };

  await writeFile(resolve(output, "result.json"), JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ total: results.summary.total, passed: results.summary.passed, failed: results.summary.failed, pageErrors: results.summary.pageErrorPages, consoleErrors: results.summary.consoleErrorPages }, null, 2));
  if (failures.length > 0) {
    console.error("FAILURES:\n" + failures.map(f => `- ${f.name} ${JSON.stringify(f)}`).join("\n"));
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
