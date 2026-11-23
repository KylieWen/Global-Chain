/**
 * Batch 4 (experience rebuild 2026-11) China map + dynamic-site round-trip acceptance.
 *
 * Starts one clean `next start` production instance, drives it with Playwright +
 * installed Chrome, and writes screenshots + result.json to
 * output/qa/experience-rebuild-2026-11/batch-4-china. Does not touch data, domain
 * layer, release manifests, the public site or Qoder; does not commit or publish.
 *
 * Coverage:
 *   - 1440 dark/light: all five published products on /map/china
 *   - Air conditioner ac-nb node detail (Zhejiang / material), dark + light
 *   - Cotton T-shirt Beijing empty state + back to nationwide
 *   - 390 viewport: no page horizontal overflow, theme switcher 44px, node hit area
 *   - World → China → enterprise → back: year/items/country/direction/measure/
 *     layer/scope and province/stage/node preserved via nested map=/china=
 *
 * Usage:
 *   node scripts/verify-batch4-china.mjs
 *   REVIEW_BASE_URL / REVIEW_OUTPUT_DIR / BROWSER_TEST_PORT can override defaults.
 * Exit 0 = all checks passed; 1 = at least one failed check.
 */
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "node:net";

const root = resolve(import.meta.dirname, "..");
const port = Number(process.env.BROWSER_TEST_PORT ?? 4321);
const base = process.env.REVIEW_BASE_URL ?? `http://127.0.0.1:${port}`;
const output = resolve(process.env.REVIEW_OUTPUT_DIR ?? "output/qa/experience-rebuild-2026-11/batch-4-china");
await mkdir(output, { recursive: true });

const PRODUCTS = [
  { id: "generic-smartphone", label: "智能手机" },
  { id: "generic-cotton-tshirt", label: "棉质T恤" },
  { id: "generic-soybean-oil", label: "大豆食用油" },
  { id: "generic-electric-bicycle", label: "电动自行车" },
  { id: "generic-home-air-conditioner", label: "家用空调" }
];
const AC = "generic-home-air-conditioner";
const COTTON = "generic-cotton-tshirt";

const results = {
  base,
  startedAt: new Date().toISOString(),
  browser: {},
  checks: [],
  observations: [],
  urlStates: [],
  screenshots: [],
  issues: []
};
const checks = results.checks;
const ok = (name, passed, detail = {}) => checks.push({ name, passed: Boolean(passed), ...detail });
const observe = (section, data) => results.observations.push({ section, ...data });
const recordUrl = (step, url) => results.urlStates.push({ step, url });

async function shot(page, name) {
  await page.screenshot({ path: resolve(output, name), fullPage: false });
  results.screenshots.push(name);
}

async function dismissGuide(page) {
  const dialog = page.getByRole("dialog", { name: "Global Chain 新手引导", exact: true });
  try {
    await dialog.waitFor({ state: "visible", timeout: 2000 });
    await dialog.locator('[data-guide-action="skip"]').click();
    await dialog.waitFor({ state: "detached", timeout: 2000 });
  } catch { /* absent or already closed */ }
}

