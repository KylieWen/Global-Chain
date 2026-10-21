import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const electricBicycleContentPath = "content/products/electric-bicycle-2026-10.json";
export const electricBicycleReviewPath = "content/reviews/electric-bicycle-2026-10-21.json";
const hash = value => createHash("sha256").update(value).digest("hex");
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const unique = values => [...new Set(values)];
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const period = key => key.length === 4
  ? { granularity: "annual", start: `${key}-01-01`, end: `${key}-12-31`, label: key }
  : { granularity: "monthly", start: `${key}-01`, end: `${key}-31`, label: key };

async function readPinned(repositoryRoot, path, expected) {
  const absolute = resolve(repositoryRoot, path), child = relative(repositoryRoot, absolute);
  assert(child && !isAbsolute(child) && !child.startsWith(".."), `Unsafe input path: ${path}`);
  const bytes = await readFile(absolute);
  assert(hash(bytes) === expected, `Reviewed source hash changed: ${path}`);
  return bytes;
}

/** Offline and deterministic: no network calls, current clock or active-manifest writes. */
export async function buildElectricBicycle(repositoryRoot = root) {
  const contentBytes = await readFile(resolve(repositoryRoot, electricBicycleContentPath));
  const reviewBytes = await readFile(resolve(repositoryRoot, electricBicycleReviewPath));
  const c = JSON.parse(contentBytes), review = JSON.parse(reviewBytes);
  assert(c.productId === "generic-electric-bicycle" && c.datasetVersion === "globe-chain-electric-bicycle-2026.1", "Electric bicycle identity requires a new review");
  const rawManifest = JSON.parse(await readPinned(repositoryRoot, review.rawManifest.path, review.rawManifest.sha256));
  const snapshots = new Map();
  for (const spec of review.sourceSnapshots) {
    const bytes = await readPinned(repositoryRoot, spec.path, spec.sha256);
    const normalized = bytes.toString("utf8").replace(/\s+/g, " ").toLowerCase();
    for (const term of spec.reviewedTerms) assert(normalized.includes(term.toLowerCase()), `Missing reviewed term ${term}: ${spec.alias}`);
    snapshots.set(spec.alias, { ...spec, bytes });
  }
  // Verify every frozen research original, including the reference not used as a displayed fact.
  for (const source of rawManifest.sources) {
    assert(source.status === "downloaded" && source.httpStatus === 200, `Unsuccessful research snapshot: ${source.file}`);
    await readPinned(repositoryRoot, `data/raw/ebike-research/${source.file}`, source.sha256);
  }
  const source = key => { const s = snapshots.get(key); assert(s, `Unknown source: ${key}`); return s; };
  const curation = { id: "source-ebike-curation", name: "GlobeChain 电动自行车结构与证据整理", publisher: "GlobeChain", url: null, license: "项目自行整理内容；原始机构条款分别适用。", publishedAt: c.reviewedAt, retrievedAt: c.reviewedAt, datasetVersion: c.contentVersion, notes: `${electricBicycleContentPath}; SHA-256=${hash(contentBytes)}。国家角色、历史工艺、代表连接和海关观察分开。` };
  const sourceIds = key => unique([key === "curation" ? curation.id : source(key).source.id, curation.id]);
  const common = { method: "curated", datasetVersionId: c.datasetVersionId, contentVersionId: c.contentVersionId };
  const evidence = [];
  function addEvidence(id, key, type, keyPeriod, itemIds, stageIds = [], entityIds = [], bilateral = null) {
    const spec = key === "curation" ? null : source(key);
    evidence.push({ id, sourceId: spec?.source.id ?? curation.id, supportType: type, scope: {
      entityIds, fromEntityId: bilateral?.from ?? null, toEntityId: bilateral?.to ?? null, itemIds, processStageIds: stageIds,
      direction: bilateral ? "export" : null, period: period(keyPeriod), scopeDescription: spec?.locator ?? "配置中的多来源代表结构；地理角色不等于逐批物流。",
      classificationCodes: key === "trade" ? [{ system: "HS", version: "2022", code: "871160", mappingType: "aggregate", description: c.limitations[0] }] : [],
      supportsCountryRole: type === "country_role", supportsBilateralFlow: type === "bilateral_flow", supportsProcessContext: type === "process_context", limitations: c.limitations
    }, locator: spec ? `${spec.path}; SHA-256=${spec.sha256}; ${spec.locator}` : `${electricBicycleContentPath}; SHA-256=${hash(contentBytes)}`, excerpt: null,
    notes: key === "trade" ? "HS871160 宽口径相关统计；不证明具体车型、最终消费或同批供应链。" : "仅支持所述范围；没有产能、物料量、厂商供货或逐批谱系。" });
    return id;
  }
  const allItems = c.items.map(row => row[0]);
  const curationId = addEvidence("evidence-ebike-curation", "curation", "curation_method", "2026-10", allItems);
  const nodes = c.nodes.map(([key, label, entityId, itemId, stage, alias, year, role, notes]) => {
    const id = `node-ebike-${key}`;
    const ev = addEvidence(`evidence-ebike-node-${key}`, alias, role ? "country_role" : "process_context", year, [itemId], [stage], entityId ? [entityId] : []);
    return { id, nodeType: entityId ? "entity" : "item", label, entityId, itemId, itemType: c.items.find(row => row[0] === itemId)[2], processStageId: stage,
      period: period(year), sourceIds: sourceIds(alias), evidenceIds: [ev, curationId], evidenceLevel: role ? "role_supported" : "representative", dataStatus: role ? "observed" : "unknown", notes, ...common };
  });
  const flows = c.flows.map(([key, from, to, itemId, stage, notes, alias]) => {
    const support = alias === "curation" ? [] : [addEvidence(`evidence-ebike-flow-${key}`, alias, "process_context", source(alias).period, [itemId], [stage])];
    return { id: `flow-ebike-${key}`, fromEntityId: `node-ebike-${from}`, toEntityId: `node-ebike-${to}`, itemId, processStageId: stage, relationType: "input", flowKind: "representative_supply",
      period: period("2026-10"), value: null, quantity: null, currency: null, unit: null, dataStatus: "unknown", valueDataStatus: "unknown", quantityDataStatus: "unknown", evidenceLevel: "representative", confidence: null,
      sourceIds: sourceIds(alias), evidenceIds: [curationId, ...support], notes, ...common };
  });
  const dictionary = JSON.parse(source("hs").bytes), hs = dictionary.results.find(row => row.id === "871160");
  assert(dictionary.classCode === "H6" && dictionary.className === "HS2022" && hs?.aggrlevel === 6 && hs.standardUnitAbbr === "u", "Unverified HS2022/871160 identity");
  assert(hs.text.includes("electric motor for propulsion"), "Unverified HS871160 broad scope");
  const quantityUnit = JSON.parse(source("units").bytes).results.find(row => row.qtyCode === 5);
  assert(quantityUnit?.qtyAbbr === "u" && quantityUnit.qtyDescription === "Number of items", "Unverified item quantity unit");
  const countriesText = source("country").bytes.toString("utf8");
  for (const [, , iso2, iso3, m49] of c.entities) assert(new RegExp(`<td>\\s*${m49}\\s*</td>\\s*<td>\\s*${iso2}\\s*</td>\\s*<td>\\s*${iso3}\\s*</td>`).test(countriesText), `UN M49 identity mismatch: ${iso3}`);
  const rawTrade = JSON.parse(source("trade").bytes), seen = new Set(), tradeObservations = [], rawRecordAudit = [];
  assert(!rawTrade.error && rawTrade.count === 3 && rawTrade.data.length === rawTrade.count, "Trade snapshot empty, erroneous or truncated");
  const partnerIds = new Map([[276, "country-de"], [702, "country-sg"]]);
  for (const [index, row] of rawTrade.data.entries()) {
    assert(row.reporterCode === 156 && row.period === "2024" && row.classificationCode === "H6" && row.cmdCode === "871160" && row.flowCode === "X" && [0, 276, 702].includes(row.partnerCode) && row.partner2Code === 0 && row.customsCode === "C00" && row.motCode === 0 && row.qtyUnitCode === 5, "Trade snapshot contains unreviewed scope");
    assert(!seen.has(row.partnerCode), "Duplicate trade scope"); seen.add(row.partnerCode);
    assert(Number.isFinite(row.primaryValue) && Number.isFinite(row.qty), "Published measurements must be finite");
    const id = `ebike-trade-X-${row.partnerCode}-2024`;
    const quality = Object.fromEntries(["isQtyEstimated", "isNetWgtEstimated", "isReported", "isAggregate", "legacyEstimationFlag"].map(key => [key, row[key] ?? null]));
    tradeObservations.push({ id, reporterEntityId: "country-cn", reporterCode: row.reporterCode, partnerEntityId: partnerIds.get(row.partnerCode) ?? null, partnerCode: row.partnerCode, partner2Code: row.partner2Code, partnerScope: row.partnerCode === 0 ? "world_total" : "entity", direction: "export", flowCode: row.flowCode,
      classificationSystem: "HS", classificationVersion: "2022", classificationCode: row.cmdCode, itemId: c.productId, period: period(row.period), value: row.primaryValue, quantity: row.qty, currency: "USD", unit: "items", statisticalConcept: "customs", sourceId: source("trade").source.id,
      method: "official", datasetVersionId: c.datasetVersionId, dataStatus: "observed", valueDataStatus: "observed", quantityDataStatus: row.isQtyEstimated ? "estimated" : "observed", quality,
      qualityNote: `HS871160 宽口径相关贸易，包含电动摩托车及脚踏车；原始数量为件，净重另保留在审计。世界总计与伙伴不相加；金额不是利润。${JSON.stringify({ netWgt: row.netWgt, netWgtUnit: "kg", fobvalue: row.fobvalue, cifvalue: row.cifvalue })}` });
    rawRecordAudit.push({ observationId: id, sourcePath: source("trade").path, dataIndex: index, rawRowSha256: hash(JSON.stringify(row)), original: row });
    if (row.partnerCode !== 0) {
      const destination = row.partnerCode === 276 ? "de" : "sg";
      const ev = addEvidence(`evidence-ebike-export-${destination}`, "trade", "trade_observation", "2024", [c.productId], ["export"], ["country-cn", partnerIds.get(row.partnerCode)]);
      flows.push({ id: `flow-ebike-export-${destination}`, fromEntityId: "node-ebike-cn-export", toEntityId: `node-ebike-${destination}-market`, itemId: c.productId, processStageId: "export", relationType: "trade", flowKind: "representative_supply", period: period("2024"), value: null, quantity: null, currency: null, unit: null, dataStatus: "unknown", valueDataStatus: "unknown", quantityDataStatus: "unknown", evidenceLevel: "representative", confidence: null,
        sourceIds: sourceIds("trade"), evidenceIds: [ev, curationId], notes: `以2024 中国→${destination === "de" ? "德国" : "新加坡"}的HS871160宽口径相关贸易观察作为出口方向背景；独立统计观察 ${id}。此代表连接不等于特定电动自行车出货，数值只保存在贸易统计中。`, ...common });
    }
  }
  assert(seen.size === 3 && seen.has(0), "World and both bilateral records are required");
  const manufacturingProcessChains = [], manufacturingProcessSteps = [], processRequirements = [], equipmentCategories = [];
  for (const chain of c.processChains) {
    const chainId = `process-chain-ebike-${chain.id}`;
    const ev = addEvidence(`evidence-ebike-process-${chain.id}`, chain.sourceKey, "process_context", chain.sourcePeriod, allItems);
    const metadata = { ...common, period: period(chain.sourcePeriod), sourceIds: sourceIds(chain.sourceKey), evidenceIds: [ev, curationId], dataStatus: chain.status };
    manufacturingProcessChains.push({ id: chainId, itemId: chain.item, title: chain.title, description: chain.description, limitations: c.limitations, ...metadata });
    chain.steps.forEach(([key, name, inputs, outputs, description, equipment, inputUses], order) => {
      const id = `process-ebike-${chain.id}-${key}`;
      manufacturingProcessSteps.push({ id, processChainId: chainId, order: order + 1, name, description, phase: chain.title, routeVariantIds: [], inputItemIds: inputs, outputItemIds: outputs, limitations: c.limitations, ...metadata });
      inputs.forEach((itemId, index) => {
        assert(inputUses?.[itemId], `Missing functional input description: ${id}/${itemId}`);
        processRequirements.push({ id: `${id}-input-${index}`, processStepId: id, requirementType: "material", equipmentCategoryId: null, itemId, name: c.items.find(row => row[0] === itemId)[1], necessity: "core", description: inputUses[itemId], limitations: c.limitations, ...metadata });
      });
      if (equipment) {
        const equipmentId = `equipment-ebike-${chain.id}-${key}`;
        equipmentCategories.push({ id: equipmentId, name: equipment, description: `用于${name}的设备类别。`, period: metadata.period, sourceIds: metadata.sourceIds, method: "curated", dataStatus: "observed", datasetVersionId: c.datasetVersionId });
        processRequirements.push({ id: `${id}-equipment`, processStepId: id, requirementType: "equipment", equipmentCategoryId: equipmentId, itemId: null, name: equipment, necessity: "core", description: `${equipment}用于完成${name}。`, limitations: c.limitations, ...metadata });
      }
    });
  }
  const sources = [...review.sourceSnapshots.map(spec => spec.source), curation];
  const fixture = { schemaVersion: "product-fixture.v1", productId: c.productId,
    datasetVersion: { id: c.datasetVersionId, name: "电动自行车：部件、总装与宽口径贸易", version: c.datasetVersion, publishedAt: c.reviewedAt, sourceIds: sources.map(s => s.id), coverage: null, status: "published", notes: "独立、可通过published loader读取的候选；是否可见由总manifest决定。2014电池结构、2022拟建工序、2024海关统计与2025回收指引期间分开。" },
    contentVersions: [{ id: c.contentVersionId, version: c.contentVersion, status: "published", publishedAt: c.reviewedAt, notes: c.limitations.join(" ") }], sources, evidence, evidenceGaps: [],
    entities: c.entities.map(([id, name, iso2, iso3, m49]) => ({ id, name, iso2, iso3, m49, kind: "country", parentId: null, sourceIds: [source("country").source.id], dataStatus: "observed", method: "official", datasetVersionId: c.datasetVersionId, validPeriod: period("2026-10") })),
    items: c.items.map(([id, name, itemType, parentItemId, category, description, key]) => ({ id, slug: id, name, itemType, parentItemId, category, description, sourceIds: sourceIds(key), method: "curated", dataStatus: "observed", datasetVersionId: c.datasetVersionId, validPeriod: period(source(key).period) })),
    processStages: c.stages.map(([id, label, description], order) => ({ id, code: id, label, order, description, sourceIds: [curation.id], method: "curated", dataStatus: "observed", datasetVersionId: c.datasetVersionId })),
    productionActivities: nodes.filter(n => ["node-ebike-cn-cell", "node-ebike-cn-pack", "node-ebike-cn-assembly"].includes(n.id)).map(n => ({ id: `activity-${n.id}`, locationEntityId: n.entityId, processStageId: n.processStageId, inputItemIds: unique(flows.filter(f => f.toEntityId === n.id).map(f => f.itemId)), outputItemIds: [n.itemId], period: n.period, sourceIds: n.sourceIds, evidenceIds: n.evidenceIds, evidenceLevel: n.evidenceLevel, dataStatus: n.dataStatus, notes: n.notes, ...common })),
    classificationCodes: [{ id: "hs-2022-871160", system: "HS", version: "2022", code: "871160", level: 6, label: hs.text, validPeriod: period("2024"), sourceIds: [source("hs").source.id], method: "official", dataStatus: "observed", datasetVersionId: c.datasetVersionId }],
    classificationCrosswalks: [{ id: "crosswalk-ebike-hs871160", itemId: c.productId, classificationCodeId: "hs-2022-871160", mappingType: "aggregate", confidence: null, notes: "电动自行车内容关联范围更宽的HS871160；此分类不是车型或中国国内新国标定义。", limitation: c.limitations[0], period: period("2024"), sourceIds: sourceIds("hs"), method: "curated", dataStatus: "observed", datasetVersionId: c.datasetVersionId }],
    storyGraph: { productId: c.productId, period: { granularity: "annual", start: "2014-01-01", end: "2026-10-31", label: "2014—2026（多期来源，非连续年度统计）" }, method: "curated", representativeStatement: "从电池和车架、电机、电控等部件认识整车；国家角色、代表结构和宽口径出口观察分别阅读。", methodology: review.reviewDecisions, limitations: c.limitations, nodes, flows,
      steps: c.storySteps.map(([id, title, description, nodeIds, flowIds], order) => ({ id: `step-ebike-${id}`, order: order + 1, title, description, nodeIds: nodeIds.map(id => `node-ebike-${id}`), flowIds: flowIds.map(id => `flow-ebike-${id}`), evidenceIds: [curationId], method: "curated", contentStatus: "published", contentVersionId: c.contentVersionId })), datasetVersionId: c.datasetVersionId, contentVersionId: c.contentVersionId, warnings: ["历史电池与工艺资料不证明当前工厂、产能或同批货物；所有无公开量的结构连接保持未知。"] },
    tradeObservations, materialTradeObservations: [], macroIndicators: [], indicatorDefinitions: [], manufacturingProcessChains, manufacturingProcessSteps, manufacturingRouteVariants: [], processRequirements, equipmentCategories, organizations: [], facilities: [], organizationCapabilities: [], tradeGuides: [], tariffMeasures: [], tradeRequirements: [], tradeProcedures: [], tradeProcedureSteps: [], tradeDocumentRequirements: [], policyDocuments: [], missingDataNotes: c.limitations, warnings: ["仅有中国2024年出口切片；德国和新加坡没有完整报告方账本，进口与余额未知。"] };
  const audit = { schemaVersion: "electric-bicycle-review.v1", batchId: c.batchId, reviewedAt: c.reviewedAt, datasetVersion: c.datasetVersion,
    inputs: { content: { path: electricBicycleContentPath, sha256: hash(contentBytes) }, sourceReview: { path: electricBicycleReviewPath, sha256: hash(reviewBytes) }, rawManifest: review.rawManifest, snapshots: review.sourceSnapshots.map(({ alias, path, sha256, reviewedTerms, locator }) => ({ alias, path, sha256, reviewedTerms, locator })), allResearchOriginals: rawManifest.sources.map(({ file, sha256 }) => ({ path: `data/raw/ebike-research/${file}`, sha256 })) },
    classification: { classCode: dictionary.classCode, className: dictionary.className, original: hs, mappingType: "aggregate" }, quantityUnit, rawRecords: rawRecordAudit,
    counts: { items: fixture.items.length, nodes: nodes.length, flows: flows.length, processSteps: manufacturingProcessSteps.length, equipment: equipmentCategories.length, trade: tradeObservations.length, worldTotals: tradeObservations.filter(r => r.partnerScope === "world_total").length, bilateralTrade: tradeObservations.filter(r => r.partnerScope === "entity").length },
    validation: { offline: true, activeManifestChanged: false, sourceHashesVerified: true, absentUSRecordIsZero: false, processFileScope: "planned project, not observed operations", publication: "candidate only; no active-manifest mutation" }, limitations: c.limitations };
  const fixtureText = json(fixture), auditText = json(audit);
  const manifest = { schemaVersion: "fixture-manifest.v1", fixtures: [{ productId: c.productId, path: "fixture.json", datasetVersion: c.datasetVersion, fixtureSha256: hash(fixtureText) }], datasetVersion: c.datasetVersion, generatedAt: c.reviewedAt, fixtureSha256: hash(fixtureText), notes: [fixture.datasetVersion.notes], release: { productId: c.productId, datasetVersion: c.datasetVersion, releasePath: `releases/${c.productId}/${c.datasetVersion}`, immutable: true },
    evidenceReview: { batchId: c.batchId, contentSource: electricBicycleContentPath, contentPathBase: "repository-root", contentSha256: hash(contentBytes), sourceReview: electricBicycleReviewPath, sourceReviewSha256: hash(reviewBytes), auditPath: "review-audit.json", auditPathBase: "release-directory", auditSha256: hash(auditText) } };
  return { config: c, fixture, audit, manifest, files: { "fixture.json": fixtureText, "manifest.json": json(manifest), "review-audit.json": auditText } };
}

