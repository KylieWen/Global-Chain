#!/usr/bin/env node
/**
 * Promote the 2022-2025 China-hub snapshots (44 partners) into published
 * bilateral observations. Rows already published by the 2023 batch are reused
 * when their value matches, so re-running never duplicates a lane.
 *
 * Usage: node scripts/build-bilateral-years.mjs [--dry]
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { activatePublishedRelease, readPublishedRelease } from "./lib/published-releases.mjs";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const publishedRoot = resolve(repositoryRoot, "data/published");
const batchId = "bilateral-years-2026-11-27";
const reviewedAt = "2026-11-27";
const snapshotDirectory = "raw/expansion-years-2026-11-27";
const chinaM49 = "156";
const years = ["2022", "2023", "2024", "2025"];
const productSlugs = {
  "generic-smartphone": "smartphone",
  "generic-cotton-tshirt": "cotton-tshirt",
  "generic-soybean-oil": "soybean-oil",
  "generic-electric-bicycle": "electric-bicycle",
  "generic-home-air-conditioner": "home-air-conditioner",
  "generic-camera-drone": "camera-drone",
};
const partners = {
  "036": ["au", "AUS", "澳大利亚"], "124": ["ca", "CAN", "加拿大"], "156": ["cn", "CHN", "中国"],
  "250": ["fr", "FRA", "法国"], "276": ["de", "DEU", "德国"], "356": ["in", "IND", "印度"],
  "360": ["id", "IDN", "印度尼西亚"], "380": ["it", "ITA", "意大利"], "392": ["jp", "JPN", "日本"],
  "410": ["kr", "KOR", "韩国"], "458": ["my", "MYS", "马来西亚"], "484": ["mx", "MEX", "墨西哥"],
  "528": ["nl", "NLD", "荷兰"], "608": ["ph", "PHL", "菲律宾"], "643": ["ru", "RUS", "俄罗斯"],
  "682": ["sa", "SAU", "沙特阿拉伯"], "702": ["sg", "SGP", "新加坡"], "704": ["vn", "VNM", "越南"],
  "710": ["za", "ZAF", "南非"], "724": ["es", "ESP", "西班牙"], "076": ["br", "BRA", "巴西"],
  "764": ["th", "THA", "泰国"], "784": ["ae", "ARE", "阿联酋"], "826": ["gb", "GBR", "英国"],
  "842": ["us", "USA", "美国"], "616": ["pl", "POL", "波兰"], "792": ["tr", "TUR", "土耳其"],
  "152": ["cl", "CHL", "智利"], "604": ["pe", "PER", "秘鲁"], "818": ["eg", "EGY", "埃及"],
  "566": ["ng", "NGA", "尼日利亚"], "586": ["pk", "PAK", "巴基斯坦"], "050": ["bd", "BGD", "孟加拉国"],
  "170": ["co", "COL", "哥伦比亚"], "032": ["ar", "ARG", "阿根廷"], "804": ["ua", "UKR", "乌克兰"],
  "203": ["cz", "CZE", "捷克"], "040": ["at", "AUT", "奥地利"], "056": ["be", "BEL", "比利时"],
  "757": ["ch", "CHE", "瑞士"], "752": ["se", "SWE", "瑞典"], "208": ["dk", "DNK", "丹麦"],
  "578": ["no", "NOR", "挪威"], "246": ["fi", "FIN", "芬兰"], "348": ["hu", "HUN", "匈牙利"],
};
const quantityUnits = { 5: "items", 8: "kg" };
const sourceId = "source-un-comtrade-years-20261127";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const padded = (code) => String(code).padStart(3, "0");

function nextVersion(version) {
  const match = /^(.*?)(\d+)$/.exec(version);
  if (!match) throw new Error(`Cannot bump dataset version: ${version}`);
  return `${match[1]}${Number(match[2]) + 1}`;
}

function assertRow(row, classificationCode) {
  if (!years.includes(row.period) || String(row.refYear) !== row.period || row.typeCode !== "C" || row.freqCode !== "A" ||
      row.customsCode !== "C00" || row.motCode !== 0 || row.partner2Code !== 0 || row.mosCode !== "0" ||
      row.reporterCode !== Number(chinaM49) || row.classificationCode !== "H6" || row.classificationSearchCode !== "HS" ||
      row.isOriginalClassification !== true || row.cmdCode !== classificationCode ||
      !partners[padded(row.partnerCode)] || !["M", "X"].includes(row.flowCode) ||
      !Number.isFinite(row.primaryValue) || row.primaryValue < 0) {
    throw new Error(`Unexpected trade row: ${row.reporterCode}-${row.partnerCode}-${row.period}-${row.flowCode}`);
  }
}

function countryEntity([iso2, iso3, name], datasetVersionId, m49) {
  return {
    id: `country-${iso2}`, kind: "country", name, iso2: iso2.toUpperCase(), iso3, parentId: null,
    sourceIds: [sourceId], dataStatus: "observed", method: "official", datasetVersionId,
    validPeriod: { granularity: "annual", start: "2022-01-01", end: "2025-12-31", label: "2022–2025" }, m49,
  };
}

async function buildProduct(entry) {
  const base = await readPublishedRelease(publishedRoot, entry.productId, entry.datasetVersion);
  const originalFixture = JSON.parse(await readFile(base.fixturePath, "utf8"));
  const version = nextVersion(base.datasetVersion);
  const slug = productSlugs[entry.productId];
  if (!slug) throw new Error(`Unknown product slug: ${entry.productId}`);
  const datasetVersionId = `dataset-${slug}-published-${version.split("-").at(-1).replace(".", "-")}-bilateral-years`;
  const previousDatasetVersionId = originalFixture.datasetVersion.id;
  const fixture = JSON.parse(JSON.stringify(originalFixture, (key, value) =>
    key === "datasetVersionId" && value === previousDatasetVersionId ? datasetVersionId : value));
  const snapshots = JSON.parse(await readFile(resolve(publishedRoot, snapshotDirectory, `${entry.productId}.json`), "utf8"));
  for (const request of snapshots.requests) {
    if (request.recordCount !== request.payload.data.length || request.truncated) throw new Error(`Truncated response: ${request.requestUrl}`);
  }
  const entityByM49 = new Map(fixture.entities.filter((item) => item.kind === "country" && item.m49).map((item) => [item.m49, item]));
  const entityById = new Map(fixture.entities.map((item) => [item.id, item]));
  const existing = new Map(fixture.tradeObservations
    .filter((observation) => observation.partnerScope === "entity")
    .map((observation) => [`${observation.reporterCode}-${observation.partnerCode}-${observation.flowCode}-${observation.classificationCode}-${observation.period?.label}`, observation]));
  const codeItem = new Map(fixture.tradeObservations.map((observation) => [observation.classificationCode, observation.itemId]));
  const addedEntities = [];
  const ensureCountry = (m49) => {
    const identity = partners[m49];
    if (!identity) throw new Error(`Unknown partner code: ${m49}`);
    const existingEntity = entityById.get(`country-${identity[0]}`);
    if (existingEntity) {
      if (!existingEntity.m49) existingEntity.m49 = m49;
      entityByM49.set(m49, existingEntity);
      return existingEntity;
    }
    const created = countryEntity(identity, datasetVersionId, m49);
    fixture.entities.push(created);
    entityById.set(created.id, created);
    entityByM49.set(m49, created);
    addedEntities.push(created.id);
    return created;
  };
  ensureCountry(chinaM49);
  const observations = [];
  const auditRows = [];
  for (const request of snapshots.requests) {
    for (const row of request.payload.data) {
      assertRow(row, snapshots.classificationCode);
      const partner = padded(row.partnerCode);
      const key = `${row.reporterCode}-${row.partnerCode}-${row.flowCode}-${row.cmdCode}-${row.period}`;
      if (existing.has(key)) {
        const kept = existing.get(key);
        if (kept.value !== row.primaryValue) throw new Error(`Existing observation disagrees with snapshot: ${kept.id}`);
        continue;
      }
      const identity = partners[partner];
      ensureCountry(partner);
      const unit = quantityUnits[row.qtyUnitCode] ?? null;
      const quantity = unit && Number.isFinite(row.qty) ? row.qty : null;
      const direction = row.flowCode === "M" ? "import" : "export";
      const year = row.period;
      const id = `trade-${identity[0]}-${slug}-${direction}-${year}`;
      observations.push({
        id, reporterEntityId: "country-cn", reporterCode: Number(chinaM49),
        partnerEntityId: `country-${identity[0]}`, partnerCode: row.partnerCode, partner2Code: 0,
        partnerScope: "entity", direction, flowCode: row.flowCode,
        classificationSystem: "HS", classificationVersion: "2022", classificationCode: snapshots.classificationCode,
        itemId: codeItem.get(snapshots.classificationCode) ?? fixture.productId,
        period: { granularity: "annual", start: `${year}-01-01`, end: `${year}-12-31`, label: year },
        value: row.primaryValue, quantity, currency: "USD", unit: unit ?? "unknown",
        statisticalConcept: "customs", sourceId, datasetVersionId,
        method: "official", dataStatus: "observed", valueDataStatus: "observed",
        quantityDataStatus: quantity === null ? "unknown" : row.isQtyEstimated ? "estimated" : "observed",
        quality: {
          legacyEstimationFlag: row.legacyEstimationFlag, isQtyEstimated: row.isQtyEstimated,
          isNetWgtEstimated: row.isNetWgtEstimated, isReported: row.isReported, isAggregate: row.isAggregate,
        },
        qualityNote: JSON.stringify({
          requestUrl: request.requestUrl, retrievedAt: request.retrievedAt, rawResponseSha256: request.responseSha256,
          rawSnapshot: `${snapshotDirectory}/${entry.productId}.json`, reporterCode: row.reporterCode,
          partnerCode: row.partnerCode, flowCode: row.flowCode, qtyUnitCode: row.qtyUnitCode,
          valuation: row.flowCode === "M" ? "CIF" : "FOB",
          quantityPublicationRule: "A missing quantity or an unsupported unit code is published as unknown, never as zero.",
        }),
      });
      auditRows.push({ id, reporter: row.reporterCode, partner: row.partnerCode, flowCode: row.flowCode, year,
        classification: `HS 2022/${snapshots.classificationCode}`, currency: "USD", value: row.primaryValue,
        quantity, quantityDataStatus: quantity === null ? "unknown" : row.isQtyEstimated ? "estimated" : "observed" });
    }
  }
  fixture.tradeObservations.push(...observations);
  const yearsCovered = [...new Set(auditRows.map((row) => row.year))].sort();
  const note = `把中国口径双边观察扩到 2022–${yearsCovered.at(-1) ?? "2025"} 年、${new Set(auditRows.map((row) => row.partner)).size} 个伙伴，新增 ${observations.length} 条。`;
  fixture.datasetVersion = {
    ...fixture.datasetVersion, id: datasetVersionId, version, publishedAt: reviewedAt,
    sourceIds: fixture.datasetVersion.sourceIds.includes(sourceId) ? fixture.datasetVersion.sourceIds : [...fixture.datasetVersion.sourceIds, sourceId],
    notes: `${fixture.datasetVersion.notes} ${note}`,
  };
  if (!fixture.sources.some((source) => source.id === sourceId)) {
    fixture.sources.push({
      id: sourceId, name: "UN Comtrade Public API · 中国双边多年扩充", publisher: "United Nations Statistics Division",
      url: snapshots.requests[0].requestUrl,
      license: "UN Comtrade License Agreement and Policy on Use and Re-dissemination; not CC BY",
      publishedAt: null,
      notes: `2022–2025 年 HS ${snapshots.classificationCode} 中国报告的 44 个伙伴进出口年度记录，逐请求留存 URL、抓取时间与响应哈希。保留 UN 署名并遵守 https://comtradeplus.un.org/LicenseAgreement。`,
      retrievedAt: snapshots.requests[0].retrievedAt,
      datasetVersion: `un-comtrade-hs2022-${snapshots.classificationCode}-2022-2025-china-hub`,
    });
  }
  const fixtureBytes = json(fixture);
  const audit = {
    schemaVersion: "bilateral-years-audit.v1", batchId, reviewedAt, productId: entry.productId,
    baseVersion: base.datasetVersion, baseFixtureSha256: base.fixtureSha256, datasetVersion: version, method: "official",
    retainedObservationCount: fixture.tradeObservations.length - observations.length,
    addedObservationCount: observations.length, addedCountryEntities: addedEntities,
    yearsCovered, snapshots: snapshots.requests.map((request) => ({ requestUrl: request.requestUrl,
      period: request.period, retrievedAt: request.retrievedAt, responseSha256: request.responseSha256, recordCount: request.recordCount })),
    notes: note, observations: auditRows,
  };
  const auditBytes = json(audit);
  const manifest = {
    schemaVersion: "fixture-manifest.v1",
    fixtures: [{ productId: entry.productId, path: "fixture.json" }],
    datasetVersion: version, generatedAt: reviewedAt, fixtureSha256: sha256(fixtureBytes),
    release: { productId: entry.productId, datasetVersion: version, releasePath: `releases/${entry.productId}/${version}`, immutable: true },
    evidenceReview: { batchId, baseDatasetVersion: base.datasetVersion, auditPath: "review-audit.json", auditPathBase: "release-directory", auditSha256: sha256(auditBytes) },
    notes: [note],
  };
  return { entry, version, files: { "fixture.json": fixtureBytes, "review-audit.json": auditBytes, "manifest.json": json(manifest) }, audit };
}

async function main() {
  const dry = process.argv.includes("--dry");
  const active = JSON.parse(await readFile(resolve(publishedRoot, "active-manifest.json"), "utf8"));
  const results = [];
  for (const entry of active.fixtures) {
    const result = await buildProduct(entry);
    results.push(result);
    const directory = resolve(publishedRoot, "releases", entry.productId, result.version);
    await mkdir(directory, { recursive: true });
    for (const [name, bytes] of Object.entries(result.files)) {
      const path = resolve(directory, name);
      try { await writeFile(path, bytes, { flag: "wx" }); }
      catch (error) {
        if (error.code !== "EEXIST") throw error;
        if (await readFile(path, "utf8") !== bytes) throw new Error(`Immutable output already differs: ${path}`);
      }
    }
    console.log(`${entry.productId}: +${result.audit.addedObservationCount} observations, years ${result.audit.yearsCovered.join("/")} -> ${result.version}`);
  }
  if (dry) { console.log("Dry run: active manifest untouched."); return; }
  for (const result of results) {
    await activatePublishedRelease(publishedRoot, { productId: result.entry.productId, datasetVersion: result.version });
  }
  console.log(`Activated ${results.length} releases.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
