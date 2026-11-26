/**
 * 公开版未登录验收探针（2026-11-26 overnight）。
 *
 * 只读驱动一个已部署的公开基线，不登录、不部署、不发布、不构建、不访问
 * 任何模型/LLM。复用既有 Playwright + 本机 Chrome 采证约定（参照
 * scripts/verify-qoder-competition.mjs、scripts/verify-renderer-branches.mjs、
 * tmp/overnight-2026-11-26/drone-reference-replica/capture-reference-replica.mjs）。
 *
 * 覆盖：
 *   - 六商品概览 / 资料来源数据版本 / 地图商品联动
 *   - 首页 → 地图 → 无人机工作台 → 代表性路线 / 材料贸易 → 国家账本
 *   - 无人机装配 / 爆炸 / 云台点选 / 复原；深浅主题；390 移动端
 *   - 全页面 pageerror 与 console error；横向溢出
 *
 * 诚实规则：若公开基线仍是旧版、无人机商品/工作台未发布，脚本必须把
 * 无人机相关检查明确记为失败并写入缺陷清单，不得因为页面可打开就假装通过。
 * 本脚本不做像素或视觉复刻判断，外观接近与否由主模型看图定夺。
 *
 * Usage:
 *   # 本地演通（当前生产实例）：
 *   REVIEW_BASE_URL=http://127.0.0.1:4320 \
 *   REVIEW_OUTPUT_DIR=output/qa/overnight-2026-11-26/public-release/public-acceptance \
 *   node scripts/verify-public-acceptance.mjs
 *
 *   # 实际发布后对公网执行：
 *   REVIEW_BASE_URL=https://globechain-lwf8uwcgl59.qoder.zone \
 *   REVIEW_OUTPUT_DIR=output/qa/overnight-2026-11-26/public-release/public-acceptance \
 *   node scripts/verify-public-acceptance.mjs
 */
import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const base = (process.env.REVIEW_BASE_URL ?? "https://globechain-lwf8uwcgl59.qoder.zone").replace(/\/+$/, "");
const output = resolve(process.env.REVIEW_OUTPUT_DIR ?? "output/qa/overnight-2026-11-26/public-release/public-acceptance");
await mkdir(output, { recursive: true });

const manifest = JSON.parse(await readFile("data/published/manifest.json", "utf8"));
const EXPECTED_VERSIONS = Object.fromEntries(manifest.fixtures.map((f) => [f.productId, f.datasetVersion]));
const PRODUCT_IDS = manifest.fixtures.map((f) => f.productId);

const DRONE = "generic-camera-drone";
const GIMBAL_FOCUS = "drone-gimbal-camera";
const LEDGER_PRODUCT = "generic-soybean-oil";
const LEDGER_ENTITY = "country-cn";

const results = {
  base,
  startedAt: new Date().toISOString(),
  products: {},
  drone: {},
  theme: {},
  mobile: {},
  checks: [],
  observations: [],
  defects: [],
  pageErrors: {},
  consoleErrors: {}
};

const checks = results.checks;
const ok = (name, passed, detail = {}) => checks.push({ name, passed, ...detail });
const observe = (section, detail) => results.observations.push({ section, ...detail });
const defect = (title, detail = {}, critical = false) => results.defects.push({ title, critical, ...detail });

function attachErrorCapture(page, label) {
  results.pageErrors[label] = [];
  results.consoleErrors[label] = [];
  page.on("pageerror", (error) => results.pageErrors[label].push(String(error?.message ?? error)));
  page.on("console", (message) => {
    if (message.type() === "error" && !/favicon/.test(message.text())) {
      results.consoleErrors[label].push(message.text().slice(0, 300));
    }
  });
}

const SKIP_GUIDE = () => localStorage.setItem("global-chain.first-visit-guide.v1", "skipped");

async function dismissGuide(page) {
  const dialog = page.getByRole("dialog", { name: /新手引导|Global Chain/ });
  try {
    await dialog.waitFor({ state: "visible", timeout: 2000 });
    await dialog.locator('[data-guide-action="skip"]').evaluate((el) => el.click());
    await dialog.waitFor({ state: "detached", timeout: 2000 });
  } catch { /* 已关闭或不存在 */ }
}

async function goto(page, path) {
  try {
    const response = await page.goto(new URL(path, base).href, { waitUntil: "networkidle", timeout: 60000 });
    return { status: response?.status() ?? 0, ok: (response?.status() ?? 0) < 400 };
  } catch (error) {
    return { status: 0, ok: false, error: String(error?.message ?? error) };
  }
}

async function shot(page, name) {
  await page.screenshot({ path: resolve(output, name), fullPage: false });
}

