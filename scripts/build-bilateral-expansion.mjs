#!/usr/bin/env node
/**
 * Turn the 2026-11-27 UN Comtrade China-hub snapshots into published bilateral
 * observations. Only rows reported by China (reporterCode 156) are promoted, so
 * mirror reporters never double the same lane. Every promoted row keeps the
 * request URL, retrieval time and response hash that produced it.
 *
 * Usage: node scripts/build-bilateral-expansion.mjs [--dry]
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { activatePublishedRelease, readPublishedRelease } from "./lib/published-releases.mjs";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const publishedRoot = resolve(repositoryRoot, "data/published");
const batchId = "bilateral-expansion-2026-11-27";
const reviewedAt = "2026-11-27";
const snapshotDirectory = "raw/expansion-2026-11-27";
const chinaM49 = "156";
const productSlugs = {
  "generic-smartphone": "smartphone",
  "generic-cotton-tshirt": "cotton-tshirt",
  "generic-soybean-oil": "soybean-oil",
  "generic-electric-bicycle": "electric-bicycle",
  "generic-home-air-conditioner": "home-air-conditioner",
  "generic-camera-drone": "camera-drone",
};
/** UN M49 code -> local entity identity. Names are the Chinese names used elsewhere. */
const partners = {
  "036": ["au", "AUS", "澳大利亚"], "124": ["ca", "CAN", "加拿大"], "156": ["cn", "CHN", "中国"],
  "250": ["fr", "FRA", "法国"], "276": ["de", "DEU", "德国"], "356": ["in", "IND", "印度"],
  "360": ["id", "IDN", "印度尼西亚"], "380": ["it", "ITA", "意大利"], "392": ["jp", "JPN", "日本"],
  "410": ["kr", "KOR", "韩国"], "458": ["my", "MYS", "马来西亚"], "484": ["mx", "MEX", "墨西哥"],
  "528": ["nl", "NLD", "荷兰"], "608": ["ph", "PHL", "菲律宾"], "643": ["ru", "RUS", "俄罗斯"],
  "682": ["sa", "SAU", "沙特阿拉伯"], "702": ["sg", "SGP", "新加坡"], "704": ["vn", "VNM", "越南"],
  "710": ["za", "ZAF", "南非"], "724": ["es", "ESP", "西班牙"], "076": ["br", "BRA", "巴西"],
  "764": ["th", "THA", "泰国"], "784": ["ae", "ARE", "阿联酋"], "826": ["gb", "GBR", "英国"],
  "842": ["us", "USA", "美国"],
};
const quantityUnits = { 5: "items", 8: "kg" };
const sourceId = "source-un-comtrade-expansion-20261127";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const padded = (code) => String(code).padStart(3, "0");

function nextVersion(version) {
  const match = /^(.*?)(\d+)$/.exec(version);
  if (!match) throw new Error(`Cannot bump dataset version: ${version}`);
  return `${match[1]}${Number(match[2]) + 1}`;
}

function rowsForSnapshot(snapshot, classificationCode) {
  const requests = snapshot.requests.filter((request) => new URL(request.requestUrl).searchParams.get("reporterCode") === chinaM49);
  if (requests.length !== 1) throw new Error(`Expected exactly one China-reported request for ${snapshot.productId}`);
  const [request] = requests;
  if (request.recordCount !== request.payload.data.length || request.truncated) throw new Error(`Truncated response: ${request.requestUrl}`);
  const rows = request.payload.data.filter((row) => row.cmdCode === classificationCode);
  return { request, rows };
}

function assertRow(row, reporter, partner) {
  if (row.period !== "2023" || row.refYear !== 2023 || row.typeCode !== "C" || row.freqCode !== "A" ||
      row.customsCode !== "C00" || row.motCode !== 0 || row.partner2Code !== 0 || row.mosCode !== "0" ||
      row.classificationCode !== "H6" || row.classificationSearchCode !== "HS" || row.isOriginalClassification !== true ||
      row.reporterCode !== reporter || !partners[padded(row.partnerCode)] || !partners[padded(partner)] ||
      row.partnerCode !== partner || !["M", "X"].includes(row.flowCode) ||
      !Number.isFinite(row.primaryValue) || row.primaryValue < 0) {
    throw new Error(`Unexpected trade row: ${reporter}-${row.partnerCode}-${row.flowCode}`);
  }
}

function countryEntity([iso2, iso3, name], datasetVersionId, m49) {
  return {
    id: `country-${iso2}`, kind: "country", name, iso2: iso2.toUpperCase(), iso3, parentId: null,
    sourceIds: [sourceId], dataStatus: "observed", method: "official",
    datasetVersionId, validPeriod: { granularity: "annual", start: "2023-01-01", end: "2023-12-31", label: "2023" },
    m49,
  };
}

