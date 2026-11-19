#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { verifyBilateralSnapshot } from "./build-phone-gap-review.mjs";
import { readPublishedRelease } from "./lib/published-releases.mjs";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const productId = "generic-smartphone";
const baseVersion = "globe-chain-smartphone-2026.6";
const version = "globe-chain-smartphone-2026.7";
const datasetVersionId = "dataset-smartphone-published-2026-7-trade-history";
const reviewedAt = "2026-11-19";
const batchId = "smartphone-bilateral-history-2026-11-19";
const originalPath = "raw/un-comtrade-hs2022-851713-bilateral-2023.json";
const originalHash = "f9803ecf46184e946f6b8c2412bbacfc4ca8f97d298e97a533e91d5025164517";
const refreshHashes = {
  "156-276-2024": "ee8b21e0755177aed7ca82248cd91d3320a7acd48ade975a296fe12b8def3404",
  "156-842-2024": "70417a96a2b25499002f1973073265f48698a43463b4973353ea433eead87c24",
  "276-156-2024": "18c3f9ffb7b51ebd85b557c7b26b84867f8a7b93e3b87a8f690b1fd05d5c36c8",
  "276-156-2025": "2fadbc61f8f1413efdc5c4e1468dd6206de0d2e084da285145a8ff0d436212ea",
  "842-156-2024": "9bbdb1d99da69dda67d60909b89147686413c2b5d2aa5914f2270163a655435c",
  "842-156-2025": "7cc26e221114b1bfc7628d4f8fabb9254d316882d48cb684c52254d7d6f446db",
};
const pairs = [[156, 276, 2024], [156, 842, 2024], [276, 156, 2025], [842, 156, 2025]];
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

async function checkedInput(root, snapshotPath, expectedHash) {
  const bytes = await readFile(resolve(root, snapshotPath));
  if (sha256(bytes) !== expectedHash) throw new Error(`Snapshot file hash mismatch: ${snapshotPath}`);
  return JSON.parse(bytes.toString("utf8"));
}

function assertRequest(url, reporter, partner, year) {
  const request = new URL(url);
  const expected = { reporterCode: reporter, partnerCode: partner, period: year, partner2Code: 0, motCode: 0, customsCode: "C00" };
  const parameters = request.searchParams;
  if (request.origin !== "https://comtradeapi.un.org" || request.pathname !== "/public/v1/preview/C/A/HS" ||
      Object.entries(expected).some(([key, value]) => parameters.get(key) !== String(value)) ||
      !parameters.get("cmdCode")?.split(",").includes("851713") ||
      parameters.get("flowCode")?.split(",").sort().join(",") !== "M,X") {
    throw new Error(`Unexpected trade request scope: ${url}`);
  }
}

function observations(response, trace, reporter, partner, year) {
  assertRequest(trace.requestUrl, reporter, partner, year);
  const rows = response.data.filter((row) => row.cmdCode === "851713");
  if (rows.length !== 2 || new Set(rows.map((row) => row.flowCode)).size !== 2) {
    throw new Error(`Expected unique import and export observations: ${trace.requestUrl}`);
  }
  return rows.map((row) => {
    const valuation = { M: "CIF", X: "FOB" }[row.flowCode];
    const expectedValue = row.flowCode === "M" ? row.cifvalue : row.fobvalue;
    if (!valuation || row.reporterCode !== reporter || row.partnerCode !== partner ||
        row.period !== String(year) || row.refYear !== year || row.classificationCode !== "H6" ||
        row.classificationSearchCode !== "HS" || row.isOriginalClassification !== true ||
        row.typeCode !== "C" || row.freqCode !== "A" ||
        row.customsCode !== "C00" || row.motCode !== 0 || row.mosCode !== "0" || row.partner2Code !== 0 ||
        !Number.isFinite(row.primaryValue) || row.primaryValue < 0 || row.primaryValue !== expectedValue ||
        row.qtyUnitCode !== 5 || !Number.isFinite(row.qty) || row.qty < 0 ||
        typeof row.isQtyEstimated !== "boolean") {
      throw new Error(`Trade row scope, valuation or quantity mismatch: ${trace.requestUrl}`);
    }
    return { row, trace: { ...trace, valuation, qtyUnitCode: row.qtyUnitCode } };
  });
}

