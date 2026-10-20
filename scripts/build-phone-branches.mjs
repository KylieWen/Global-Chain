#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const contentPath = "content/routes/smartphone-branches-2026-10.json";
const rawDirectory = "data/published/raw/phone-branches-2026-10-21";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

function period(key) {
  return key.length === 4
    ? { granularity: "annual", start: `${key}-01-01`, end: `${key}-12-31`, label: key }
    : { granularity: "monthly", start: `${key}-01`, end: `${key}-${key.endsWith("09") ? "30" : "31"}`, label: key };
}

function remapDataset(value, previousId, id) {
  if (Array.isArray(value)) return value.map((child) => remapDataset(child, previousId, id));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, key === "datasetVersionId" && child === previousId ? id : remapDataset(child, previousId, id)]));
}

export async function buildPhoneBranches(repositoryRoot = root) {
  const contentText = await readFile(resolve(repositoryRoot, contentPath), "utf8");
  const config = JSON.parse(contentText);
  const baseDirectory = `data/published/releases/generic-smartphone/${config.baseDatasetVersion}`;
  const baseBytes = await readFile(resolve(repositoryRoot, baseDirectory, "fixture.json"));
  if (hash(baseBytes) !== config.baseFixtureSha256) throw new Error("Reviewed baseline hash mismatch");
  const baseline = JSON.parse(baseBytes.toString("utf8"));
  const f = remapDataset(baseline, baseline.datasetVersion.id, config.datasetVersionId);
  const sourceByKey = new Map();
  const sourceAudit = [];
  for (const source of config.sources) {
    let metadata, text, snapshotPath, rawHash;
    if (source.existingSourceId) {
      snapshotPath = source.snapshotPath;
      const bytes = await readFile(resolve(repositoryRoot, snapshotPath));
      metadata = JSON.parse(bytes.toString("utf8"));
      if (hash(metadata.body) !== metadata.sha256) throw new Error(`Existing body hash mismatch: ${source.key}`);
      text = metadata.body;
      rawHash = hash(bytes);
    } else {
      snapshotPath = `${rawDirectory}/${source.key}.json`;
      const bytes = await readFile(resolve(repositoryRoot, snapshotPath));
      metadata = JSON.parse(bytes.toString("utf8"));
      if (metadata.schemaVersion === "reviewed-primary-web-extract.v1") {
        text = `${metadata.selectedExcerpt} ${metadata.summary}`;
        rawHash = hash(bytes);
      } else {
        const raw = await readFile(resolve(repositoryRoot, rawDirectory, metadata.file));
        if (hash(raw) !== metadata.sha256) throw new Error(`Raw source hash mismatch: ${source.key}`);
        const extract = await readFile(resolve(repositoryRoot, rawDirectory, `${source.key}.txt`));
        const expectedTextHash = (await readFile(resolve(repositoryRoot, rawDirectory, `${source.key}.text-sha256`), "utf8")).trim();
        if (hash(extract) !== expectedTextHash) throw new Error(`Text extract hash mismatch: ${source.key}`);
        text = extract.toString("utf8"); rawHash = metadata.sha256;
      }
    }
    const normalized = text.replace(/\s+/g, " ").toLowerCase();
    for (const term of source.terms) if (!normalized.includes(term.toLowerCase())) throw new Error(`Source missing reviewed term ${term}: ${source.key}`);
    const id = source.existingSourceId ?? `source-phone-20261021-${source.key}`;
    if (!source.existingSourceId) f.sources.push({ id, name: source.name, publisher: source.publisher, url: metadata.url, license: metadata.license ?? "Publisher terms apply; link and limited summary.", publishedAt: null, retrievedAt: metadata.retrievedAt, datasetVersion: `phone-branches-source-review-${source.period}`, notes: `${source.locator} Snapshot: ${snapshotPath}; raw SHA256=${rawHash}; extraction=${metadata.retrievalMethod ?? "saved original file and text extract"}.` });
    sourceByKey.set(source.key, { id, source, snapshotPath, rawHash });
    sourceAudit.push({ key: source.key, sourceId: id, snapshotPath, rawHash, period: source.period, reviewedTerms: source.terms, locator: source.locator, extraction: metadata.retrievalMethod ?? "saved original file and hashed text extract" });
  }
  const methodSourceId = "source-globechain-phone-branches-2026";
  f.sources.push({ id: methodSourceId, name: "GlobeChain smartphone component route curation", publisher: "GlobeChain", url: null, license: "Project-authored explanatory content.", publishedAt: config.reviewedAt, retrievedAt: config.reviewedAt, datasetVersion: config.contentVersion, notes: `将有来源的部件组成、工艺先后和国家角色连接为可阅读的多分支结构。${config.limitations.join(" ")} Input ${contentPath}; SHA256=${hash(contentText)}.` });
  const curationId = "evidence-phone-branches-curation-2026";
  f.evidence.push({ id: curationId, sourceId: methodSourceId, supportType: "curation_method", scope: { entityIds: [], fromEntityId: null, toEntityId: null, itemIds: f.items.map((item) => item.id), processStageIds: [], direction: null, period: period("2026-10"), scopeDescription: "按公开工艺结构与历史国家角色整理组件到整机的代表性连接；不建立特定企业或货物的双边观察。", supportsCountryRole: false, supportsBilateralFlow: false, supportsProcessContext: false, limitations: config.limitations }, locator: contentPath, excerpt: null, notes: "数量与金额不适用于结构本身，未知实物流量继续保持unknown。" });
  f.contentVersions.push({ id: config.contentVersionId, version: config.contentVersion, status: "published", publishedAt: config.reviewedAt, notes: "补齐智能手机七类组件上下游、输入输出与替代组装分支；保留每条来源实际期间。" });
  const common = { method: "curated", datasetVersionId: config.datasetVersionId, contentVersionId: config.contentVersionId };
  const sourceIds = (key) => [sourceByKey.get(key).id, methodSourceId];
  function evidence(recordId, key, itemIds, entityId, stage, keyPeriod, role = false) {
    const source = sourceByKey.get(key);
    if (!source) throw new Error(`Unknown source key: ${key}`);
    const id = `evidence-phone-${recordId}`;
    f.evidence.push({ id, sourceId: source.id, supportType: role ? "country_role" : "process_context", scope: { entityIds: entityId ? [entityId] : [], fromEntityId: null, toEntityId: null, itemIds, processStageIds: stage ? [stage] : [], direction: null, period: period(keyPeriod), scopeDescription: source.source.locator, supportsCountryRole: role, supportsBilateralFlow: false, supportsProcessContext: !role, limitations: config.limitations }, locator: `${source.source.locator} ${source.snapshotPath}; SHA256=${source.rawHash}`, excerpt: null, notes: role ? "仅支持该记录所述国家制造/市场角色，工艺输入输出为通用结构。" : "支持部件用途或工艺结构，不支持本图企业之间的供货关系。" });
    return [id, curationId];
  }
  for (const entity of config.entities) f.entities.push({ id: entity.id, kind: "country", name: entity.name, iso2: entity.iso2, iso3: entity.iso3, m49: entity.m49, parentId: null, sourceIds: [sourceByKey.get(entity.sourceKey).id, "source-un-m49"], dataStatus: "observed", method: "curated", datasetVersionId: config.datasetVersionId, validPeriod: period(entity.period) });
  for (const [id, name, itemType, parentItemId, category, description, key] of config.items) f.items.push({ id, slug: id, name, itemType, parentItemId, category, description, sourceIds: [sourceByKey.get(key).id], dataStatus: "observed", method: "curated", datasetVersionId: config.datasetVersionId, validPeriod: period(sourceByKey.get(key).source.period) });
  for (const [id, changes] of Object.entries(config.descriptions)) Object.assign(f.items.find((item) => item.id === id), changes);
  for (const node of config.nodes) {
    const item = f.items.find((candidate) => candidate.id === node.item);
    const value = { id: node.id, nodeType: node.entity ? "entity" : "item", label: node.label, entityId: node.entity ?? null, itemId: node.item, itemType: item.itemType, processStageId: node.stage, period: period(node.period), sourceIds: sourceIds(node.sourceKey), evidenceIds: evidence(node.id, node.sourceKey, [node.item], node.entity, node.stage, node.period, node.role), evidenceLevel: node.role ? "role_supported" : "representative", dataStatus: node.role ? "observed" : "unknown", notes: node.notes, ...common };
    const existing = f.storyGraph.nodes.find((candidate) => candidate.id === node.id);
    if (existing) Object.assign(existing, value); else f.storyGraph.nodes.push(value);
  }
  for (const [id, fromEntityId, toEntityId, itemId, processStageId, notes, key] of config.flows) f.storyGraph.flows.push({ id: `flow-phone-${id}`, fromEntityId, toEntityId, itemId, processStageId, relationType: "input", flowKind: "representative_supply", period: period("2026-10"), value: null, quantity: null, currency: null, unit: null, valueDataStatus: "unknown", quantityDataStatus: "unknown", dataStatus: "unknown", evidenceLevel: "representative", confidence: null, sourceIds: sourceIds(key), evidenceIds: evidence(`flow-${id}`, key, [itemId], null, processStageId, "2026-10"), notes: `${notes}。依据工艺结构连接国家角色，不指认实际运输或企业供货。`, ...common });
  for (const activity of config.activityUpdates) {
    const existing = f.productionActivities.find((candidate) => candidate.id === activity.id);
    if (!existing) throw new Error(`Missing activity: ${activity.id}`);
    let ids, sources;
    if (activity.existingEvidenceId) { const record = f.evidence.find((candidate) => candidate.id === activity.existingEvidenceId); if (!record) throw new Error(`Missing existing evidence ${activity.existingEvidenceId}`); ids = [record.id, curationId]; sources = [record.sourceId, methodSourceId]; }
    else { ids = evidence(activity.id, activity.sourceKey, activity.outputs, activity.entity, activity.stage, activity.period, true); sources = sourceIds(activity.sourceKey); }
    if (activity.researchNote && !activity.existingEvidenceId) f.evidence.find((record) => record.id === ids[0]).notes += ` ${activity.researchNote}`;
    Object.assign(existing, { locationEntityId: activity.entity, processStageId: activity.stage, inputItemIds: activity.inputs, outputItemIds: activity.outputs, period: period(activity.period), sourceIds: sources, evidenceIds: ids, evidenceLevel: "role_supported", dataStatus: "observed", notes: activity.notes, ...common });
    const node = f.storyGraph.nodes.find((candidate) => candidate.entityId === activity.entity && candidate.itemId === activity.outputs[0] && candidate.id !== "node-kr-module");
    if (node && ["activity-cn-cathode", "activity-cn-anode", "activity-kr-cell", "activity-cn-assembly", "activity-us-distribution", "activity-de-consumption", "activity-jp-components"].includes(activity.id)) Object.assign(node, { period: period(activity.period), processStageId: activity.stage, sourceIds: sources, evidenceIds: ids, evidenceLevel: "role_supported", dataStatus: "observed", notes: activity.notes, ...common });
  }
  for (const node of f.storyGraph.nodes) node.label = node.label.replace(/（代表性）|（待补[^）]*）/g, "").replace(/国家角色|产业角色/g, "制造");
  f.storyGraph.nodes.find((node) => node.id === "node-us-export").label = "美国 · 手机零售市场";
  f.storyGraph.nodes.find((node) => node.id === "node-de-consumption").label = "德国 · 手机零售市场";
  for (const [id, [title, description]] of Object.entries(config.stepUpdates)) { const step = f.storyGraph.steps.find((candidate) => candidate.id === id); Object.assign(step, { title, description, contentVersionId: config.contentVersionId }); }
  const newNodeIds = config.nodes.map((node) => node.id);
  f.storyGraph.steps.push({ id: "step-phone-component-branches", order: 9, title: "组件汇入整机的多条路径", description: "从晶圆、相机、电路、机身和声学部件继续追踪到整机组装，也可探索越南与印度的组装分支。", nodeIds: newNodeIds, flowIds: config.flows.map(([id]) => `flow-phone-${id}`), evidenceIds: [curationId], method: "curated", contentStatus: "published", contentVersionId: config.contentVersionId });
  for (const chain of config.manufacturingChains) {
    const chainEvidence = evidence(chain.id, chain.sourceKey, [chain.item], null, null, chain.period);
    const extraKeys = chain.additionalSourceKeys ?? [];
    const extraEvidence = extraKeys.flatMap((key) => evidence(`${chain.id}-${key}`, key, [chain.item], null, null, chain.period).filter((id) => id !== curationId));
    const metadata = { ...common, period: period(chain.period), sourceIds: [...new Set([...sourceIds(chain.sourceKey), ...extraKeys.map((key) => sourceByKey.get(key).id)])], evidenceIds: [...chainEvidence, ...extraEvidence], dataStatus: "observed" };
    f.manufacturingProcessChains.push({ id: chain.id, itemId: chain.item, title: chain.title, description: "沿输入、加工和输出逐步阅读部件如何形成。", limitations: config.limitations, ...metadata });
    chain.steps.forEach(([name, inputItemIds, outputItemIds, description], index) => {
      const id = `${chain.id}-step-${index + 1}`;
      f.manufacturingProcessSteps.push({ id, processChainId: chain.id, order: index + 1, name, description, phase: "部件制造与集成", routeVariantIds: [], inputItemIds, outputItemIds, limitations: config.limitations, ...metadata });
      inputItemIds.forEach((itemId, inputIndex) => f.processRequirements.push({ id: `${id}-input-${inputIndex + 1}`, processStepId: id, requirementType: "material", equipmentCategoryId: null, itemId, name: f.items.find((item) => item.id === itemId).name, necessity: "core", description: "工序输入；不表示固定配方比例或指定供应商。", limitations: config.limitations, ...metadata }));
    });
  }
  f.storyGraph.period = { granularity: "annual", start: "2023-01-01", end: "2026-10-31", label: "2023—2026（多期资料）" };
  f.storyGraph.contentVersionId = config.contentVersionId;
  f.storyGraph.representativeStatement = "从原料、部件到整机的代表性制造路径，节点与连接分别保留各自资料年份。";
  f.storyGraph.methodology.push("2026-10批次补齐组件输入输出和整机接入，以来源实际期间保留历史国家角色；跨期工艺连接为结构说明。");
  f.storyGraph.limitations.push(...config.limitations);
  f.datasetVersion = { ...f.datasetVersion, id: config.datasetVersionId, version: config.datasetVersion, publishedAt: config.reviewedAt, sourceIds: [...new Set(f.sources.map((source) => source.id))], notes: "补齐处理器、相机、电路板、结构件、声学、电池与屏幕的工艺输入输出，新增印度/越南组装及台湾晶圆制造分支。统计与代表性结构分开；具体记录保留来源年份。" };
  const audit = { schemaVersion: "phone-branch-audit.v1", batchId: config.batchId, reviewedAt: config.reviewedAt, baseDatasetVersion: config.baseDatasetVersion, baseFixtureSha256: config.baseFixtureSha256, datasetVersion: config.datasetVersion, sourceAudit, addedNodes: config.nodes.filter((node) => !baseline.storyGraph.nodes.some((old) => old.id === node.id)).length, updatedNodes: config.nodes.filter((node) => baseline.storyGraph.nodes.some((old) => old.id === node.id)).length, addedFlows: config.flows.length, activityUpdates: config.activityUpdates.map((activity) => activity.id), remainingUnknownActivities: f.productionActivities.filter((activity) => activity.dataStatus === "unknown").map((activity) => activity.id), processChainsAdded: config.manufacturingChains.length, processStepsAdded: config.manufacturingChains.reduce((count, chain) => count + chain.steps.length, 0), addedIndicators: [], reviewedUnpublishedIndicators: [{ indicator: "smartphone_production_units", entityId: "country-cn", period: period("2023"), quantity: 1140000000, unit: "items", dataStatus: "observed", method: "official", sourceId: sourceByKey.get("china-smartphone-2023").id, datasetVersion: config.datasetVersion, notes: "2023年规模以上企业智能手机产量11.4亿台，来源单列智能手机；现有macro契约仅支持货币value，数量型指标待通用模型扩展后进入fixture，不伪造currency。" }], limitations: config.limitations };
  const fixtureText = json(f), auditText = json(audit);
  const baseManifest = await readJson(resolve(repositoryRoot, baseDirectory, "manifest.json"));
  const manifest = { ...baseManifest, fixtures: [{ productId: f.productId, path: "fixture.json" }], datasetVersion: config.datasetVersion, generatedAt: config.reviewedAt, fixtureSha256: hash(fixtureText), routeContentVersion: config.contentVersion, routeContentSha256: hash(contentText), notes: [f.datasetVersion.notes], release: { productId: f.productId, datasetVersion: config.datasetVersion, releasePath: `releases/${f.productId}/${config.datasetVersion}`, immutable: true }, evidenceReview: { batchId: config.batchId, baseDatasetVersion: config.baseDatasetVersion, contentSource: contentPath, contentPathBase: "repository-root", contentSha256: hash(contentText), auditPath: "review-audit.json", auditPathBase: "release-directory", auditSha256: hash(auditText) } };
  return { config, fixture: f, audit, manifest, files: { "fixture.json": fixtureText, "manifest.json": json(manifest), "review-audit.json": auditText } };
}

async function main() {
  const publish = process.argv.slice(2).includes("--publish");
  const result = await buildPhoneBranches();
  const output = publish ? `data/published/releases/generic-smartphone/${result.config.datasetVersion}` : `data/candidates/${result.config.batchId}-${result.manifest.fixtureSha256.slice(0, 12)}`;
  for (const [name, bytes] of Object.entries(result.files)) {
    const path = resolve(root, output, name); await mkdir(dirname(path), { recursive: true });
    try { await writeFile(path, bytes, { flag: "wx" }); } catch (error) { if (error.code !== "EEXIST") throw error; if ((await readFile(path, "utf8")) !== bytes) throw new Error(`Immutable candidate/release differs: ${path}`); }
  }
  console.log(JSON.stringify({ status: "prepared", datasetVersion: result.config.datasetVersion, output, addedFlows: result.audit.addedFlows, processStepsAdded: result.audit.processStepsAdded, activePointerChanged: false }, null, 2));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
