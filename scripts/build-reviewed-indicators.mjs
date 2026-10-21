#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const readJson = async path => JSON.parse(await readFile(path, "utf8"));
const safe = value => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value);
function remap(value, previous, next) {
  if (Array.isArray(value)) return value.map(child => remap(child, previous, next));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, key === "datasetVersionId" && child === previous ? next : remap(child, previous, next)]));
}

/** Promote explicitly reviewed physical indicators; never edits the base release or active manifest. */
export async function buildReviewedIndicators(configPath, repositoryRoot = root) {
  const resolvedConfig = resolve(repositoryRoot, configPath);
  const contentText = await readFile(resolvedConfig, "utf8");
  const config = JSON.parse(contentText);
  for (const key of ["productId", "baseDatasetVersion", "datasetVersion", "datasetVersionId", "batchId"]) if (!safe(config[key])) throw new Error(`Invalid ${key}`);
  if (config.baseDatasetVersion === config.datasetVersion) throw new Error("A new immutable version is required");
  const baseDirectory = resolve(repositoryRoot, "data/published/releases", config.productId, config.baseDatasetVersion);
  const baseBytes = await readFile(resolve(baseDirectory, "fixture.json"));
  const baseManifest = await readJson(resolve(baseDirectory, "manifest.json"));
  if (hash(baseBytes) !== config.baseFixtureSha256 || baseManifest.fixtureSha256 !== config.baseFixtureSha256) throw new Error("Reviewed base hash mismatch");
  const baseline = JSON.parse(baseBytes);
  if (baseline.productId !== config.productId || baseline.datasetVersion.version !== config.baseDatasetVersion || baseline.datasetVersion.status !== "published") throw new Error("Reviewed base identity mismatch");
  const auditBytes = await readFile(resolve(baseDirectory, "review-audit.json"));
  if (hash(auditBytes) !== config.baseAuditSha256 || baseManifest.evidenceReview.auditSha256 !== config.baseAuditSha256) throw new Error("Reviewed audit hash mismatch");
  const reviewed = JSON.parse(auditBytes).reviewedUnpublishedIndicators ?? [];
  const fixture = remap(baseline, baseline.datasetVersion.id, config.datasetVersionId);
  const promoted = [];
  for (const descriptor of config.indicators) {
    const record = reviewed.find(row => row.indicator === descriptor.indicator && row.entityId === descriptor.entityId && row.period.label === descriptor.periodLabel);
    if (!record || record.method !== "official" || record.dataStatus !== "observed" || !Number.isFinite(record.quantity) || record.quantity < 0 || !record.unit) throw new Error(`Missing reviewed physical indicator: ${descriptor.indicator}`);
    if (!fixture.sources.some(source => source.id === record.sourceId) || !fixture.entities.some(entity => entity.id === record.entityId)) throw new Error("Unresolved indicator provenance");
    if (fixture.macroIndicators.some(row => row.id === descriptor.id || (row.indicator === record.indicator && row.entityId === record.entityId && row.period.label === record.period.label))) throw new Error("Duplicate promoted indicator");
    if (fixture.indicatorDefinitions.some(row => row.indicator === record.indicator)) throw new Error("Existing indicator definition must be reviewed separately");
    const metadata = { period: record.period, sourceIds: [record.sourceId], method: record.method, dataStatus: record.dataStatus, datasetVersionId: config.datasetVersionId };
    fixture.indicatorDefinitions.push({ id: descriptor.definitionId, indicator: record.indicator, label: descriptor.label, shortLabel: descriptor.label, description: descriptor.description, category: descriptor.category, displayOrder: descriptor.displayOrder, displayUnit: descriptor.displayUnit, displayCurrency: null, valueMeaning: descriptor.valueMeaning, sourceIndicatorCode: null, statisticalConcept: "other", formula: descriptor.formula, ...metadata });
    fixture.macroIndicators.push({ id: descriptor.id, entityId: record.entityId, indicator: record.indicator, period: record.period, value: null, quantity: record.quantity, currency: null, unit: record.unit, statisticalConcept: "other", sourceId: record.sourceId, datasetVersionId: config.datasetVersionId, method: record.method, dataStatus: record.dataStatus, notes: descriptor.notes });
    promoted.push({ descriptor, reviewedRecord: record });
  }
  fixture.datasetVersion = { ...fixture.datasetVersion, id: config.datasetVersionId, version: config.datasetVersion, publishedAt: config.reviewedAt, notes: config.notes };
  const audit = { schemaVersion: "reviewed-indicators-audit.v1", batchId: config.batchId, reviewedAt: config.reviewedAt, baseDatasetVersion: config.baseDatasetVersion, baseFixtureSha256: config.baseFixtureSha256, baseAuditSha256: config.baseAuditSha256, datasetVersion: config.datasetVersion, promoted, transformation: "Use the reviewed physical quantity and original period/unit/source. Currency and monetary value remain null; all prior facts and route content are preserved." };
  const fixtureText = json(fixture), auditText = json(audit);
  const manifest = { ...baseManifest, fixtures: [{ productId: config.productId, path: "fixture.json" }], datasetVersion: config.datasetVersion, generatedAt: config.reviewedAt, fixtureSha256: hash(fixtureText), notes: [config.notes], release: { productId: config.productId, datasetVersion: config.datasetVersion, releasePath: `releases/${config.productId}/${config.datasetVersion}`, immutable: true }, evidenceReview: { batchId: config.batchId, baseDatasetVersion: config.baseDatasetVersion, contentSource: configPath.replaceAll("\\", "/"), contentPathBase: "repository-root", contentSha256: hash(contentText), auditPath: "review-audit.json", auditPathBase: "release-directory", auditSha256: hash(auditText) } };
  return { config, fixture, manifest, audit, files: { "fixture.json": fixtureText, "manifest.json": json(manifest), "review-audit.json": auditText } };
}

async function main() {
  const args = process.argv.slice(2);
  const configPath = args.find(arg => !arg.startsWith("--"));
  if (!configPath) throw new Error("Usage: node scripts/build-reviewed-indicators.mjs CONFIG [--publish]");
  const result = await buildReviewedIndicators(configPath);
  const output = args.includes("--publish") ? `data/published/releases/${result.config.productId}/${result.config.datasetVersion}` : `data/candidates/${result.config.batchId}-${result.manifest.fixtureSha256.slice(0, 12)}`;
  for (const [name, bytes] of Object.entries(result.files)) {
    const path = resolve(root, output, name); await mkdir(dirname(path), { recursive: true });
    try { await writeFile(path, bytes, { flag: "wx" }); } catch (error) { if (error.code !== "EEXIST" || await readFile(path, "utf8") !== bytes) throw error; }
  }
  console.log(JSON.stringify({ status: "prepared", output, datasetVersion: result.config.datasetVersion, promoted: result.audit.promoted.length, activePointerChanged: false }));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