async function readAnnualRows(root, bundle, reporter, partner, year) {
  if (year === 2023) {
    const response = bundle.bilateralResponses.find((entry) => entry.reporter.code === reporter && entry.partner.code === partner);
    if (!response || response.recordCount !== response.payload.data.length || response.recordCount >= 500) {
      throw new Error(`Missing or truncated 2023 bilateral response: ${reporter}-${partner}`);
    }
    return observations(response.payload, {
      rawSnapshot: originalPath, rawSnapshotSha256: originalHash, requestUrl: response.request.url,
      retrievedAt: response.requestedAt, rawResponseSha256: response.rawResponseSha256,
      canonicalDataSha256: response.canonicalDataSha256,
    }, reporter, partner, year);
  }
  const key = `${reporter}-${partner}-${year}`;
  const path = `raw/refresh-2026-09-16/comtrade-${key}.json`;
  const snapshot = await checkedInput(root, path, refreshHashes[key]);
  const payload = JSON.parse(snapshot.body);
  if (snapshot.httpStatus !== 200 || sha256(snapshot.body) !== snapshot.sha256 ||
      payload.count !== payload.data.length || payload.count >= 500) {
    throw new Error(`Invalid, truncated or changed response: ${path}`);
  }
  return observations(payload, {
    rawSnapshot: path, rawSnapshotSha256: refreshHashes[key], requestUrl: snapshot.url,
    retrievedAt: snapshot.retrievedAt, rawResponseSha256: snapshot.sha256,
  }, reporter, partner, year);
}

