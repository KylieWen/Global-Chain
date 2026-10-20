#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const reviewPath = "content/reviews/smartphone-bilateral-gaps-2026-10-21.json";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const jsonBytes = (value) => `${JSON.stringify(value, null, 2)}\n`;
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

function canonicalDataHash(payload) {
  return hash(JSON.stringify([...payload.data].sort((left, right) => `${left.reporterCode}:${left.partnerCode}:${left.flowCode}`.localeCompare(`${right.reporterCode}:${right.partnerCode}:${right.flowCode}`))));
}

export function verifyBilateralSnapshot(snapshot) {
  if (snapshot.schemaVersion !== "raw-source-bundle.v1" || snapshot.sourceVersion?.classification !== "HS 2022" || snapshot.sourceVersion.period !== "2023") throw new Error("Unexpected bilateral snapshot scope");
  for (const response of [...snapshot.bilateralResponses, ...snapshot.metadataResponses]) {
    if (response.httpStatus !== 200 || response.canonicalDataSha256 !== canonicalDataHash(response.payload)) throw new Error(`Bilateral canonical response hash mismatch: ${response.pairId ?? response.reporter.code}`);
  }
  const canonical = JSON.stringify({ bilateral: snapshot.bilateralResponses.map(({ canonicalDataSha256, pairId }) => ({ pairId, canonicalDataSha256 })), metadata: snapshot.metadataResponses.map(({ canonicalDataSha256, reporter }) => ({ reporterCode: reporter.code, canonicalDataSha256 })) });
  if (hash(canonical) !== snapshot.payloadSha256) throw new Error("Bilateral bundle hash mismatch");
}

function scopedRow(snapshot, pairId, reporter, partner, flow) {
  const response = snapshot.bilateralResponses.find((entry) => entry.pairId === pairId);
  if (!response || response.reporter.code !== reporter || response.partner.code !== partner || response.recordCount !== response.payload.data.length || response.recordCount >= 500) throw new Error(`Missing or truncated specific-partner response: ${pairId}`);
  const request = response.request.parameters;
  if (Number(request.reporterCode) !== reporter || Number(request.partnerCode) !== partner || String(request.period) !== "2023" || String(request.cmdCode) !== "851713") throw new Error(`Request scope mismatch: ${pairId}`);
  const rows = response.payload.data.filter((row) => row.flowCode === flow);
  if (rows.length !== 1) throw new Error(`Expected one ${flow} observation: ${pairId}`);
  const row = rows[0];
  if (row.reporterCode !== reporter || row.partnerCode !== partner || !partner || String(row.period) !== "2023" || row.refYear !== 2023 || row.classificationCode !== "H6" || row.classificationSearchCode !== "HS" || String(row.cmdCode) !== "851713" || row.typeCode !== "C" || row.freqCode !== "A" || row.customsCode !== "C00" || row.motCode !== 0 || row.partner2Code !== 0 || !Number.isFinite(row.primaryValue) || row.primaryValue < 0) throw new Error(`Bilateral row scope or value mismatch: ${pairId}`);
  return { response, row };
}

function assertClosingEvidence(fixture, evidenceId, claim, observation, direction) {
  const evidence = fixture.evidence.find((entry) => entry.id === evidenceId);
  const scope = evidence?.scope;
  if (evidence?.sourceId !== "source-un-comtrade" || evidence.supportType !== "bilateral_flow" || !scope?.supportsBilateralFlow || scope.fromEntityId !== "country-cn" || scope.toEntityId !== claim.partnerEntityId || scope.direction !== direction || scope.period?.label !== "2023" || !scope.classificationCodes.some((code) => code.system === "HS" && code.version === "2022" && code.code === "851713" && code.mappingType === "exact") || !evidence.locator.includes(observation.response.rawResponseSha256) || !evidence.locator.includes(observation.response.canonicalDataSha256)) throw new Error(`Closing evidence scope/hash mismatch: ${evidenceId}`);
}

