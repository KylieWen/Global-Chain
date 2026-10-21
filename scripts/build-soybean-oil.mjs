#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const input = "content/products/soybean-oil-2026-10.json";
const rawDirectory = "data/raw/soybean-oil-2026-10-21";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
function period(key) {
  return key.length === 4 ? { granularity: "annual", start: `${key}-01-01`, end: `${key}-12-31`, label: key } : { granularity: "monthly", start: `${key}-01`, end: `${key}-31`, label: key };
}

/** Build a new product only from its reviewed content and saved official originals. */
export async function buildSoybeanOil(repositoryRoot = root) {
  const contentBytes = await readFile(resolve(repositoryRoot, input));
  const c = JSON.parse(contentBytes.toString("utf8"));
  const sourceMap = new Map(), auditSources = [];
  const f = { schemaVersion: "product-fixture.v1", productId: c.productId, sources: [], evidence: [], evidenceGaps: [], contentVersions: [{ id: c.contentVersionId, version: c.contentVersion, status: "published", publishedAt: c.reviewedAt, notes: "大豆、毛油、精炼油、包装与豆粕分支。" }], entities: [], items: [], processStages: [], productionActivities: [], classificationCodes: [], classificationCrosswalks: [], tradeObservations: [], materialTradeObservations: [], macroIndicators: [], indicatorDefinitions: [], manufacturingProcessChains: [], manufacturingProcessSteps: [], manufacturingRouteVariants: [], processRequirements: [], equipmentCategories: [], organizations: [], facilities: [], organizationCapabilities: [], tradeGuides: [], tariffMeasures: [], tradeRequirements: [], tradeProcedures: [], tradeProcedureSteps: [], tradeDocumentRequirements: [], policyDocuments: [], missingDataNotes: c.limitations, warnings: [] };
  for (const source of c.sources) {
    const path = `${rawDirectory}/${source.file}`;
    const bytes = await readFile(resolve(repositoryRoot, path));
    const meta = await readJson(resolve(repositoryRoot, `${path}.meta.json`));
    if (hash(bytes) !== meta.sha256 || meta.status !== "downloaded") throw new Error(`Source hash/status mismatch: ${source.key}`);
    let text = bytes.toString("utf8");
    if (source.file.endsWith(".pdf") || source.file.endsWith(".html")) {
      const textPath = path.replace(/\.(pdf|html)$/, ".txt");
      const textBytes = await readFile(resolve(repositoryRoot, textPath));
      const expected = (await readFile(resolve(repositoryRoot, `${textPath}.sha256`), "utf8")).trim();
      if (hash(textBytes) !== expected) throw new Error(`Text hash mismatch: ${source.key}`);
      text = textBytes.toString("utf8");
    }
    const normalized = text.replace(/\s+/g, " ").toLowerCase();
    for (const term of source.terms) if (!normalized.includes(term.toLowerCase())) throw new Error(`Missing reviewed term ${term}: ${source.key}`);
    const id = `source-soy-${source.key}`;
    f.sources.push({ id, name: source.name, publisher: meta.publisher, url: meta.url, license: "Publisher terms apply; official reference and limited factual summary.", publishedAt: null, retrievedAt: meta.retrievedAt, datasetVersion: `${source.key}-${source.period}`, notes: `${source.locator} Snapshot ${path}; SHA256=${meta.sha256}.` });
    sourceMap.set(source.key, { id, source, meta, bytes, text });
    auditSources.push({ key: source.key, path, sha256: meta.sha256, url: meta.url, retrievedAt: meta.retrievedAt, reviewedTerms: source.terms, locator: source.locator });
  }
  const methodSourceId = "source-soy-curation", curationId = "evidence-soy-curation";
  f.sources.push({ id: methodSourceId, name: "GlobeChain大豆油商品结构整理", publisher: "GlobeChain", url: null, license: "Project-authored content.", publishedAt: c.reviewedAt, retrievedAt: c.reviewedAt, datasetVersion: c.contentVersion, notes: `${input}; SHA256=${hash(contentBytes)}。按来源解释原料、油品、副产物和包装功能，不建立企业供货关系。` });
  sourceMap.set("curation", { id: methodSourceId, source: { period: "2026-10", locator: input } });
  const common = { method: "curated", datasetVersionId: c.datasetVersionId, contentVersionId: c.contentVersionId };
  const sourceIds = (key) => [...new Set([sourceMap.get(key).id, methodSourceId])];
  function evidence(id, key, itemIds, stage, keyPeriod, entityId = null, role = false) {
    const source = sourceMap.get(key);
    const value = { id, sourceId: source.id, supportType: role ? "country_role" : key === "curation" ? "curation_method" : "process_context", scope: { entityIds: entityId ? [entityId] : [], fromEntityId: null, toEntityId: null, itemIds, processStageIds: stage ? [stage] : [], direction: null, period: period(keyPeriod), scopeDescription: source.source.locator, supportsCountryRole: role, supportsBilateralFlow: false, supportsProcessContext: !role && key !== "curation", limitations: c.limitations }, locator: source.source.locator, excerpt: null, notes: "来源期间与策展期间分开；国家角色不能证明相邻工厂或批次的供货关系。" };
    f.evidence.push(value); return value.id;
  }
  for (const [id, name, iso2, iso3, m49] of c.entities) f.entities.push({ id, kind: "country", name, iso2, iso3, m49, parentId: null, sourceIds: sourceIds("trade"), method: "curated", dataStatus: "observed", datasetVersionId: c.datasetVersionId, validPeriod: period("2024") });
  for (const [id, name, itemType, parentItemId, category, description, key] of c.items) f.items.push({ id, slug: id, name, itemType, parentItemId, category, description, sourceIds: sourceIds(key), method: "curated", dataStatus: "observed", datasetVersionId: c.datasetVersionId, validPeriod: period(sourceMap.get(key).source.period) });
  evidence(curationId, "curation", f.items.map((item) => item.id), null, "2026-10");
  c.stages.forEach(([id, label, description], order) => f.processStages.push({ id, code: id, label, order, description, sourceIds: sourceIds("curation"), method: "curated", dataStatus: "observed", datasetVersionId: c.datasetVersionId }));
  f.storyGraph = { productId: c.productId, period: { granularity: "annual", start: "2024-01-01", end: "2026-10-31", label: "2024—2026（多期资料）" }, nodes: [], flows: [], steps: [], ...common, representativeStatement: "大豆从种植、提油到精炼包装的多条制造路径，豆粕保留为副产分支。", methodology: ["国家制造与用途背景、代表性工艺和海关观察分开保存；贸易保留HS6及真实自然年，USDA指标保留市场年度。"], limitations: c.limitations, warnings: [] };
  for (const [id, label, entityId, itemId, stage, key, keyPeriod, role, notes] of c.nodes) {
    const ev = evidence(`evidence-soy-node-${id}`, key, [itemId], stage, keyPeriod, entityId, role);
    const item = f.items.find((item) => item.id === itemId);
    f.storyGraph.nodes.push({ id: `node-soy-${id}`, nodeType: "entity", label, entityId, itemId, itemType: item.itemType, processStageId: stage, period: period(keyPeriod), sourceIds: sourceIds(key), evidenceIds: [...new Set([ev, curationId])], evidenceLevel: role ? "role_supported" : "representative", dataStatus: role ? "observed" : "unknown", notes, ...common });
    if (role) {
      const inputs = stage === "crushing" ? ["soybean"] : stage === "coproduct" ? ["defatted-flakes"] : stage === "distribution" ? ["generic-soybean-oil"] : [];
      const outputs = stage === "crushing" ? ["crude-soybean-oil", "soybean-meal"] : [itemId];
      f.productionActivities.push({ id: `activity-soy-${id}`, locationEntityId: entityId, processStageId: stage, inputItemIds: inputs, outputItemIds: outputs, period: period(keyPeriod), sourceIds: sourceIds(key), evidenceIds: [...new Set([ev, curationId])], evidenceLevel: "role_supported", dataStatus: "observed", notes: label.split(" · ").at(-1), ...common });
    }
  }
  for (const [id, from, to, itemId, stage, notes] of c.flows) f.storyGraph.flows.push({ id: `flow-soy-${id}`, fromEntityId: `node-soy-${from}`, toEntityId: `node-soy-${to}`, itemId, processStageId: stage, relationType: "input", flowKind: "representative_supply", period: period("2026-10"), value: null, quantity: null, currency: null, unit: null, valueDataStatus: "unknown", quantityDataStatus: "unknown", dataStatus: "unknown", evidenceLevel: "representative", confidence: null, sourceIds: sourceIds("curation"), evidenceIds: [curationId], notes, ...common });
  c.storySteps.forEach(([id, title, description, nodes, flows], order) => f.storyGraph.steps.push({ id: `step-soy-${id}`, order, title, description, nodeIds: nodes.map((id) => `node-soy-${id}`), flowIds: flows.map((id) => `flow-soy-${id}`), evidenceIds: [curationId], method: "curated", contentStatus: "published", contentVersionId: c.contentVersionId }));
  const hs = JSON.parse(sourceMap.get("hs").bytes.toString("utf8")).results;
  for (const [code, itemId, mappingType, label] of c.classifications) {
    const original = hs.find((row) => row.id === code);
    if (!original) throw new Error(`Unverified classification: ${code}`);
    f.classificationCodes.push({ id: `hs-2022-${code}`, system: "HS", version: "2022", code, level: code.length, label, validPeriod: period("2024"), sourceIds: sourceIds("hs"), dataStatus: "observed", method: "official", datasetVersionId: c.datasetVersionId });
    f.classificationCrosswalks.push({ id: `crosswalk-soy-${code}`, itemId, classificationCodeId: `hs-2022-${code}`, mappingType, confidence: null, notes: original.text, limitation: "分类不单独确认零售包装或最终食用用途。", period: period("2024"), sourceIds: sourceIds("hs"), dataStatus: "observed", method: "curated", datasetVersionId: c.datasetVersionId });
  }
  f.classificationCrosswalks.push({ id: "crosswalk-soy-product-noncrude", itemId: c.productId, classificationCodeId: "hs-2022-150790", mappingType: "aggregate", confidence: null, notes: "成品贸易使用非毛油及其分离品分类（含其他用途）；毛油另作为加工材料观察。", limitation: "非毛油分类仍不限定食用或零售包装。", period: period("2024"), sourceIds: sourceIds("hs"), dataStatus: "observed", method: "curated", datasetVersionId: c.datasetVersionId });
  const units = JSON.parse(sourceMap.get("units").bytes.toString("utf8")).results;
  const kg = units.find((unit) => unit.qtyCode === 8);
  if (kg?.qtyAbbr !== "kg") throw new Error("UN quantity unit8 is not verified as kg");
  const rawTrade = JSON.parse(sourceMap.get("trade").bytes.toString("utf8"));
  if (rawTrade.error || !rawTrade.data?.length || rawTrade.count !== rawTrade.data.length) throw new Error("Empty, erroneous or truncated trade snapshot");
  const allowedCodes = new Set(["150710", "150790", "120190", "230400"]), partnerIds = new Map([[76, "country-br"], [842, "country-us"]]);
  const tradeKeys = new Set();
  for (const row of rawTrade.data) {
    if (row.reporterCode !== 156 || row.period !== "2024" || row.classificationCode !== "H6" || !allowedCodes.has(row.cmdCode) || ![0, 76, 842].includes(row.partnerCode) || !["M", "X"].includes(row.flowCode) || row.partner2Code !== 0 || row.customsCode !== "C00" || row.motCode !== 0 || row.qtyUnitCode !== 8) throw new Error("Trade snapshot contains unreviewed scope");
    const id = `soy-trade-${row.cmdCode}-${row.flowCode}-${row.partnerCode}-2024`;
    if (tradeKeys.has(id)) throw new Error("Duplicate trade observation"); tradeKeys.add(id);
    const quality = Object.fromEntries(["isQtyEstimated", "isNetWgtEstimated", "isReported", "isAggregate", "legacyEstimationFlag"].map((key) => [key, row[key] ?? null]));
    const shared = { reporterEntityId: "country-cn", reporterCode: 156, partnerEntityId: partnerIds.get(row.partnerCode) ?? null, partnerCode: row.partnerCode, partnerScope: row.partnerCode === 0 ? "world_total" : "entity", classificationSystem: "HS", classificationVersion: "2022", classificationCode: row.cmdCode, period: period("2024"), value: row.primaryValue ?? null, quantity: row.qty ?? null, currency: row.primaryValue === null ? null : "USD", unit: "kg", valueDataStatus: row.primaryValue === null ? "unknown" : "observed", quantityDataStatus: row.qty === null ? "unknown" : row.isQtyEstimated ? "estimated" : "observed", sourceId: sourceMap.get("trade").id, method: "official", datasetVersionId: c.datasetVersionId, quality };
    if (row.cmdCode === "150790") f.tradeObservations.push({ id, ...shared, itemId: c.productId, direction: row.flowCode === "M" ? "import" : "export", flowCode: row.flowCode, partner2Code: 0, statisticalConcept: "customs", dataStatus: shared.valueDataStatus, qualityNote: "非毛油及其分离品（含其他用途）；金额不是零售销量，世界总计与具体伙伴不能相加。" });
    else f.materialTradeObservations.push({ observationId: id, ...shared, materialItemId: row.cmdCode === "120190" ? "soybean" : row.cmdCode === "150710" ? "crude-soybean-oil" : "soybean-meal", flow: row.flowCode === "M" ? "import" : "export", classificationMappingType: row.cmdCode === "150710" ? "exact" : "aggregate", evidenceLevel: "role_supported", limitation: row.cmdCode === "120190" ? "非种用大豆，不能将全部进口豆归为食用油原料。" : row.cmdCode === "150710" ? "毛油（可已脱胶），不能直接当成瓶装食用油；未知最终用途。" : "提油后的固体残余物分类，不指定饲料客户或对应同批豆油。" });
  }
  for (const chain of c.processChains) {
    const ev = evidence(`evidence-${chain.id}`, chain.sourceKey, [chain.item], null, chain.sourcePeriod);
    const metadata = { ...common, period: period(chain.sourcePeriod), sourceIds: sourceIds(chain.sourceKey), evidenceIds: [...new Set([ev, curationId])], dataStatus: "observed" };
    f.manufacturingProcessChains.push({ id: `process-chain-${chain.id}`, itemId: chain.item, title: chain.title, description: chain.sourceKey === "process" ? "历史技术参考中的浸出与化学精炼路线；逐步查看输入、设备和产物。" : "按通用包装功能整理的成品形成步骤。", limitations: c.limitations, ...metadata });
    chain.steps.forEach(([id, name, inputs, outputs, description, equipment], order) => {
      const stepId = `process-${chain.id}-${id}`;
      f.manufacturingProcessSteps.push({ id: stepId, processChainId: `process-chain-${chain.id}`, order, name, description, phase: chain.title, routeVariantIds: [], inputItemIds: inputs, outputItemIds: outputs, limitations: c.limitations, ...metadata });
      inputs.forEach((itemId, index) => f.processRequirements.push({ id: `${stepId}-material-${index}`, processStepId: stepId, requirementType: "material", equipmentCategoryId: null, itemId, name: f.items.find((item) => item.id === itemId).name, necessity: "core", description: "该代表工序的功能输入；不提供配方或固定比例。", limitations: c.limitations, ...metadata }));
      if (equipment) {
        const equipmentId = `equipment-${chain.id}-${id}`;
        f.equipmentCategories.push({ id: equipmentId, name: equipment, description: "技术说明所列功能设备类别，不指认厂商或供货关系。", period: metadata.period, sourceIds: metadata.sourceIds, method: "curated", dataStatus: "observed", datasetVersionId: c.datasetVersionId });
        f.processRequirements.push({ id: `${stepId}-equipment`, processStepId: stepId, requirementType: "equipment", equipmentCategoryId: equipmentId, itemId: null, name: equipment, necessity: "core", description: "完成工序功能的设备类别，具体选型按工厂路线另行核验。", limitations: c.limitations, ...metadata });
      }
    });
  }
  f.indicatorDefinitions.push({ id: "indicator-soy-oil-production", indicator: "soybean_oil_production_kg", label: "豆油产量（USDA估计）", shortLabel: "豆油产量", description: "USDA历史市场年度豆油产量，含食品与非食品用途，非瓶装成品产量；各国年度起始月不同。", category: "生产", displayOrder: 0, displayUnit: "千克", displayCurrency: null, valueMeaning: "历史市场年度估计产量，不等于海关出口或零售销量。", sourceIndicatorCode: "Production", statisticalConcept: "other", formula: "来源1000 metric tonnes × 1000000 = kg", period: null, sourceIds: [sourceMap.get("china").id, sourceMap.get("brazil").id], method: "curated", dataStatus: "estimated", datasetVersionId: c.datasetVersionId });
  for (const m of c.macros) f.macroIndicators.push({ id: `macro-soy-${m.id}`, entityId: m.entityId, indicator: m.indicator, period: m.period, value: null, quantity: m.quantity, currency: null, unit: "kg", statisticalConcept: "other", sourceId: sourceMap.get(m.sourceKey).id, datasetVersionId: c.datasetVersionId, method: "estimated", dataStatus: m.status, notes: `${m.locator} USDA历史估计；保留USDA Official列，不和New Post列混合。油品含非食品用途。` });
  f.evidenceGaps.push({ gapId: "gap-soy-batch-lineage", flowId: "flow-soy-br-import", nodeId: null, currentClaim: "巴西大豆进入中国加工的代表分支；2024年中国对巴西进口观察已另存。", currentEvidenceLevel: "representative", missingEvidence: "实际农场、船批、压榨厂与零售油批次间的可验证链接。", acceptableEvidenceTypes: ["bilateral_flow", "commercial_relationship"], candidateSources: [{ name: "具备授权的供应链批次与工厂披露", publisher: "相关加工与贸易主体", url: null, license: "公开披露或合法授权", notes: "海关国家年度数据不能代替批次记录。" }], classificationCandidates: [], status: "not_publicly_observable", nonInferences: ["不把两端的国家角色或进口金额当作同一瓶油的完整谱系。"], evidenceIds: [curationId], period: period("2026-10"), method: "curated", datasetVersionId: c.datasetVersionId, contentVersionId: c.contentVersionId });
  f.datasetVersion = { id: c.datasetVersionId, name: "大豆食用油独立商品数据集", version: c.datasetVersion, publishedAt: c.reviewedAt, sourceIds: f.sources.map((source) => source.id), coverage: null, status: "published", notes: "种植、进口、提油、精炼、包装与豆粕副产；中国2024自然年海关观察，国家角色与多期工艺参考分开。" };
  const audit = { schemaVersion: "soybean-oil-review.v1", batchId: c.batchId, reviewedAt: c.reviewedAt, datasetVersion: c.datasetVersion, sources: auditSources, tradeRecords: f.tradeObservations.length, materialRecords: f.materialTradeObservations.length, nodes: f.storyGraph.nodes.length, flows: f.storyGraph.flows.length, processSteps: f.manufacturingProcessSteps.length, macros: c.macros, limitations: c.limitations };
  const fixtureText = json(f), auditText = json(audit);
  const manifest = { schemaVersion: "fixture-manifest.v1", fixtures: [{ productId: c.productId, path: "fixture.json", datasetVersion: c.datasetVersion, fixtureSha256: hash(fixtureText) }], datasetVersion: c.datasetVersion, generatedAt: c.reviewedAt, fixtureSha256: hash(fixtureText), notes: [f.datasetVersion.notes], release: { productId: c.productId, datasetVersion: c.datasetVersion, releasePath: `releases/${c.productId}/${c.datasetVersion}`, immutable: true }, evidenceReview: { batchId: c.batchId, contentSource: input, contentPathBase: "repository-root", contentSha256: hash(contentBytes), auditPath: "review-audit.json", auditPathBase: "release-directory", auditSha256: hash(auditText) } };
  return { config: c, fixture: f, manifest, audit, files: { "fixture.json": fixtureText, "manifest.json": json(manifest), "review-audit.json": auditText } };
}

async function main() {
  const result = await buildSoybeanOil();
  const publish = process.argv.slice(2).includes("--publish");
  const output = publish ? `data/published/releases/${result.config.productId}/${result.config.datasetVersion}` : `data/candidates/${result.config.batchId}-${result.manifest.fixtureSha256.slice(0, 12)}`;
  for (const [name, bytes] of Object.entries(result.files)) {
    const target = resolve(root, output, name); await mkdir(dirname(target), { recursive: true });
    try { await writeFile(target, bytes, { flag: "wx" }); }
    catch (error) { if (error.code !== "EEXIST") throw error; if (await readFile(target, "utf8") !== bytes) throw new Error(`Existing immutable output differs: ${target}`); }
  }
  console.log(json({ status: "prepared-not-activated", output, datasetVersion: result.config.datasetVersion, fixtureSha256: result.manifest.fixtureSha256, counts: { nodes: result.audit.nodes, flows: result.audit.flows, trade: result.audit.tradeRecords, materials: result.audit.materialRecords, processSteps: result.audit.processSteps } }));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