export async function buildSmartphoneTradeHistory(root = repositoryRoot) {
  const publishedRoot = resolve(root, "data/published");
  const base = await readPublishedRelease(publishedRoot, productId, baseVersion);
  const previous = JSON.parse(await readFile(base.fixturePath, "utf8"));
  const fixture = JSON.parse(JSON.stringify(previous, (key, value) =>
    key === "datasetVersionId" && value === previous.datasetVersion.id ? datasetVersionId : value));
  const notes = "从本地 UN Comtrade 原始快照补齐 HS 2022/851713 具体伙伴贸易观察。德国及美国统计区报告的对华进出口覆盖 2023–2025 年，中国报告的对德、对美统计区进出口覆盖 2023–2024 年。";
  fixture.datasetVersion = {
    ...fixture.datasetVersion, id: datasetVersionId, version, publishedAt: reviewedAt,
    notes: `${previous.datasetVersion.notes} ${notes}`,
  };
  const bundle = await checkedInput(publishedRoot, originalPath, originalHash);
  verifyBilateralSnapshot(bundle);
  const auditRows = [];
  const added = [];
  for (const [reporter, partner, latestYear] of pairs) {
    for (let year = 2023; year <= latestYear; year++) {
      for (const { row, trace } of await readAnnualRows(publishedRoot, bundle, reporter, partner, year)) {
        const template = fixture.tradeObservations.find((entry) =>
          entry.reporterCode === reporter && entry.partnerCode === partner && entry.flowCode === row.flowCode);
        const sourceId = year === 2023 ? "source-un-comtrade" : "source-un-comtrade-refresh-20260916";
        const quantityDataStatus = row.isQtyEstimated ? "estimated" : "observed";
        if (!template || template.itemId !== productId || template.classificationSystem !== "HS" ||
            template.classificationVersion !== "2022" || template.classificationCode !== "851713" ||
            template.currency !== "USD" || template.partner2Code !== 0 || template.partnerScope !== "entity" ||
            template.direction !== (row.flowCode === "M" ? "import" : "export") ||
            !fixture.datasetVersion.sourceIds.includes(sourceId)) {
          throw new Error(`Missing or incompatible release mapping: ${reporter}-${partner}-${row.flowCode}`);
        }
        const retained = template.period.label === String(year);
        if (retained && (template.value !== row.primaryValue || template.quantity !== row.qty ||
            template.quantityDataStatus !== quantityDataStatus || template.sourceId !== sourceId)) {
          throw new Error(`Existing observation does not match raw response: ${template.id}`);
        }
        const id = retained ? template.id : `${template.id}-${year}`;
        if (!retained) added.push({
          ...template, id, sourceId, value: row.primaryValue, quantity: row.qty, unit: "items", quantityDataStatus,
          period: { granularity: "annual", start: `${year}-01-01`, end: `${year}-12-31`, label: String(year) },
          quality: {
            legacyEstimationFlag: row.legacyEstimationFlag, isQtyEstimated: row.isQtyEstimated,
            isNetWgtEstimated: row.isNetWgtEstimated, isReported: row.isReported, isAggregate: row.isAggregate,
          },
          qualityNote: JSON.stringify({
            ...trace, primaryValueField: "primaryValue", reporterCode: reporter, partnerCode: partner, flowCode: row.flowCode,
            currency: "USD", quantityPublicationRule: "Source estimated quantities remain explicitly marked as estimates.",
          }),
        });
        auditRows.push({
          id, change: retained ? "retained" : "added", reporter, partner, flowCode: row.flowCode,
          year, classification: "HS 2022/851713", currency: "USD", value: row.primaryValue,
          quantity: row.qty, quantityDataStatus, ...trace,
        });
      }
    }
  }
  fixture.tradeObservations.push(...added);
  const audit = {
    schemaVersion: "smartphone-bilateral-history-audit.v1", batchId, reviewedAt, baseVersion,
    baseFixtureSha256: base.fixtureSha256, datasetVersion: version, method: "official",
    retainedObservationCount: previous.tradeObservations.length, addedObservationCount: added.length,
    notes, reporter842Scope: "UN Comtrade USA, Puerto Rico and US Virgin Islands statistical area",
    sourceTerms: fixture.sources.find((source) => source.id === "source-un-comtrade").license,
    observations: auditRows,
  };
  const fixtureBytes = json(fixture);
  const auditBytes = json(audit);
  const manifest = {
    ...base.manifest, datasetVersion: version, generatedAt: reviewedAt, fixtureSha256: sha256(fixtureBytes), notes: [notes],
    release: { ...base.manifest.release, datasetVersion: version, releasePath: `releases/${productId}/${version}` },
    evidenceReview: { batchId, baseDatasetVersion: baseVersion, auditPath: "review-audit.json",
      auditPathBase: "release-directory", auditSha256: sha256(auditBytes) },
  };
  return { files: { "fixture.json": fixtureBytes, "review-audit.json": auditBytes, "manifest.json": json(manifest) }, audit };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length && args[0] !== "--publish")) {
    throw new Error("Usage: node scripts/build-smartphone-trade-history.mjs [--publish]");
  }
  const { files, audit } = await buildSmartphoneTradeHistory();
  const output = args.length ? `data/published/releases/${productId}/${version}` : `data/candidates/${batchId}`;
  await mkdir(resolve(repositoryRoot, output), { recursive: true });
  for (const [name, bytes] of Object.entries(files)) {
    const path = resolve(repositoryRoot, output, name);
    try { await writeFile(path, bytes, { flag: "wx" }); }
    catch (error) {
      if (error.code !== "EEXIST") throw error;
      if (await readFile(path, "utf8") !== bytes) throw new Error(`Immutable output already differs: ${path}`);
    }
  }
  console.log(`Prepared ${output}: ${audit.addedObservationCount} new bilateral observations.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