async function buildProduct(entry) {
  const base = await readPublishedRelease(publishedRoot, entry.productId, entry.datasetVersion);
  const originalFixture = JSON.parse(await readFile(base.fixturePath, "utf8"));
  const version = nextVersion(base.datasetVersion);
  const slug = productSlugs[entry.productId];
  if (!slug) throw new Error(`Unknown product slug: ${entry.productId}`);
  const datasetVersionId = `dataset-${slug}-published-${version.split("-").at(-1).replace(".", "-")}-bilateral-expansion`;
  const previousDatasetVersionId = originalFixture.datasetVersion.id;
  // A release carries exactly one dataset version, so rebadge every inherited record.
  const fixture = JSON.parse(JSON.stringify(originalFixture, (key, value) =>
    key === "datasetVersionId" && value === previousDatasetVersionId ? datasetVersionId : value));
  const snapshots = JSON.parse(await readFile(resolve(publishedRoot, snapshotDirectory, `${entry.productId}.json`), "utf8"));
  const { request, rows } = rowsForSnapshot(snapshots, snapshots.classificationCode);
  const entityByM49 = new Map(fixture.entities.filter((item) => item.kind === "country" && item.m49).map((item) => [item.m49, item]));
  const entityById = new Map(fixture.entities.map((item) => [item.id, item]));
  const existing = new Map(fixture.tradeObservations
    .filter((observation) => observation.partnerScope === "entity" && observation.period?.label === "2023")
    .map((observation) => [`${observation.reporterCode}-${observation.partnerCode}-${observation.flowCode}`, observation]));
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
  for (const row of rows) {
    const partner = padded(row.partnerCode);
    assertRow(row, Number(chinaM49), row.partnerCode);
    const key = `${row.reporterCode}-${row.partnerCode}-${row.flowCode}`;
    if (existing.has(key)) {
      const kept = existing.get(key);
      if (kept.value !== row.primaryValue) throw new Error(`Existing observation disagrees with snapshot: ${kept.id}`);
      continue;
    }
    const partnerIdentity = partners[partner];
    ensureCountry(partner);
    if (!entityByM49.has(chinaM49)) throw new Error(`Fixture is missing the China entity: ${entry.productId}`);
    const unit = quantityUnits[row.qtyUnitCode] ?? null;
    const quantity = unit && Number.isFinite(row.qty) ? row.qty : null;
    const direction = row.flowCode === "M" ? "import" : "export";
    const id = `trade-${partnerIdentity[0]}-${slug}-${direction}-2023`;
    observations.push({
      id, reporterEntityId: "country-cn", reporterCode: Number(chinaM49),
      partnerEntityId: `country-${partnerIdentity[0]}`, partnerCode: row.partnerCode, partner2Code: 0,
      partnerScope: "entity", direction, flowCode: row.flowCode,
      classificationSystem: "HS", classificationVersion: "2022", classificationCode: snapshots.classificationCode,
      itemId: codeItem.get(snapshots.classificationCode) ?? fixture.productId,
      period: { granularity: "annual", start: "2023-01-01", end: "2023-12-31", label: "2023" },
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
    auditRows.push({ id, reporter: row.reporterCode, partner: row.partnerCode, flowCode: row.flowCode, year: 2023,
      classification: `HS 2022/${snapshots.classificationCode}`, currency: "USD", value: row.primaryValue,
      quantity, quantityDataStatus: quantity === null ? "unknown" : row.isQtyEstimated ? "estimated" : "observed" });
  }
  fixture.tradeObservations.push(...observations);
  const note = `按 UN Comtrade 2023 年中国口径补齐与 ${new Set(observations.map((item) => item.partnerEntityId)).size} 个伙伴的双边贸易观察（${observations.length} 条）。`;
  fixture.datasetVersion = {
    ...fixture.datasetVersion, id: datasetVersionId, version, publishedAt: reviewedAt,
    sourceIds: fixture.datasetVersion.sourceIds.includes(sourceId) ? fixture.datasetVersion.sourceIds : [...fixture.datasetVersion.sourceIds, sourceId],
    notes: `${fixture.datasetVersion.notes} ${note}`,
  };
  if (!fixture.sources.some((source) => source.id === sourceId)) {
    fixture.sources.push({
      id: sourceId, name: "UN Comtrade Public API · 中国双边扩充", publisher: "United Nations Statistics Division",
      url: request.requestUrl,
      license: "UN Comtrade License Agreement and Policy on Use and Re-dissemination; not CC BY",
      publishedAt: null,
      notes: `2023 年 HS ${snapshots.classificationCode} 中国报告的 24 个主要伙伴进出口年度记录，逐请求留存 URL、抓取时间与响应哈希。保留 UN 署名并遵守 https://comtradeplus.un.org/LicenseAgreement。`,
      retrievedAt: request.retrievedAt, datasetVersion: `un-comtrade-hs2022-${snapshots.classificationCode}-2023-china-hub`,
    });
  }
  const fixtureBytes = json(fixture);
  const audit = {
    schemaVersion: "bilateral-expansion-audit.v1", batchId, reviewedAt, productId: entry.productId,
    baseVersion: base.datasetVersion, baseFixtureSha256: base.fixtureSha256, datasetVersion: version, method: "official",
    retainedObservationCount: fixture.tradeObservations.length - observations.length,
    addedObservationCount: observations.length, addedCountryEntities: addedEntities,
    snapshot: { path: `${snapshotDirectory}/${entry.productId}.json`, requestUrl: request.requestUrl,
      retrievedAt: request.retrievedAt, responseSha256: request.responseSha256, recordCount: request.recordCount },
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
    console.log(`${entry.productId}: +${result.audit.addedObservationCount} observations, +${result.audit.addedCountryEntities.length} countries -> ${result.version}`);
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