async function gotoPage(page, path, { waitSelector, retries = 4 } = {}) {
  let response = null; let lastError = null;
  for (let i = 0; i <= retries; i += 1) {
    try {
      response = await page.goto(base + path, { waitUntil: "domcontentloaded", timeout: 15000 });
      lastError = null; break;
    } catch (e) {
      lastError = e;
      const msg = String(e?.message ?? e);
      if (/ERR_CONNECTION_REFUSED|ECONNREFUSED|net::ERR_|Navigation timeout/i.test(msg) && i < retries) {
        await new Promise(r => setTimeout(r, 2000)); continue;
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
  results.pageErrors ??= {}; results.consoleErrors ??= {};
  results.pageErrors[label] = []; results.consoleErrors[label] = [];
  page.on("pageerror", error => results.pageErrors[label].push(String(error?.message ?? error)));
  page.on("console", message => {
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
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  }));
}

async function ensureTheme(page, target) {
  const state = await themeState(page);
  if (state.theme !== target) {
    await page.locator(".theme-switcher").click();
    await page.waitForFunction(t => document.documentElement.dataset.theme === t, { arg: target, timeout: 3000 }).catch(() => {});
  }
  return themeState(page);
}

async function readRegional(page) {
  return page.evaluate(() => {
    const panel = document.querySelector(".regional-map-panel");
    const details = document.querySelector(".regional-details");
    const panelStyle = panel ? getComputedStyle(panel) : null;
    const detailsStyle = details ? getComputedStyle(details) : null;
    const hitBoxes = [...document.querySelectorAll(".regional-node-hit")].map(el => {
      const r = el.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    });
    const switcher = document.querySelector(".theme-switcher");
    const switcherBox = switcher ? switcher.getBoundingClientRect() : null;
    return {
      provinces: document.querySelectorAll(".china-province[role=button]").length,
      nodes: document.querySelectorAll(".regional-node").length,
      nodeListButtons: document.querySelectorAll(".regional-node-list button").length,
      connections: document.querySelectorAll(".regional-connection").length,
      panelBg: panelStyle ? panelStyle.backgroundImage || panelStyle.backgroundColor : null,
      detailsBg: detailsStyle ? detailsStyle.backgroundColor : null,
      hitBoxes,
      switcher: switcherBox ? { w: Math.round(switcherBox.width), h: Math.round(switcherBox.height) } : null,
      emptyVisible: document.querySelector(".regional-empty") !== null,
      activeNode: document.querySelector(".regional-node.active")?.getAttribute("title") ?? document.querySelector(".regional-details h2")?.textContent?.trim() ?? null
    };
  });
}

function parseNested(inner) {
  return Object.fromEntries(new URLSearchParams(inner ?? ""));
}

// --- Start one clean production server (refuse occupied port) ---
const probe = createServer();
await new Promise((done, reject) => { probe.once("error", reject); probe.listen(port, "127.0.0.1", () => probe.close(done)); });
const log = createWriteStream(resolve(output, "server.log"));
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], {
  cwd: resolve(root, "apps/web"), env: { ...process.env, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1" }, windowsHide: true, stdio: ["ignore", "pipe", "pipe"]
});
server.stdout.pipe(log, { end: false }); server.stderr.pipe(log, { end: false });
let serverFailure; server.on("error", error => { serverFailure = error; });
const closed = new Promise(done => server.once("close", done));

let browser;
try {
  const deadline = Date.now() + 60000;
  let ready = false;
  while (Date.now() < deadline) {
    if (serverFailure) throw serverFailure;
    if (server.exitCode !== null) throw new Error(`Preview exited ${server.exitCode}; see ${output}/server.log`);
    try {
      const response = await fetch(base + "/api/health", { signal: AbortSignal.timeout(1000) });
      if (response.ok) { ready = true; break; }
    } catch { /* still warming up */ }
    await new Promise(r => setTimeout(r, 250));
  }
  if (!ready) throw new Error("Production preview did not become ready");

  browser = await chromium.launch({ channel: "chrome", headless: true });
  results.browser.name = "Chrome (Playwright channel=chrome)";
  results.browser.headless = true;

  // ============ A. 1440 dark: five products on the China atlas ============
  const darkCtx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const darkPage = await darkCtx.newPage();
  attachErrorCapture(darkPage, "dark-1440");
  for (const product of PRODUCTS) {
    const status = await gotoPage(darkPage, `/map/china?product=${product.id}`, { waitSelector: ".china-supply-map" });
    const theme = await ensureTheme(darkPage, "dark");
    const regional = await readRegional(darkPage);
    const noOverflow = !theme.overflow;
    ok(`dark 1440 ${product.label}: 34 provinces, nodes/connections present`, regional.provinces === 34 && regional.nodes > 0 && regional.connections > 0, { status, ...regional, theme });
    ok(`dark 1440 ${product.label}: no page horizontal overflow`, noOverflow, { scrollWidth: theme.scrollWidth, clientWidth: theme.clientWidth });
    observe("dark-china", { product: product.id, provinces: regional.provinces, nodes: regional.nodes, connections: regional.connections });
    await shot(darkPage, `dark-china-${product.id}.png`);
  }

  // ============ B. 1440 light: five products, no residual deep-blue panel ============
  const lightCtx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const lightPage = await lightCtx.newPage();
  attachErrorCapture(lightPage, "light-1440");
  for (const product of PRODUCTS) {
    await gotoPage(lightPage, `/map/china?product=${product.id}`, { waitSelector: ".china-supply-map" });
    const theme = await ensureTheme(lightPage, "light");
    const regional = await readRegional(lightPage);
    const panel = regional.panelBg ?? "";
    const legacyDeepBlue = /rgb\(37,\s*70,\s*83\)|rgb\(16,\s*41,\s*56\)|#254653|#102938/i.test(panel);
    ok(`light 1440 ${product.label}: panel is light, no legacy deep-blue gradient`, !legacyDeepBlue && !theme.overflow, { panelBg: panel, theme });
    observe("light-china", { product: product.id, panelBg: panel, nodes: regional.nodes });
    await shot(lightPage, `light-china-${product.id}.png`);
  }

  // ============ C. AC ac-nb detail, dark + light ============
  const acUrl = `/map/china?product=${AC}&province=330000&stage=material&node=ac-nb`;
  await gotoPage(darkPage, acUrl, { waitSelector: ".regional-details" });
  await ensureTheme(darkPage, "dark");
  let acDark = await readRegional(darkPage);
  const darkDetailLink = await darkPage.locator('.regional-details a[href*="/industry"]').getAttribute("href");
  ok("dark AC ac-nb detail: node rendered and industry link present", /宁波|铜管/.test(acDark.activeNode ?? "") && Boolean(darkDetailLink), { activeNode: acDark.activeNode, industryHref: darkDetailLink, detailsBg: acDark.detailsBg });
  recordUrl("dark-ac-detail", darkPage.url());
  await shot(darkPage, "dark-ac-detail.png");

  await gotoPage(lightPage, acUrl, { waitSelector: ".regional-details" });
  await ensureTheme(lightPage, "light");
  const acLight = await readRegional(lightPage);
  const lightDetailLink = await lightPage.locator('.regional-details a[href*="/industry"]').getAttribute("href");
  const lightDetails = acLight.detailsBg ?? "";
  ok("light AC ac-nb detail: aside uses the light surface or transparent inheritance, not a dark mismatch", (/rgb\(255,\s*255,\s*255\)|rgb\(247,\s*249,\s*251\)|rgba\(0,\s*0,\s*0,\s*0\)/.test(lightDetails)) && Boolean(lightDetailLink), { detailsBg: lightDetails, activeNode: acLight.activeNode, industryHref: lightDetailLink });
  observe("ac-detail", { darkBg: acDark.detailsBg, lightBg: lightDetails });
  await shot(lightPage, "light-ac-detail.png");

  // ============ D. Cotton T-shirt Beijing empty state ============
  await gotoPage(darkPage, `/map/china?product=${COTTON}&province=110000`, { waitSelector: ".regional-empty" });
  await ensureTheme(darkPage, "dark");
  const cottonEmpty = await readRegional(darkPage);
  ok("cotton T Beijing: empty-state message visible, no node list", cottonEmpty.emptyVisible && cottonEmpty.nodeListButtons === 0, { nodes: cottonEmpty.nodes, nodeListButtons: cottonEmpty.nodeListButtons });
  recordUrl("cotton-empty", darkPage.url());
  await shot(darkPage, "dark-cotton-empty.png");
  await darkPage.locator(".regional-empty button").click();
  await darkPage.waitForURL(url => !url.searchParams.has("province"), { timeout: 5000 });
  const afterReset = await readRegional(darkPage);
  ok("cotton T: back to nationwide restores nodes", afterReset.nodes > 0, { url: darkPage.url(), nodes: afterReset.nodes });

  // ============ E. 390 touch: overflow, switcher target, node hit area ============
  const mobileCtx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mobilePage = await mobileCtx.newPage();
  attachErrorCapture(mobilePage, "mobile-390");
  await gotoPage(mobilePage, `/map/china?product=${AC}`, { waitSelector: ".china-supply-map" });
  await ensureTheme(mobilePage, "dark");
  let mobile = await readRegional(mobilePage);
  let mobileTheme = await themeState(mobilePage);
  const hitMin = mobile.hitBoxes.map(b => Math.min(b.w, b.h));
  const hitMedian = hitMin.length ? [...hitMin].sort((a, b) => a - b)[Math.floor(hitMin.length / 2)] : 0;
  ok("390 dark: no page horizontal overflow", !mobileTheme.overflow, { scrollWidth: mobileTheme.scrollWidth, clientWidth: mobileTheme.clientWidth });
  ok("390 dark: theme switcher reaches 44px touch target", mobile.switcher && mobile.switcher.h >= 44 && mobile.switcher.w >= 44, { switcher: mobile.switcher });
  ok("390 dark: median node hit box ≥ 36px toward the 44px target", hitMin.length > 0 && hitMedian >= 36, { hitCount: hitMin.length, hitMedian, hitMin: Math.min(...hitMin) });
  observe("mobile-390", { hitBoxes: mobile.hitBoxes.length, hitMedian, hitMin: Math.min(...hitMin), switcher: mobile.switcher });
  await shot(mobilePage, "mobile-390-china-dark.png");

  await gotoPage(mobilePage, `/map?product=${AC}&layer=trade&scope=bilateral&items=${AC}&direction=export&measure=quantity&country=country-cn&year=2024`, { waitSelector: ".world-country-map" });
  await ensureTheme(mobilePage, "dark");
  const mobileWorld = await themeState(mobilePage);
  ok("390 dark: world map no horizontal overflow", !mobileWorld.overflow, { scrollWidth: mobileWorld.scrollWidth, clientWidth: mobileWorld.clientWidth });
  await shot(mobilePage, "mobile-390-world-dark.png");

  await ensureTheme(mobilePage, "light");
  await gotoPage(mobilePage, `/map/china?product=${AC}`, { waitSelector: ".china-supply-map" });
  const mobileLight = await themeState(mobilePage);
  ok("390 light: no page horizontal overflow", !mobileLight.overflow, { scrollWidth: mobileLight.scrollWidth, clientWidth: mobileLight.clientWidth });
  await shot(mobilePage, "mobile-390-china-light.png");

  // ============ F. Round trip: world → China → enterprise → back ============
  const r3Ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const r3 = await r3Ctx.newPage();
  attachErrorCapture(r3, "round-trip");
  const worldUrl = `/map?product=${AC}&layer=trade&scope=bilateral&items=${AC}&direction=export&measure=quantity&country=country-cn&year=2024`;
  await gotoPage(r3, worldUrl, { waitSelector: ".world-country-map" });
  await ensureTheme(r3, "dark");
  recordUrl("world-before", r3.url());

  await r3.locator(".atlas-directory-link").click();
  await r3.waitForURL(/\/map\/china/, { timeout: 8000 });
  await r3.locator(".china-supply-map").waitFor({ timeout: 8000 });
  recordUrl("china-from-world", r3.url());
  const chinaParams = new URL(r3.url()).searchParams;
  const nestedWorld = parseNested(chinaParams.get("map"));
  ok("world → china: nested map= keeps year/items/country/direction/measure/layer/scope",
    nestedWorld.year === "2024" && nestedWorld.items === AC && nestedWorld.country === "country-cn" &&
    nestedWorld.direction === "export" && nestedWorld.measure === "quantity" &&
    nestedWorld.layer === "trade" && nestedWorld.scope === "bilateral", { nestedWorld });

  await r3.locator('select[aria-label="中国地图省份"]').selectOption("330000");
  await r3.locator('select[aria-label="中国地图生产环节"]').selectOption("material");
  await r3.locator('.regional-node-list button[aria-label*="宁波"]').first().click();
  await r3.waitForURL(/node=ac-nb/, { timeout: 5000 });
  recordUrl("china-detail", r3.url());
  const chinaDetailParams = new URL(r3.url()).searchParams;
  ok("china detail: province/stage/node in URL and nested map retained",
    chinaDetailParams.get("province") === "330000" && chinaDetailParams.get("stage") === "material" &&
    chinaDetailParams.get("node") === "ac-nb" && Boolean(chinaDetailParams.get("map")), {
      province: chinaDetailParams.get("province"), stage: chinaDetailParams.get("stage"), node: chinaDetailParams.get("node"), hasMap: Boolean(chinaDetailParams.get("map"))
    });

  await r3.locator('.regional-details a[href*="/industry"]').click();
  await r3.waitForURL(/\/industry/, { timeout: 8000 });
  recordUrl("industry-from-china", r3.url());
  const industryParams = new URL(r3.url()).searchParams;
  const nestedChina = parseNested(industryParams.get("china"));
  const nestedWorldFromChina = parseNested(nestedChina.map);
  ok("china → enterprise: nested china= keeps province/stage/node and upstream world filters",
    nestedChina.province === "330000" && nestedChina.stage === "material" && nestedChina.node === "ac-nb" &&
    nestedWorldFromChina.direction === "export" && nestedWorldFromChina.country === "country-cn" &&
    nestedWorldFromChina.year === "2024", { nestedChina, nestedWorldFromChina });

  await r3.reload({ waitUntil: "domcontentloaded" });
  await dismissGuide(r3);
  const industryAfterReload = new URL(r3.url()).searchParams;
  ok("enterprise reload: china= state survives server render", Boolean(industryAfterReload.get("china")), { url: r3.url() });

  await r3.locator('.product-level-nav a[href*="/map/china"]').click();
  await r3.waitForURL(/\/map\/china/, { timeout: 8000 });
  recordUrl("back-to-china", r3.url());
  const backChina = new URL(r3.url()).searchParams;
  const backChinaNested = parseNested(backChina.get("map"));
  ok("enterprise → back to china: province/stage/node and nested world filters restored",
    backChina.get("province") === "330000" && backChina.get("stage") === "material" && backChina.get("node") === "ac-nb" &&
    backChinaNested.direction === "export" && backChinaNested.country === "country-cn", { backChina: Object.fromEntries(backChina), backChinaNested });

  await r3.locator('.product-level-nav a[href*="/map?"]').first().click();
  await r3.waitForURL(/\/map\?/, { timeout: 8000 });
  recordUrl("back-to-world", r3.url());
  const backWorld = Object.fromEntries(new URL(r3.url()).searchParams);
  ok("china → back to world: year/items/country/direction/measure/layer/scope restored",
    backWorld.year === "2024" && backWorld.items === AC && backWorld.country === "country-cn" &&
    backWorld.direction === "export" && backWorld.measure === "quantity" &&
    backWorld.layer === "trade" && backWorld.scope === "bilateral", { backWorld });
  await shot(r3, "round-trip-back-to-world.png");

  // --- Error summary ---
  for (const label of Object.keys(results.pageErrors ?? {})) {
    const pageErrors = results.pageErrors[label] ?? [];
    const consoleErrors = (results.consoleErrors[label] ?? []).filter(m => !/favicon\.ico/.test(m));
    ok(`no page/console errors on ${label}`, pageErrors.length === 0 && consoleErrors.length === 0, {
      pageErrorCount: pageErrors.length, consoleErrorCount: consoleErrors.length,
      pageErrorMessages: pageErrors.slice(0, 5), consoleErrorMessages: consoleErrors.slice(0, 8)
    });
  }
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server.exitCode === null) server.kill();
  await closed;
  log.end();
}

results.finishedAt = new Date().toISOString();
const failed = results.checks.filter(c => !c.passed);
results.passed = failed.length === 0;
await writeFile(resolve(output, "result.json"), JSON.stringify(results, null, 2));
console.log(`Batch 4 China acceptance: ${results.checks.length - failed.length}/${results.checks.length} checks passed`);
if (failed.length) {
  for (const f of failed) console.log(`FAIL ${f.name}`, JSON.stringify(f.detail ?? {}));
  process.exit(1);
}