/** Narrow, independently verifiable customs claim; never changes the associated route edge. */
export function reviewBilateralClaim(snapshot, fixture, claim) {
  const exported = scopedRow(snapshot, claim.exportPairId, 156, claim.partnerCode, "X");
  const imported = scopedRow(snapshot, claim.importPairId, claim.partnerCode, 156, "M");
  assertClosingEvidence(fixture, claim.exportEvidenceId, claim, exported, "export");
  assertClosingEvidence(fixture, claim.importEvidenceId, claim, imported, "import");
  return {
    gapId: claim.gapId, partnerCode: claim.partnerCode, period: "2023", classification: "HS 2022/851713", currency: "USD", unit: "current USD",
    exportValue: exported.row.primaryValue, importValue: imported.row.primaryValue,
    differenceImportMinusExport: imported.row.primaryValue - exported.row.primaryValue,
    differenceMethod: "独立进口报告 primaryValue 减独立出口报告 primaryValue；不调和、不平均、不解释为利润。",
    exportValuation: exported.row.fobvalue === exported.row.primaryValue ? "FOB" : "source primaryValue",
    importValuation: imported.row.cifvalue === imported.row.primaryValue ? "CIF" : "source primaryValue",
    exported: { requestUrl: exported.response.request.url, rawResponseSha256: exported.response.rawResponseSha256, canonicalDataSha256: exported.response.canonicalDataSha256 },
    imported: { requestUrl: imported.response.request.url, rawResponseSha256: imported.response.rawResponseSha256, canonicalDataSha256: imported.response.canonicalDataSha256 },
    scopeNote: claim.scopeNote
  };
}

function replaceDatasetReferences(value, oldId, newId) {
  if (Array.isArray(value)) return value.map((child) => replaceDatasetReferences(child, oldId, newId));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, key === "datasetVersionId" && child === oldId ? newId : replaceDatasetReferences(child, oldId, newId)]));
}