async function writeImmutable(path, bytes) {
  await mkdir(dirname(path), { recursive: true });
  try { await writeFile(path, bytes, { flag: "wx" }); }
  catch (error) { if (error.code !== "EEXIST") throw error; assert(await readFile(path, "utf8") === bytes, `Immutable output differs: ${path}`); }
}

async function main() {
  const args = process.argv.slice(2);
  assert(args.every(arg => arg === "--prepare-release"), "Usage: node scripts/build-electric-bicycle.mjs [--prepare-release]");
  const result = await buildElectricBicycle();
  if (args.includes("--prepare-release")) {
    const check = spawnSync(process.execPath, [resolve(root, "node_modules/vitest/vitest.mjs"), "run", "tests/electric-bicycle-release.test.ts"], { cwd: root, stdio: "inherit" });
    assert(check.status === 0, "Electric bicycle contracts and domain regression tests must pass before release preparation");
  }
  const output = args.includes("--prepare-release") ? `data/published/releases/${result.config.productId}/${result.config.datasetVersion}` : `data/candidates/${result.config.batchId}`;
  for (const [name, bytes] of Object.entries(result.files)) await writeImmutable(resolve(root, output, name), bytes);
  console.log(json({ status: "prepared-not-activated", output, fixtureSha256: result.manifest.fixtureSha256, ...result.audit.counts, activeManifestChanged: false }));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
