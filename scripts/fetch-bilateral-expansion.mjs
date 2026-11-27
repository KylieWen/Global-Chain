#!/usr/bin/env node
/**
 * Fetch bilateral UN Comtrade rows for every published product, hub-and-spoke
 * around China: China -> partner (exports/imports) plus partner -> China.
 * Raw responses are cached with SHA-256 so the transform step can prove what
 * it read. No numbers are invented here: only what the API returns.
 *
 * Usage: node scripts/fetch-bilateral-expansion.mjs [--only productId]
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const outDir = resolve(root, "data/published/raw/expansion-2026-11-27");
const period = "2023";
const china = 156;
const partners = [
  [842, "美国"], [276, "德国"], [392, "日本"], [410, "韩国"], [36, "澳大利亚"], [124, "加拿大"],
  [356, "印度"], [826, "英国"], [250, "法国"], [380, "意大利"], [724, "西班牙"], [528, "荷兰"],
  [643, "俄罗斯"], [76, "巴西"], [484, "墨西哥"], [360, "印度尼西亚"], [458, "马来西亚"],
  [764, "泰国"], [704, "越南"], [608, "菲律宾"], [682, "沙特阿拉伯"], [784, "阿联酋"],
  [710, "南非"], [702, "新加坡"]
];
const products = [
  { productId: "generic-smartphone", code: "851713" },
  { productId: "generic-cotton-tshirt", code: "610910" },
  { productId: "generic-soybean-oil", code: "150790" },
  { productId: "generic-electric-bicycle", code: "871160" },
  { productId: "generic-home-air-conditioner", code: "841510" },
  { productId: "generic-camera-drone", code: "880610" }
];
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;
const sha256 = (text) => createHash("sha256").update(text).digest("hex");
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

function url(reporterCode, partnerCode) {
  return `https://comtradeapi.un.org/public/v1/preview/C/A/HS?reporterCode=${reporterCode}&partnerCode=${partnerCode}` +
    `&cmdCode=PLACEHOLDER&flowCode=X,M&period=${period}&motCode=0&partner2Code=0&customsCode=C00&maxRecords=500`;
}

async function fetchPair(code, reporterCode, partnerCode) {
  const requestUrl = url(reporterCode, partnerCode).replace("PLACEHOLDER", code);
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await sleep(1800);
    const response = await fetch(requestUrl, { headers: { accept: "application/json" } });
    const text = await response.text();
    if (response.status === 429) {
      console.warn(`rate limited, waiting (attempt ${attempt})`);
      await sleep(20000 * attempt);
      continue;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${requestUrl}: ${text.slice(0, 160)}`);
    const payload = JSON.parse(text);
    return {
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
    if (existing.requests?.length === 2) {
      console.log(`cached ${product.productId}`);
      continue;
    }
  } catch { /* first run */ }
  const partnerCodes = partners.map(([code]) => code).join(",");
  const requests = [
    await fetchPair(product.code, china, partnerCodes),
    await fetchPair(product.code, partnerCodes, china)
  ];
  const snapshot = {
    schemaVersion: "bilateral-expansion-snapshot.v1",
    source: "UN Comtrade Preview API",
    license: "UN Comtrade License Agreement and Policy on Use and Re-dissemination apply",
    hsVersion: "2022",
    classificationCode: product.code,
    period,
    productId: product.productId,
    chinaM49: china,
    partnerM49: partners.map(([code, name]) => ({ code, name })),
    requests
  };
  await writeFile(path, JSON.stringify(snapshot, null, 2) + "\n");
  console.log(`wrote ${product.productId}: ${requests.map((entry) => entry.recordCount).join(" + ")} rows`);
}