export async function buildPhoneGapReview(root = repositoryRoot) {
  const configText = await readFile(resolve(root, reviewPath), "utf8");
  const config = JSON.parse(configText);
  const baseDirectory = `data/published/releases/generic-smartphone/${config.baseDatasetVersion}`;
  const baseBytes = await readFile(resolve(root, baseDirectory, "fixture.json"));
  if (hash(baseBytes) !== config.baseFixtureSha256) throw new Error("Reviewed base fixture bytes changed");
  const baseline = JSON.parse(baseBytes.toString("utf8"));
  if (baseline.datasetVersion.version !== config.baseDatasetVersion || baseline.datasetVersion.status !== "published") throw new Error("Reviewed base fixture identity changed");
  const rawBytes = await readFile(resolve(root, config.rawSource));
  if (hash(rawBytes) !== config.rawSourceSha256) throw new Error("Reviewed raw snapshot bytes changed");
  const snapshot = JSON.parse(rawBytes.toString("utf8"));
  verifyBilateralSnapshot(snapshot);
  const comparisons = config.claims.map((claim) => reviewBilateralClaim(snapshot, baseline, claim));
  const fixture = replaceDatasetReferences(structuredClone(baseline), baseline.datasetVersion.id, config.datasetVersionId);
  fixture.datasetVersion = { ...fixture.datasetVersion, id: config.datasetVersionId, version: config.datasetVersion, publishedAt: config.reviewedAt, notes: `${baseline.datasetVersion.notes} ${config.reviewedAt} 复核本地 2023 双边快照，仅关闭两条成品手机贸易观察及镜像说明缺口；路线边和当前统计原样保留。` };
  fixture.contentVersions.push({ id: config.contentVersionId, version: config.contentVersion, status: "published", publishedAt: config.reviewedAt, notes: config.limitations.join(" ") });
  for (let index = 0; index < config.claims.length; index++) {
    const claim = config.claims[index];
    const comparison = comparisons[index];
    const gap = fixture.evidenceGaps.find((entry) => entry.gapId === claim.gapId);
    if (!gap || gap.period.label !== "2023" || !gap.flowId || gap.status !== "open") throw new Error(`Reviewed gap baseline changed: ${claim.gapId}`);
    const summary = `2023 年中国报告对${claim.partnerName}出口 HS 2022/851713 智能手机 ${comparison.exportValue} USD（${comparison.exportValuation}）；对方报告自中国进口 ${comparison.importValue} USD（${comparison.importValuation}）；进口报告减出口报告为 ${comparison.differenceImportMinusExport} USD。两者独立保留，不作调和或差异原因归属。`;
    Object.assign(gap, {
      currentClaim: `2023 年中国与${claim.partnerName}之间，存在具体伙伴代码的 HS 2022/851713 出口与镜像进口海关观察。`,
      currentEvidenceLevel: "bilateral_supported", status: "closed", contentVersionId: config.contentVersionId,
      missingEvidence: `该窄主张已由本地原始响应和逐条证据核验关闭。${summary} 相关组装至市场路线仍为代表性连接，组装地点、最终消费及物料谱系不在关闭范围。`,
      evidenceIds: [claim.exportEvidenceId, claim.importEvidenceId, claim.mirrorEvidenceId],
      nonInferences: [...new Set([...gap.nonInferences, ...config.limitations, claim.scopeNote])]
    });
    fixture.evidence.push({
      id: claim.mirrorEvidenceId, sourceId: "source-un-comtrade", supportType: "trade_observation",
      scope: { entityIds: ["country-cn", claim.partnerEntityId], fromEntityId: "country-cn", toEntityId: claim.partnerEntityId, itemIds: [fixture.productId], processStageIds: [], classificationCodes: [{ system: "HS", version: "2022", code: "851713", mappingType: "exact", description: "Smartphones" }], direction: null, period: gap.period, scopeDescription: `2023 年独立出口与镜像进口报告的差异复核。${claim.scopeNote}`, supportsCountryRole: false, supportsBilateralFlow: false, supportsProcessContext: false, limitations: config.limitations },
      locator: `${config.rawSource}; snapshotSha256=${config.rawSourceSha256}; ${comparison.exported.requestUrl}; ${comparison.imported.requestUrl}; ${reviewPath}`,
      excerpt: null, notes: summary
    });
  }
  const audit = { schemaVersion: "phone-bilateral-gap-review-audit.v1", batchId: config.batchId, reviewedAt: config.reviewedAt, sourceRetrievedAt: snapshot.fetchedAt, sourceFile: config.rawSource, sourceFileSha256: config.rawSourceSha256, sourceBundleCanonicalSha256: snapshot.payloadSha256, baseDatasetVersion: config.baseDatasetVersion, datasetVersion: config.datasetVersion, contentVersion: config.contentVersion, method: "curated", validation: { rawFileHash: "passed", responseCanonicalHashes: "passed", bundleCanonicalHash: "passed", specificPartnerScope: "passed", evidenceScopeAndHashes: "passed", currentStatisticsUnchanged: true, routeSemanticsUnchanged: true }, comparisons, limitations: config.limitations };
  const fixtureText = jsonBytes(fixture);
  const auditText = jsonBytes(audit);
  const baselineManifest = await readJson(resolve(root, baseDirectory, "manifest.json"));
  const manifest = { ...baselineManifest, fixtures: [{ productId: fixture.productId, path: "fixture.json" }], datasetVersion: config.datasetVersion, generatedAt: config.reviewedAt, fixtureSha256: hash(fixtureText), notes: [fixture.datasetVersion.notes], release: { productId: fixture.productId, datasetVersion: config.datasetVersion, releasePath: `releases/${fixture.productId}/${config.datasetVersion}`, immutable: true }, evidenceReview: { batchId: config.batchId, baseDatasetVersion: config.baseDatasetVersion, contentSource: reviewPath, contentPathBase: "repository-root", contentSha256: hash(configText), auditPath: "review-audit.json", auditPathBase: "release-directory", auditSha256: hash(auditText) } };
  return { config, fixture, manifest, audit, files: { "fixture.json": fixtureText, "manifest.json": jsonBytes(manifest), "review-audit.json": auditText } };
}

async function writeImmutable(path, bytes) {
  await mkdir(dirname(path), { recursive: true });
  try { await writeFile(path, bytes, { flag: "wx" }); }
  catch (error) { if (error.code !== "EEXIST") throw error; if ((await readFile(path, "utf8")) !== bytes) throw new Error(`Immutable output already differs: ${path}`); }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--publish")) throw new Error("Usage: node scripts/build-phone-gap-review.mjs [--publish]");
  const result = await buildPhoneGapReview();
  const output = args.includes("--publish") ? `data/published/releases/generic-smartphone/${result.config.datasetVersion}` : `data/candidates/${result.config.batchId}`;
  for (const [name, bytes] of Object.entries(result.files)) await writeImmutable(resolve(repositoryRoot, output, name), bytes);
  console.log(JSON.stringify({ status: "prepared", datasetVersion: result.config.datasetVersion, closedClaims: result.audit.comparisons.map((row) => row.gapId), output, activePointerChanged: false }, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