/** 工作台/拆解页探针：新旧两条路径都识别。 */
function probeWorkstation() {
  const ws = document.querySelector(".drone-workstation");
  const explorer = document.querySelector(".exploded-explorer");
  const wrap = document.querySelector(".drone-stage-wrap, .exploded-canvas-wrap, .exploded-three-wrap");
  const slider = document.querySelector('.drone-slider input[type="range"], .exploded-slider input[type="range"]');
  const pressed = [...document.querySelectorAll(".drone-tree-button[aria-pressed='true'], .exploded-node-list-item[aria-pressed='true']")]
    .map((el) => el.textContent?.trim() ?? "");
  const detailH3 = document.querySelector(".exploded-detail-header h3")?.textContent?.trim() ?? null;
  const labels = [...document.querySelectorAll(".exploded-three-label")]
    .filter((el) => el.style.display !== "none")
    .map((el) => el.textContent?.trim() ?? "");
  const doc = document.documentElement;
  return {
    uiPath: ws ? "drone-workstation" : explorer ? "exploded-explorer" : "none",
    workstation: Boolean(ws),
    explorer: Boolean(explorer),
    wrap: Boolean(wrap),
    renderer: wrap?.dataset.renderer ?? null,
    treeButtons: document.querySelectorAll(".drone-tree-button, .exploded-node-list-item").length,
    detailH3,
    pressed,
    labels,
    slider: Boolean(slider),
    sliderValue: slider ? Number(slider.value) : null,
    reset: document.querySelectorAll(".drone-reset, .exploded-reset").length,
    play: document.querySelectorAll(".drone-play").length,
    overflowX: Math.max(0, doc.scrollWidth - doc.clientWidth)
  };
}

