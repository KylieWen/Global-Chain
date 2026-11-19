import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const builtSite = new URL("../tmp/qoder-competition-web/", import.meta.url);
const localOrigin = "http://timeline.test";
const site = process.env.TIMELINE_TEST_BASE_URL ?? localOrigin;
const smartphone = "generic-smartphone";
const entryName = process.env.TIMELINE_ENTRY_NAME ?? "看历年贸易 →";
const years = ["2023", "2024", "2025"];
const series = {
  "country-us": { reporter: "美国", amounts: ["45,203,156,861 USD", "41,733,276,167 USD", "23,682,589,324 USD"] },
  "country-de": { reporter: "德国", amounts: ["8,652,969,331.273 USD", "7,560,823,864.296 USD", "9,240,298,367.849 USD"] }
};

async function showYear(page, slider, year, country) {
  await page.waitForURL(url => url.searchParams.get("year") === year);
  await page.locator(`input[aria-label="贸易年份"][aria-valuetext="${year} 年"]`).waitFor();
  assert.equal(await slider.getAttribute("aria-valuetext"), `${year} 年`);
  const url = new URL(page.url());
  assert.equal(url.searchParams.get("product"), smartphone);
  assert.equal(url.searchParams.get("items"), smartphone);
  assert.equal(url.searchParams.get("scope"), "bilateral");
  assert.equal(url.searchParams.get("currency"), "USD");
  assert.equal(url.searchParams.get("direction"), "import");
  assert.equal(url.searchParams.get("country"), country);
}

async function checkImportDetails(page, year, { reporter, amounts }) {
  await page.locator(".world-country-map .atlas-line-visible").first().waitFor();
  const row = page.locator(".atlas-record-list .atlas-record").filter({
    hasText: new RegExp(`${reporter}进口报告`)
  });
  await row.waitFor();
  assert.match(await row.innerText(), new RegExp(`中国 → ${reporter}`));
  await row.click();
  const details = page.locator(".atlas-record-details");
  await details.waitFor();
  assert.deepEqual(await details.locator(".atlas-record-meta span").allTextContents(), [year, `${reporter}进口报告`]);
  assert.match(await details.locator(".atlas-record-classification").innerText(), /851713/);
  const value = details.locator(".atlas-values div").filter({ has: page.getByText("贸易金额", { exact: true }) }).locator("dd");
  assert.equal(await value.innerText(), amounts[years.indexOf(year)]);
  await details.locator(".atlas-near-source a").first().waitFor();
  await page.getByRole("button", { name: "← 返回记录" }).click();
}

async function dragYear(page, slider, touch) {
  await slider.scrollIntoViewIfNeeded();
  const box = await slider.boundingBox();
  assert.ok(box, "The year slider is visible");
  const left = Math.round(box.x + 7);
  const right = Math.round(box.x + box.width - 7);
  const y = Math.round(box.y + box.height / 2);
  if (touch) {
    const cdp = await page.context().newCDPSession(page);
    try {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: left, y }] });
      for (let step = 1; step <= 12; step++) {
        const x = Math.round(left + (right - left) * step / 12);
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] });
      }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    } finally {
      await cdp.detach();
    }
  } else {
    await page.mouse.move(left, y);
    await page.mouse.down();
    await page.mouse.move(right, y, { steps: 12 });
    await page.mouse.up();
  }
}

async function checkSingleYear(page, slider) {
  const soybean = new URL("/map", site);
  soybean.search = new URLSearchParams({
    product: "generic-soybean-oil",
    items: "generic-soybean-oil,soybean,crude-soybean-oil",
    year: "2024"
  });
  await page.goto(soybean.href);
  await page.getByText("当前统计范围收录 2024 年", { exact: true }).waitFor();
  assert.equal(await slider.count(), 0);
  const lines = await page.locator(".atlas-line-visible").evaluateAll(paths => [...new Set(paths.map(path => path.style.stroke))]);
  assert.equal(lines.length, 3, "The single-year soybean example retains all three products' lines");
  await page.locator(".atlas-record-list .atlas-record").first().click();
  await page.locator(".atlas-record-details").getByText("贸易金额", { exact: true }).waitFor();
}

const errors = [];
const browser = await chromium.launch({ channel: "chrome" });
try {
  for (const [layout, viewport, touch] of [
    ["desktop", { width: 1440, height: 900 }, false],
    ["mobile", { width: 390, height: 844 }, true]
  ]) {
    const context = await browser.newContext({ viewport, isMobile: touch, hasTouch: touch });
    try {
      const page = await context.newPage();
      page.on("pageerror", error => errors.push(`${layout}: ${error.message}`));
      if (site === localOrigin) {
        await page.route(`${localOrigin}/**`, route => {
          const pathname = new URL(route.request().url()).pathname;
          const asset = ["/preview.js", "/preview.css", "/fixtures.json"].includes(pathname) ? pathname.slice(1) : "index.html";
          return route.fulfill({ path: fileURLToPath(new URL(asset, builtSite)) });
        });
      }
      await page.goto(new URL("/", site).href);
      await page.getByRole("link", { name: entryName, exact: true }).click();
      const slider = page.getByRole("slider", { name: "贸易年份" });
      await slider.waitFor();
      const country = new URL(page.url()).searchParams.get("country");
      assert.ok(Object.hasOwn(series, country), `Expected a continuous US or German import series, received ${country}`);
      await slider.press("Home");
      await showYear(page, slider, "2023", country);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await checkImportDetails(page, "2023", series[country]);
      await dragYear(page, slider, touch);
      await showYear(page, slider, "2025", country);
      await checkImportDetails(page, "2025", series[country]);
      await page.reload();
      await showYear(page, slider, "2025", country);
      await slider.press("ArrowLeft");
      await showYear(page, slider, "2024", country);
      await checkImportDetails(page, "2024", series[country]);
      await checkSingleYear(page, slider);
      console.log(`${layout}: ${touch ? "touch" : "pointer"} drag, keyboard, reload, ${series[country].reporter} import amounts and single-year example passed`);
    } finally {
      await context.close();
    }
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
