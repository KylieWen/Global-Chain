#!/usr/bin/env node
/**
 * Second expansion round: China-reported bilateral rows for 2022-2025 across a
 * 44-country partner set. Only the China side is requested here; mirror reports
 * stay out of the map so one trade never becomes two lanes.
 *
 * Usage: node scripts/fetch-bilateral-years.mjs [--only productId]
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const outDir = resolve(root, "data/published/raw/expansion-years-2026-11-27");
const china = 156;
const yearBatches = ["2022", "2023", "2024", "2025"];
const partners = [
  [842, "美国"], [276, "德国"], [392, "日本"], [410, "韩国"], [36, "澳大利亚"], [124, "加拿大"],
  [356, "印度"], [826, "英国"], [250, "法国"], [380, "意大利"], [724, "西班牙"], [528, "荷兰"],
  [643, "俄罗斯"], [76, "巴西"], [484, "墨西哥"], [360, "印度尼西亚"], [458, "马来西亚"],
  [764, "泰国"], [704, "越南"], [608, "菲律宾"], [682, "沙特阿拉伯"], [784, "阿联酋"],
  [710, "南非"], [702, "新加坡"], [616, "波兰"], [792, "土耳其"], [152, "智利"], [604, "秘鲁"],
  [818, "埃及"], [566, "尼日利亚"], [586, "巴基斯坦"], [50, "孟加拉国"], [170, "哥伦比亚"],
  [32, "阿根廷"], [804, "乌克兰"], [203, "捷克"], [40, "奥地利"], [56, "比利时"], [757, "瑞士"],
  [752, "瑞典"], [208, "丹麦"], [578, "挪威"], [246, "芬兰"], [348, "匈牙利"]
];
const products = [
  { productId: "generic-smartphone", code: "851713" },
  { productId: "generic-cotton-tshirt", code: "610910" },
  { productId: "generic-soybean-oil", code: "150790" },
  { productId: "generic-electric-bicycle", code: "871160" },
  { productId: "generic-home-air-conditioner", code: "841510" },
  { productId: "generic-camera-drone", code: "8806" }
];
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;
const sha256 = (text) => createHash("sha256").update(text).digest("hex");
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

function url(code, partnerCodes, periods) {
  return "https://comtradeapi.un.org/public/v1/preview/C/A/HS" +
    `?reporterCode=${china}&partnerCode=${partnerCodes}&cmdCode=${code}&flowCode=X,M&period=${periods}` +
    "&motCode=0&partner2Code=0&customsCode=C00&maxRecords=500";
}

async function request(code, partnerCodes, periods) {
  const requestUrl = url(code, partnerCodes, periods);
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    await sleep(1800);
    const response = await fetch(requestUrl, { headers: { accept: "application/json" } });
    const text = await response.text();
    if (response.status === 429) {
      console.warn(`rate limited, waiting (attempt ${attempt})`);
      await sleep(25000 * attempt);
      continue;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${requestUrl}: ${text.slice(0, 160)}`);
    const payload = JSON.parse(text);
    return {
      period: periods,
      requestUrl,
      retrievedAt: new Date().toISOString(),
      responseSha256: sha256(text),
      recordCount: payload.data?.length ?? 0,
      truncated: (payload.data?.length ?? 0) >= 500,
      payload
    };
  }
  throw new Error(`Gave up on ${requestUrl}`);
}

await mkdir(outDir, { recursive: true });
for (const product of products) {
  if (only && only !== product.productId) continue;
  const path = resolve(outDir, `${product.productId}.json`);
  try {
    const existing = JSON.parse(await readFile(path, "utf8"));
    if (existing.requests?.length === yearBatches.length && existing.partnerM49?.length === partners.length) {
      console.log(`cached ${product.productId}`);
      continue;
    }
  } catch { /* first run */ }
  const partnerCodes = partners.map(([code]) => code).join(",");
  const requests = [];
  for (const batch of yearBatches) requests.push(await request(product.code, partnerCodes, batch));
  const snapshot = {
    schemaVersion: "bilateral-expansion-snapshot.v1",
    source: "UN Comtrade Preview API",
    license: "UN Comtrade License Agreement and Policy on Use and Re-dissemination apply",
    hsVersion: "2022",
    classificationCode: product.code,
    periods: yearBatches,
    productId: product.productId,
    chinaM49: china,
    partnerM49: partners.map(([code, name]) => ({ code, name })),
    requests
  };
  await writeFile(path, JSON.stringify(snapshot, null, 2) + "\n");
  console.log(`wrote ${product.productId}: ${requests.map((entry) => `${entry.recordCount}@${entry.period}`).join(" + ")}`);
}