async function setSlider(page, value) {
  const slider = page.locator('.drone-slider input[type="range"], .exploded-slider input[type="range"]').first();
  if ((await slider.count()) === 0) return null;
  await slider.evaluate((input, v) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(input, String(v));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
  await page.waitForTimeout(500);
  return (await slider.inputValue());
}

async function readDatasetVersion(page) {
  return page.evaluate(() => {
    const card = [...document.querySelectorAll(".stat-card")]
      .find((el) => el.querySelector(".stat-label")?.textContent?.trim() === "数据集版本");
    if (card) return card.querySelector(".stat-value")?.textContent?.trim() ?? null;
    // 旧 competition 独立包：版本直接写在资料来源卡片文本里。
    const text = [...document.querySelectorAll(".competition-card")].map((el) => el.textContent ?? "").join("\n");
    return text.match(/globe-chain-[a-z0-9-]+-\d{4}\.\d+/)?.[0] ?? null;
  });
}

/** 地图商品选择器位于可折叠筛选胶囊内，可能不可见；用 CSS 定位读值，不依赖可见性。 */
async function readMapProduct(page) {
  const select = page.locator('select[aria-label="选择商品"]').first();
  if ((await select.count()) === 0) return null;
  return select.inputValue().catch(() => null);
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
results.browser = { name: "Chrome (Playwright channel=chrome)", headless: true, launchedAt: new Date().toISOString() };

try {
  /* ---------------------------------------------------------------------- */
  /* 1. 首页                                                                 */
  /* ---------------------------------------------------------------------- */
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await desktop.addInitScript(SKIP_GUIDE);
  const homePage = await desktop.newPage();
  attachErrorCapture(homePage, "home");
  const homeRes = await goto(homePage, "/");
  await dismissGuide(homePage);
  const homeProbe = await homePage.evaluate(() => ({
    hero: Boolean(document.querySelector(".home-hero")),
    h1: document.querySelector(".home-hero h1, main h1")?.textContent?.trim() ?? null,
    mapLinks: document.querySelectorAll('a[href^="/map"]').length,
    previewBundle: Boolean(document.querySelector('script[src="/preview.js"]')),
    nextChunk: document.querySelectorAll('script[src*="/_next/"]').length
  }));
  observe("home", { ...homeRes, ...homeProbe });
  ok("home: 首页可打开且含主标题", homeRes.ok && Boolean(homeProbe.h1), homeProbe);
  ok("home: 存在进入地图的链接", homeProbe.mapLinks > 0, homeProbe);
  await shot(homePage, "home-1440.png");

  /* ---------------------------------------------------------------------- */
  /* 2. 地图（无人机商品联动）                                                 */
  /* ---------------------------------------------------------------------- */
  const mapPage = await desktop.newPage();
  attachErrorCapture(mapPage, "map-drone");
  const mapRes = await goto(mapPage, `/map?product=${DRONE}`);
  await dismissGuide(mapPage);
  await mapPage.locator(".world-country-map").waitFor({ timeout: 10000 }).catch(() => {});
  let mapProduct = await readMapProduct(mapPage);
  const mapProbe = await mapPage.evaluate(() => ({
    svg: Boolean(document.querySelector(".world-country-map")),
    records: document.querySelectorAll(".atlas-record").length
  }));
  observe("map-drone", { ...mapRes, mapProduct, ...mapProbe });
  ok("map: 地图可打开且国家轮廓在位", mapRes.ok && mapProbe.svg, mapProbe);
  ok("map: 商品选择器联动到无人机", mapProduct === DRONE, { mapProduct });
  await shot(mapPage, "map-drone-1440.png");
  await desktop.close();

  /* ---------------------------------------------------------------------- */
  /* 3. 六商品 sweep：概览 / 资料来源版本 / 地图联动                            */
  /* ---------------------------------------------------------------------- */
  const sweepCtx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await sweepCtx.addInitScript(SKIP_GUIDE);
  const sweepPage = await sweepCtx.newPage();
  attachErrorCapture(sweepPage, "product-sweep");

  for (const productId of PRODUCT_IDS) {
    const expected = EXPECTED_VERSIONS[productId];
    const entry = { productId, expectedVersion: expected };

    const overviewRes = await goto(sweepPage, `/products/${productId}`);
    await dismissGuide(sweepPage);
    const overviewProbe = await sweepPage.evaluate(() => ({
      h1: document.querySelector(".product-overview-page h1, main h1")?.textContent?.trim() ?? null,
      workstation: Boolean(document.querySelector(".drone-workstation")),
      explorer: Boolean(document.querySelector(".exploded-explorer")),
      navItems: document.querySelectorAll(".product-level-nav a").length
    }));
    entry.overview = { ...overviewRes, ...overviewProbe };
    ok(`${productId}: 概览页可打开`, overviewRes.ok && Boolean(overviewProbe.h1), entry.overview);

    const provRes = await goto(sweepPage, `/products/${productId}/provenance`);
    await dismissGuide(sweepPage);
    const servedVersion = provRes.ok ? await readDatasetVersion(sweepPage) : null;
    entry.provenance = { ...provRes, servedVersion };
    entry.versionMatch = servedVersion === expected;
    ok(`${productId}: 资料来源数据版本与清单一致`, entry.versionMatch, { expected, served: servedVersion, status: provRes.status });

    const mapRes = await goto(sweepPage, `/map?product=${productId}`);
    const combo = await readMapProduct(sweepPage);
    entry.map = { ...mapRes, combo };
    ok(`${productId}: 地图商品选择器同步`, combo === productId, { combo });

    results.products[productId] = entry;
  }
  await sweepCtx.close();

  /* ---------------------------------------------------------------------- */
  /* 4. 无人机工作台深潜（装配 / 云台点选 / 爆炸 / 复原 / 路线 / 材料）          */
  /* ---------------------------------------------------------------------- */
  const droneCtx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await droneCtx.addInitScript(SKIP_GUIDE);
  const dronePage = await droneCtx.newPage();
  attachErrorCapture(dronePage, "drone-workstation");

  const droneRes = await goto(dronePage, `/products/${DRONE}`);
  await dismissGuide(dronePage);
  await dronePage.waitForSelector(".drone-workstation, .exploded-explorer", { timeout: 8000 }).catch(() => {});
  const droneProbe = await dronePage.evaluate(probeWorkstation);
  const droneMounted = droneProbe.workstation || droneProbe.explorer;
  results.drone.overview = { ...droneRes, ...droneProbe };
  observe("drone-overview", results.drone.overview);

  if (!droneMounted) {
    // 旧版公开基线：无人机未发布。明确记失败，不假装通过。
    ok("drone: 工作台在公开基线挂载", false, { status: droneRes.status, ...droneProbe });
    defect("无人机商品/工作台未在公开基线挂载", { status: droneRes.status, probe: droneProbe, hint: "公开站可能仍是旧版；待实际发布后重跑本脚本" }, true);
    results.drone.mounted = false;
  } else {
    results.drone.mounted = true;
    ok("drone: 工作台在公开基线挂载", true, droneProbe);

    // 4.1 装配态
    const assembled = await dronePage.evaluate(probeWorkstation);
    results.drone.assembled = assembled;
    ok("drone 装配: 滑杆回到 0", assembled.sliderValue === 0, assembled);
    await shot(dronePage, "drone-1440-assembled.png");

    // 4.2 云台点选（深链）
    const gimbalRes = await goto(dronePage, `/products/${DRONE}?focus=${GIMBAL_FOCUS}`);
    await dismissGuide(dronePage);
    await dronePage.waitForTimeout(600);
    const gimbalProbe = await dronePage.evaluate(probeWorkstation);
    results.drone.gimbalSelected = { ...gimbalRes, ...gimbalProbe };
    const gimbalSynced = gimbalProbe.pressed.includes("云台相机组件") && gimbalProbe.detailH3 === "云台相机组件";
    ok("drone 云台: 树高亮与详情标题同步到云台相机组件", gimbalSynced, gimbalProbe);
    await shot(dronePage, "drone-1440-gimbal-selected.png");

    // 4.3 爆炸态
    await goto(dronePage, `/products/${DRONE}`);
    await dismissGuide(dronePage);
    await dronePage.waitForTimeout(400);
    const explodedValue = await setSlider(dronePage, 1);
    const exploded = await dronePage.evaluate(probeWorkstation);
    results.drone.exploded = { sliderSet: explodedValue, ...exploded };
    ok("drone 爆炸: 滑杆到 1", exploded.sliderValue === 1, results.drone.exploded);
    await shot(dronePage, "drone-1440-exploded.png");

    // 4.4 复原
    await dronePage.locator(".drone-reset, .exploded-reset").first().click();
    await dronePage.waitForTimeout(500);
    const resetProbe = await dronePage.evaluate(probeWorkstation);
    results.drone.reset = resetProbe;
    ok("drone 复原: 滑杆回到 0", resetProbe.sliderValue === 0, resetProbe);

    // 4.5 代表性路线
    const routeRes = await goto(dronePage, `/products/${DRONE}/supply-chain`);
    await dismissGuide(dronePage);
    const routeProbe = await dronePage.evaluate(() => ({
      steps: document.querySelectorAll(".step-card-collapsible").length,
      h1: document.querySelector("main h1")?.textContent?.trim() ?? null
    }));
    results.drone.route = { ...routeRes, ...routeProbe };
    ok("drone 路线: 代表性路线页可打开且有步骤卡", routeRes.ok && routeProbe.steps >= 1, results.drone.route);
    await shot(dronePage, "drone-1440-supply-chain.png");

    // 4.6 材料贸易（无人机 fixture 无材料记录，允许空态）
    const matRes = await goto(dronePage, `/products/${DRONE}/materials`);
    await dismissGuide(dronePage);
    const matProbe = await dronePage.evaluate(() => ({
      cards: document.querySelectorAll(".trade-observation-card").length,
      empty: Boolean(document.querySelector(".empty-state"))
    }));
    results.drone.materials = { ...matRes, ...matProbe };
    ok("drone 材料: 材料页可打开（有记录卡或空态）", matRes.ok && (matProbe.cards >= 1 || matProbe.empty), results.drone.materials);
    await shot(dronePage, "drone-1440-materials.png");
  }
  await droneCtx.close();

  /* ---------------------------------------------------------------------- */
  /* 5. 国家账本（大豆油已知有记录的商品）                                       */
  /* ---------------------------------------------------------------------- */
  const ledgerCtx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await ledgerCtx.addInitScript(SKIP_GUIDE);
  const ledgerPage = await ledgerCtx.newPage();
  attachErrorCapture(ledgerPage, "ledger-soybean");
  const ledgerRes = await goto(ledgerPage, `/products/${LEDGER_PRODUCT}/ledger/${LEDGER_ENTITY}`);
  await dismissGuide(ledgerPage);
  const ledgerProbe = await ledgerPage.evaluate(() => ({
    snapshot: Boolean(document.querySelector(".ledger-snapshot")),
    empty: Boolean(document.querySelector(".empty-state")),
    competitionLedger: Boolean(document.querySelector(".competition-ledger")),
    ledgerRows: document.querySelectorAll(".competition-ledger-row").length,
    h1: document.querySelector("main h1")?.textContent?.trim() ?? null
  }));
  results.ledger = { ...ledgerRes, ...ledgerProbe };
  ok("账本: 大豆油 · 中国账本页可打开（快照/竞争包账本/空态）", ledgerRes.ok && (ledgerProbe.snapshot || ledgerProbe.empty || ledgerProbe.competitionLedger), results.ledger);
  await shot(ledgerPage, "ledger-soybean-cn-1440.png");
  await ledgerCtx.close();

  /* ---------------------------------------------------------------------- */
  /* 6. 深浅主题                                                             */
  /* ---------------------------------------------------------------------- */
  const themeCtx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await themeCtx.addInitScript(SKIP_GUIDE);
  const themePage = await themeCtx.newPage();
  attachErrorCapture(themePage, "theme");
  const themeProduct = droneMounted ? DRONE : "generic-smartphone";
  const themeRes = await goto(themePage, `/products/${themeProduct}`);
  await dismissGuide(themePage);
  const themeBefore = await themePage.evaluate(() => document.documentElement.dataset.theme ?? null);
  const themeSwitcher = themePage.locator(".theme-switcher").first();
  const themeSwitcherCount = await themeSwitcher.count();
  let themeAfter = null;
  let themeBack = null;
  if (themeSwitcherCount > 0) {
    await themeSwitcher.click().catch(() => {});
    await themePage.waitForTimeout(400);
    themeAfter = await themePage.evaluate(() => document.documentElement.dataset.theme ?? null);
    await themeSwitcher.click().catch(() => {});
    await themePage.waitForTimeout(400);
    themeBack = await themePage.evaluate(() => document.documentElement.dataset.theme ?? null);
  }
  results.theme = { product: themeProduct, ...themeRes, switcherCount: themeSwitcherCount, before: themeBefore, after: themeAfter, back: themeBack };
  observe("theme", results.theme);
  ok("主题: 切换后主题值变化并可切回", Boolean(themeSwitcherCount) && themeBefore && themeAfter && themeBefore !== themeAfter && themeBack === themeBefore, results.theme);
  if (!themeSwitcherCount) defect("公开基线未挂载主题切换器", { product: themeProduct, hint: "旧版 competition 包未引入 ThemeSwitcher" }, false);
  await shot(themePage, "theme-toggle-1440.png");
  await themeCtx.close();

  /* ---------------------------------------------------------------------- */
  /* 7. 390 移动端（无人机优先；未挂载则手机对照回归）                          */
  /* ---------------------------------------------------------------------- */
  const mobileCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await mobileCtx.addInitScript(SKIP_GUIDE);
  const mobilePage = await mobileCtx.newPage();
  attachErrorCapture(mobilePage, "mobile-390");

  const mobileTarget = droneMounted ? DRONE : "generic-smartphone";
  const mobileRes = await goto(mobilePage, `/products/${mobileTarget}`);
  await dismissGuide(mobilePage);
  await mobilePage.waitForSelector(".drone-workstation, .exploded-explorer", { timeout: 8000 }).catch(() => {});
  const mobileAssembled = await mobilePage.evaluate(probeWorkstation);
  results.mobile.assembled = { product: mobileTarget, ...mobileRes, ...mobileAssembled };
  ok("mobile 390: 装配态无横向溢出", mobileAssembled.overflowX === 0, results.mobile.assembled);

  if (droneMounted) {
    await setSlider(mobilePage, 1);
    const mobileExploded = await mobilePage.evaluate(probeWorkstation);
    results.mobile.exploded = mobileExploded;
    ok("mobile 390: 爆炸态无横向溢出", mobileExploded.overflowX === 0, mobileExploded);
    await shot(mobilePage, "drone-390-exploded.png");
  } else {
    defect("mobile 390: 无人机未挂载，移动端仅跑手机对照", { mobileTarget }, true);
  }
  await shot(mobilePage, mobileMountedShotName(mobileTarget));
  await mobileCtx.close();

  /* ---------------------------------------------------------------------- */
  /* 8. 错误汇总                                                             */
  /* ---------------------------------------------------------------------- */
  const allPageErrors = Object.values(results.pageErrors).flat();
  const allConsoleErrors = Object.values(results.consoleErrors).flat();
  ok("errors: 全页面无 pageerror / console error", allPageErrors.length === 0 && allConsoleErrors.length === 0, {
    pageErrors: allPageErrors,
    consoleErrors: allConsoleErrors
  });
  if (allPageErrors.length || allConsoleErrors.length) {
    defect("公开基线存在页面或控制台错误", { pageErrors: allPageErrors, consoleErrors: allConsoleErrors }, true);
  }
} finally {
  await browser.close();
}

function mobileMountedShotName(productId) {
  return productId === DRONE ? "drone-390-assembled.png" : "control-phone-390-dark.png";
}

const summary = {
  total: checks.length,
  passed: checks.filter((c) => c.passed).length,
  failed: checks.filter((c) => !c.passed).length,
  criticalDefects: results.defects.filter((d) => d.critical).length
};
results.finishedAt = new Date().toISOString();
results.summary = summary;
await writeFile(resolve(output, "result.json"), JSON.stringify(results, null, 2));
console.log(JSON.stringify({ summary, defects: results.defects, checks: checks.map((c) => ({ name: c.name, passed: c.passed })) }, null, 2));
if (summary.failed > 0) process.exit(1);
