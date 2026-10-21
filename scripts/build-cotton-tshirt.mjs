import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const cottonContentPath = "content/products/generic-cotton-tshirt-2026.json";
export const cottonReviewPath = "content/reviews/cotton-tshirt-2026-10-21.json";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const jsonText = (value) => `${JSON.stringify(value, null, 2)}\n`;
const unique = (values) => [...new Set(values)];
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const annual = (year) => ({ granularity: "annual", start: `${year}-01-01`, end: `${year}-12-31`, label: String(year) });

async function readPinned(root, path, expected) {
  const absolute = resolve(root, path);
  const child = relative(root, absolute);
  assert(!isAbsolute(child) && !child.startsWith("..") && child.length > 0, `Unsafe input path: ${path}`);
  const bytes = await readFile(absolute);
  assert(sha256(bytes) === expected, `Reviewed source hash changed: ${path}`);
  return bytes;
}

/** Pure, offline construction from reviewed content and SHA-pinned snapshots. */
export async function buildCottonTshirt(root = repositoryRoot) {
  const contentBytes = await readFile(resolve(root, cottonContentPath));
  const reviewBytes = await readFile(resolve(root, cottonReviewPath));
  const config = JSON.parse(contentBytes);
  const review = JSON.parse(reviewBytes);
  assert(config.productId === "generic-cotton-tshirt" && config.datasetVersion === "globe-chain-cotton-tshirt-2026.1", "Cotton release identity changed without a new review");
  const snapshots = new Map();
  for (const spec of review.sourceSnapshots) snapshots.set(spec.alias, { ...spec, bytes: await readPinned(root, spec.path, spec.sha256) });
  const snapshot = (alias) => { const result = snapshots.get(alias); assert(result, `Unknown source alias: ${alias}`); return result; };
  const sourceId = (alias) => snapshot(alias).source.id;
  const version = config.datasetVersionId;
  const contentVersion = config.contentVersionId;
  const periods = config.periods;
  const period = (key) => { assert(periods[key], `Unknown period: ${key}`); return periods[key]; };
  const metadata = (aliases, periodKey = "curation") => ({ period: period(periodKey), sourceIds: unique(aliases.map(sourceId)), method: "curated", dataStatus: "observed", datasetVersionId: version, contentVersionId: contentVersion });

  const hsDictionary = JSON.parse(snapshot("hs").bytes);
  const hs = hsDictionary.results.find(row => row.id === "610910");
  assert(hsDictionary.classCode === "H6" && hsDictionary.className === "HS2022" && hs?.aggrlevel === 6 && hs.standardUnitAbbr === "u", "HS2022/610910 dictionary identity changed");
  assert(hs.text.includes("T-shirts, singlets and other vests"), "HS610910 aggregate scope changed");
  const quantityUnits = JSON.parse(snapshot("units").bytes).results;
  const unit = quantityUnits.find(row => row.qtyCode === 5);
  assert(unit?.qtyAbbr === "u" && unit.qtyDescription === "Number of items", "Quantity code 5 must be verified as number of items");
  const m49Html = snapshot("country").bytes.toString("utf8");
  for (const country of config.countries) {
    const escapedName = country.sourceName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert(new RegExp(`<td>\\s*${escapedName}\\s*</td>\\s*<td>\\s*${country.m49}\\s*</td>\\s*<td>\\s*${country.iso2}\\s*</td>\\s*<td>\\s*${country.iso3}\\s*</td>`).test(m49Html), `UN M49 mapping not found: ${country.id}`);
  }

  const curationSource = {
    id: "source-cotton-curation", name: "棉 T 恤路线与工艺编目", publisher: "GlobeChain",
    url: null, license: "项目自行整理的内容；原始资料条款分别适用。", publishedAt: config.reviewedAt, retrievedAt: config.reviewedAt,
    datasetVersion: config.contentVersion, notes: `${cottonContentPath}; SHA-256 ${sha256(contentBytes)}。所有连续物料路线均需按单条证据等级阅读。`
  };
  const evidence = [];
  const evidenceByKey = new Map();
  const allItemIds = [config.productId, ...config.items.map(row => row[0])];
  const addEvidence = (key, alias, supportType, scope, locator, notes) => {
    const record = {
      id: `evidence-cotton-${key}`, sourceId: alias === "curation" ? curationSource.id : sourceId(alias), supportType,
      scope: { entityIds: [], fromEntityId: null, toEntityId: null, itemIds: [], processStageIds: [], processStepIds: [], equipmentCategoryIds: [], organizationIds: [], classificationCodes: [], direction: null, period: null, scopeDescription: notes, supportsCountryRole: false, supportsBilateralFlow: false, supportsProcessContext: false, supportsManufacturerCapability: false, supportsCommercialRelationship: false, supportsPolicyGuidance: false, limitations: config.limitations, ...scope },
      locator: alias === "curation" ? `${cottonContentPath}; SHA-256=${sha256(contentBytes)}; ${locator}` : `${snapshot(alias).path}; SHA-256=${snapshot(alias).sha256}; ${locator}`,
      excerpt: null, notes
    };
    evidence.push(record); evidenceByKey.set(key, record); return record;
  };
  const role = (key, alias, entityId, itemIds, stageIds, periodKey, locator, notes) => addEvidence(key, alias, "country_role", { entityIds: [entityId], itemIds, processStageIds: stageIds, period: period(periodKey), supportsCountryRole: true }, locator, notes);
  role("cn-cotton", "cn", "country-cn", ["seed-cotton", "cotton-lint"], ["cotton-growing", "cotton-ginning"], "cnRole", "PDF p.2: Executive Summary", "报告所述中国棉花生产及已分级、轧花棉花的行业角色；不发布预测产量，也不建立棉花到 T 恤的谱系。");
  role("cn-yarn", "cn", "country-cn", ["cotton-yarn"], ["cotton-spinning"], "cnRole", "PDF p.2: yarn-spinning and textile industry", "报告所述中国棉纺行业角色；未识别工厂、客户或订单。");
  role("br-role", "bd", "country-br", ["cotton-lint"], ["cotton-sourcing"], "cottonMY", "PDF p.15: MY 2024/25 Brazil supplier paragraph", "巴西是孟加拉该市场年的皮棉来源；不扩展为巴西 T 恤成品产地。");
  for (const [key, item, stage, pages] of [["bd-lint", "cotton-lint", "cotton-sourcing", "pp.7,9"], ["bd-yarn", "cotton-yarn", "cotton-spinning", "p.9"], ["bd-knit", "cotton-greige-knit", "cotton-knitting", "pp.7,9"], ["bd-finish", "cotton-finished-knit", "cotton-dye-finishing", "pp.7,9"]]) {
    role(key, "bd", "country-bd", [item], [stage], "bdRole", `PDF ${pages}: textile / backward linkage industry`, "2026 年报告所述孟加拉棉纺、针织或染整配套角色；是行业背景，不对应指定 T 恤、工厂或批次。");
  }
  role("in-yarn", "bd", "country-in", ["cotton-yarn"], ["cotton-spinning"], "cottonMY", "PDF p.17: MY 2024/25 cotton yarn imports", "印度是孟加拉 MY2024/25 的棉纱来源；棉纱总体口径不限定纱支、品类或具体服装用途。");
  addEvidence("in-context", "in", "process_context", { entityIds: ["country-in"], itemIds: ["cotton-yarn"], processStageIds: ["cotton-spinning"], supportsProcessContext: true, period: { granularity: "annual", start: "2025-08-01", end: "2025-12-31", label: "MY 2025/26（2025 年 8–12 月）" } }, "PDF p.8: Consumption; cotton yarn export destinations", "印度报告补充棉纱出口和孟加拉目的地背景；这是独立的部分市场年内容，不与 MY2024/25 数值合并。");
  addEvidence("us-partner", "comtrade", "trade_observation", { entityIds: ["country-cn", "country-us"], itemIds: [config.productId], period: period("trade2025"), supportsCountryRole: true, classificationCodes: [{ system: "HS", version: "2022", code: "610910", mappingType: "aggregate", description: hs.text }] }, "data[partnerCode=842,flowCode=X or M]; reporterCode=156; period=2025", "中国报告的美国伙伴记录支持贸易伙伴角色，HS 聚合分类不支持最终消费、成衣工厂或同批原料路线。");
  for (const [key, from, item, stage, locator] of [["br-bd-lint", "country-br", "cotton-lint", "cotton-sourcing", "PDF p.15: Brazil cotton supplier in MY2024/25"], ["in-bd-yarn", "country-in", "cotton-yarn", "cotton-spinning", "PDF p.17: Indian cotton yarn imports in MY2024/25"]]) {
    addEvidence(key, "bd", "bilateral_flow", { entityIds: [from, "country-bd"], fromEntityId: from, toEntityId: "country-bd", itemIds: [item], processStageIds: [stage], direction: "export", period: period("cottonMY"), supportsBilateralFlow: true }, locator, "原文直接支持供货国、孟加拉目的地、货物和市场年；只登记定性双边关系，不把报告的广义市场份额转成 T 恤投入量。");
  }
  for (const [key, periodKey, countryIds] of [["cn-curation", "cnRole", ["country-cn", "country-us"]], ["bd-curation", "bdRole", ["country-br", "country-in", "country-bd"]]]) {
    addEvidence(key, "curation", "curation_method", { entityIds: countryIds, itemIds: allItemIds, processStageIds: config.stages.map(row => row[0]), period: period(periodKey) }, "representativeStatement; methodology; nodes / flows / branches", "按产业角色与通用工艺组织代表性节点和连接；没有同一批原料连续贯穿的证据，金额、数量和份额保持未知。");
  }

  const stepId = (key) => `cotton-step-${key}`;
  const equipmentId = (key) => `cotton-equipment-${key}`;
  const processAliases = unique(config.process.steps.map(row => row[5]));
  for (const alias of processAliases) {
    addEvidence(`process-${alias}`, alias, "process_context", { itemIds: allItemIds, processStepIds: config.process.steps.filter(row => row[5] === alias).map(row => stepId(row[0])), equipmentCategoryIds: config.process.equipment.filter(row => row[2] === alias).map(row => equipmentId(row[0])), period: period("curation"), supportsProcessContext: true }, alias === "garment" ? "T-Shirt Construction; Markers, Spreading & Cutting; Garment Components" : `CottonWorks article section: ${snapshot(alias).source.name}`, "工艺一手说明支持通用输入输出与设备类别；网页没有统一发布期间，2026 为内容编目时间，不证明具体国家、厂商或订单使用。");
  }
  const evidenceFor = (keys) => unique(keys).map(key => { const entry = evidenceByKey.get(key); assert(entry, `Unknown evidence key: ${key}`); return entry; });
  const provenance = (keys, aliases = []) => ({ evidenceIds: evidenceFor(keys).map(entry => entry.id), sourceIds: unique([...evidenceFor(keys).map(entry => entry.sourceId), ...aliases.map(sourceId)]) });
  const curatedSourceAliases = { "cn-curation": ["cn"], "bd-curation": ["bd"] };
  const stageAlias = new Map(config.stages.map(row => [row[0], row[2]]));
  const nodes = config.nodes.map(([id, label, entityId, itemId, processStageId, periodKey, evidenceKey, evidenceLevel, notes]) => {
    const processKey = `process-${stageAlias.get(processStageId)}`;
    const keys = [evidenceKey, ...(evidenceLevel === "representative" && evidenceByKey.has(processKey) ? [processKey] : []), ...(id === "cotton-in-yarn" ? ["in-context"] : [])];
    return { id, nodeType: processStageId === "cotton-trade-market" ? "market" : "process", label, entityId, itemId, itemType: itemId === config.productId ? "final_product" : config.items.find(row => row[0] === itemId)[2], processStageId, period: period(periodKey), ...provenance(keys, curatedSourceAliases[evidenceKey] ?? []), evidenceLevel, method: "curated", dataStatus: "observed", datasetVersionId: version, contentVersionId: contentVersion, notes };
  });
  const flows = config.flows.map(([id, fromEntityId, toEntityId, itemId, processStageId, periodKey, evidenceKey, evidenceLevel, relationType, notes]) => ({
    id, fromEntityId, toEntityId, itemId, processStageId, relationType, flowKind: evidenceLevel === "bilateral_supported" ? "curated_physical" : "representative_supply", period: period(periodKey), value: null, quantity: null, currency: null, unit: null,
    ...provenance([evidenceKey], curatedSourceAliases[evidenceKey] ?? []), evidenceLevel, confidence: null, method: "curated", dataStatus: "unknown", valueDataStatus: "unknown", quantityDataStatus: "unknown", datasetVersionId: version, contentVersionId: contentVersion, notes
  }));
  const processSteps = config.process.steps.map(([key, name, phase, inputItemIds, outputItemIds, alias, description], order) => ({
    id: stepId(key), processChainId: config.process.id, order: order + 1, name, description, phase, routeVariantIds: config.process.variants.filter(variant => variant.stepKeys.includes(key)).map(variant => variant.id), inputItemIds, outputItemIds,
    ...metadata([alias]), ...provenance([`process-${alias}`]), limitations: ["通用工艺说明，不代表某一批货物、工厂安装或商业供货关系。"]
  }));
  const requirements = config.process.steps.flatMap(([key, , , inputIds, , alias, , equipment]) => [
    ...inputIds.map((itemId, index) => ({ id: `cotton-requirement-${key}-input-${index + 1}`, processStepId: stepId(key), requirementType: "material", equipmentCategoryId: null, itemId, name: itemId === config.productId ? config.productName : config.items.find(row => row[0] === itemId)[1], necessity: "core", description: "该代表工序的材料输入；用量和损耗未知。", ...metadata([alias]), ...provenance([`process-${alias}`]), limitations: ["不由输入输出关系推算数量、成本或配比。"] })),
    ...(equipment ? [{ id: `cotton-requirement-${key}-equipment`, processStepId: stepId(key), requirementType: "equipment", equipmentCategoryId: equipmentId(equipment), itemId: null, name: config.process.equipment.find(row => row[0] === equipment)[1], necessity: "core", description: "通用设备类别，不指定厂商或型号。", ...metadata([alias]), ...provenance([`process-${alias}`]), limitations: ["没有厂商能力或已向某客户供货的证据。"] }] : [])
  ]);

  const tradeObservations = [];
  const tradeRowsAudit = [];
  for (const input of review.tradeInputs) {
    const raw = JSON.parse(snapshot(input.alias).bytes);
    assert(raw.error === "" && raw.count === input.expectedCount && raw.data.length === input.expectedCount && raw.data.length < input.previewLimit, "Trade response count / cap changed");
    const keys = new Set();
    for (const row of raw.data) {
      assert(row.reporterCode === input.reporterCode && String(row.period) === input.period && row.refYear === Number(input.period) && row.classificationCode === input.classificationCode && row.cmdCode === input.commodityCode && input.partners.includes(row.partnerCode) && input.flows.includes(row.flowCode) && row.partner2Code === 0 && row.motCode === 0 && row.customsCode === "C00", "Unexpected trade scope");
      assert(row.qtyUnitCode === 5 && row.qty >= 0 && row.primaryValue >= 0 && Number.isFinite(row.primaryValue) && Number.isFinite(row.qty), "Invalid trade amount / quantity / unit");
      assert(row.isOriginalClassification === true && typeof row.isQtyEstimated === "boolean" && typeof row.isNetWgtEstimated === "boolean", "Source classification / quality flags are missing");
      const key = `${row.reporterCode}-${row.partnerCode}-${row.flowCode}-${row.period}`;
      assert(!keys.has(key), "Duplicate trade response dimensions"); keys.add(key);
      const id = `cotton-trade-${key}`;
      const quality = { legacyEstimationFlag: row.legacyEstimationFlag, isQtyEstimated: row.isQtyEstimated, isNetWgtEstimated: row.isNetWgtEstimated, isReported: row.isReported, isAggregate: row.isAggregate, sourceDatasetCode: row.classificationCode, sourcePublicationDate: null, sourceRevision: null };
      const original = { classificationCode: row.classificationCode, isOriginalClassification: row.isOriginalClassification, qtyUnitCode: row.qtyUnitCode, qtyUnitAbbr: row.qtyUnitAbbr, netWgt: row.netWgt, isNetWgtEstimated: row.isNetWgtEstimated, cifvalue: row.cifvalue, fobvalue: row.fobvalue, partner2Code: row.partner2Code, motCode: row.motCode, customsCode: row.customsCode };
      tradeObservations.push({ id, reporterEntityId: "country-cn", reporterCode: row.reporterCode, partnerEntityId: row.partnerCode === 0 ? null : "country-us", partnerCode: row.partnerCode, partner2Code: row.partner2Code, flowCode: row.flowCode, partnerScope: row.partnerCode === 0 ? "world_total" : "entity", direction: row.flowCode === "M" ? "import" : "export", classificationSystem: "HS", classificationVersion: "2022", classificationCode: row.cmdCode, itemId: config.productId, period: annual(row.refYear), value: row.primaryValue, quantity: row.qty, currency: "USD", unit: "items", statisticalConcept: "customs", sourceId: sourceId(input.alias), datasetVersionId: version, method: "official", dataStatus: "observed", valueDataStatus: "observed", quantityDataStatus: row.isQtyEstimated ? "estimated" : "observed", quality, qualityNote: `HS610910 为棉制服装聚合范围，不是某款 T 恤。金额为现价美元；${row.flowCode === "M" ? "进口 CIF" : "出口 FOB"}。数量码 5 经官方字典转为 items；净重另存且状态独立。${row.isAggregate ? "世界记录保留原始汇总/非逐条报告标志，不能据此将缺失数量当零。" : "具体伙伴观察，不等于最终消费。"} raw=${snapshot(input.alias).path}; sha256=${snapshot(input.alias).sha256}; original=${JSON.stringify(original)}` });
      addEvidence(`trade-${key}`, input.alias, "trade_observation", { entityIds: ["country-cn", ...(row.partnerCode ? ["country-us"] : [])], itemIds: [config.productId], classificationCodes: [{ system: "HS", version: "2022", code: "610910", mappingType: "aggregate", description: hs.text }], direction: row.flowCode === "M" ? "import" : "export", period: annual(row.refYear) }, `data[reporterCode=${row.reporterCode},partnerCode=${row.partnerCode},flowCode=${row.flowCode},period=${row.period}]`, "海关观察支持本条分类、报告方、伙伴、方向和期间；不将聚合服装分类解释为某件 T 恤或原料谱系。");
      tradeRowsAudit.push({ id, rawSnapshot: snapshot(input.alias).path, rawSha256: snapshot(input.alias).sha256, reporterCode: row.reporterCode, partnerCode: row.partnerCode, flowCode: row.flowCode, period: row.period, primaryValue: row.primaryValue, qty: row.qty, unitCode: row.qtyUnitCode, normalizedUnit: "items", netWgt: row.netWgt, original, quality });
    }
  }
  for (const empty of review.emptyTradeResponses) {
    const payload = JSON.parse(await readPinned(root, empty.path, empty.sha256));
    assert(payload.count === 0 && payload.data.length === 0, "Reviewed empty trade response changed");
  }

  const macroIndicators = [];
  const indicatorDefinitions = [];
  for (const [alias, sourceCode, indicator, label, concept] of [
    ["wdi-exports", "TX.VAL.MRCH.CD.WT", "merchandise_exports_current_usd", "商品出口总额", "customs"],
    ["wdi-imports", "TM.VAL.MRCH.CD.WT", "merchandise_imports_current_usd", "商品进口总额", "customs"],
    ["wdi-reserves", "FI.RES.TOTL.CD", "official_reserves_including_gold_current_usd", "官方储备总额（含黄金）", "official_reserve"]
  ]) {
    const envelope = JSON.parse(snapshot(alias).bytes);
    assert(envelope.httpStatus === 200 && sha256(envelope.body) === envelope.sha256, "Shared macro raw payload hash changed");
    const [meta, rows] = JSON.parse(envelope.body);
    assert(meta.lastupdated === "2026-07-13" && meta.pages === 1, "Reviewed WDI release changed");
    for (const row of rows.filter(row => ["CHN", "USA"].includes(row.countryiso3code))) {
      assert(row.indicator.id === sourceCode && ["2024", "2025"].includes(row.date) && Number.isFinite(row.value), "Invalid shared macro observation");
      macroIndicators.push({ id: `cotton-macro-${row.countryiso3code}-${sourceCode}-${row.date}`, entityId: row.countryiso3code === "CHN" ? "country-cn" : "country-us", indicator, period: annual(row.date), value: row.value, quantity: null, currency: "USD", unit: "current USD", statisticalConcept: concept, sourceId: sourceId(alias), datasetVersionId: version, method: "official", dataStatus: row.obs_status === "E" ? "estimated" : "observed", notes: `通用国家宏观指标，不是棉 T 恤金额；原始 WDI ${sourceCode}, ${row.date}, source release ${meta.lastupdated}; ${snapshot(alias).path}; sha256=${snapshot(alias).sha256}。` });
    }
    indicatorDefinitions.push({ id: `cotton-indicator-${indicator}`, indicator, label, shortLabel: label, description: label === "官方储备总额（含黄金）" ? "国家官方储备背景指标（含黄金），不属于本商品贸易收入。" : "国家所有商品的货物贸易背景指标，不属于棉 T 恤贸易。", category: concept === "official_reserve" ? "官方储备" : "国家商品贸易", displayOrder: indicatorDefinitions.length + 1, displayUnit: "current USD", displayCurrency: "USD", valueMeaning: "国家宏观背景，独立于商品观察。", sourceIndicatorCode: sourceCode, statisticalConcept: concept, formula: null, period: null, sourceIds: [sourceId(alias)], method: "official", dataStatus: "observed", datasetVersionId: version });
  }
  const sources = [...review.sourceSnapshots.map(spec => spec.source), curationSource];
  const fixture = {
    schemaVersion: "product-fixture.v1", productId: config.productId,
    datasetVersion: { id: version, name: "棉质针织 T 恤：原料、工艺与贸易", version: config.datasetVersion, publishedAt: config.reviewedAt, sourceIds: sources.map(source => source.id), coverage: null, status: "published", notes: "2026-10-21 整理；代表结构、国家角色和海关统计分开。仅准备独立不可变 release，是否激活由总 manifest 决定。" },
    contentVersions: [{ id: contentVersion, version: config.contentVersion, status: "published", publishedAt: config.reviewedAt, notes: config.limitations.join(" ") }],
    sources, evidence, evidenceGaps: [],
    entities: config.countries.map(({ sourceName, ...country }) => ({ ...country, kind: "country", parentId: null, sourceIds: [sourceId("country")], dataStatus: "observed", method: "official", datasetVersionId: version, validPeriod: period("curation") })),
    items: [{ id: config.productId, slug: config.productId, name: config.productName, itemType: "final_product", parentItemId: null, category: "纺织品", description: config.description, ...metadata(["garment", "hs"]), validPeriod: period("curation") }, ...config.items.map(([id, name, itemType, parentItemId, alias, description]) => ({ id, slug: id, name, itemType, parentItemId, category: ["cotton-plant", "seed-cotton", "cotton-lint", "cotton-seed-byproduct"].includes(id) ? "农产品" : "纺织品", description, sourceIds: [sourceId(alias)], dataStatus: "observed", method: "curated", datasetVersionId: version, validPeriod: period("curation") }))],
    processStages: config.stages.map(([id, label, alias], index) => ({ id, code: id, label, order: index + 1, description: `${label}；范围见节点和工艺证据。`, sourceIds: [sourceId(alias)], dataStatus: "observed", method: "curated", datasetVersionId: version })),
    productionActivities: nodes.filter(node => !["cotton-sourcing", "cotton-trade-market"].includes(node.processStageId)).map(node => ({ id: `activity-${node.id}`, locationEntityId: node.entityId, processStageId: node.processStageId, inputItemIds: unique(flows.filter(flow => flow.toEntityId === node.id && flow.relationType !== "trade").map(flow => flow.itemId)), outputItemIds: [node.itemId], period: node.period, sourceIds: node.sourceIds, evidenceIds: node.evidenceIds, evidenceLevel: node.evidenceLevel, method: node.method, dataStatus: node.dataStatus, datasetVersionId: version, contentVersionId: contentVersion, notes: node.notes })),
    classificationCodes: [{ id: "cotton-classification-hs2022-610910", system: "HS", version: "2022", code: hs.id, level: hs.aggrlevel, label: hs.text.replace(/^610910 - /, ""), validPeriod: { granularity: "annual", start: "2022-01-01", end: "2026-12-31", label: "HS2022 · 本批适用 2025 年观察" }, sourceIds: [sourceId("hs")], dataStatus: "observed", method: "official", datasetVersionId: version }],
    classificationCrosswalks: [{ id: "cotton-crosswalk-tshirt-hs610910", itemId: config.productId, classificationCodeId: "cotton-classification-hs2022-610910", mappingType: "aggregate", confidence: null, notes: "以棉质针织 T 恤为内容对象，统计范围更广。", limitation: config.limitations[0], period: period("trade2025"), sourceIds: [sourceId("hs"), curationSource.id], method: "curated", dataStatus: "observed", datasetVersionId: version }],
    storyGraph: { productId: config.productId, period: period("story"), method: "curated", representativeStatement: config.representativeStatement, methodology: config.methodology, limitations: config.limitations, nodes, flows, steps: config.branches.map((branch, index) => ({ id: branch.id, order: index + 1, title: branch.title, description: branch.description, nodeIds: branch.nodeIds, flowIds: branch.flowIds, evidenceIds: evidenceFor(branch.evidenceKeys).map(entry => entry.id), method: "curated", contentStatus: "published", contentVersionId: contentVersion })), datasetVersionId: version, contentVersionId: contentVersion, warnings: [] },
    tradeObservations, materialTradeObservations: [], macroIndicators, indicatorDefinitions,
    organizations: [], facilities: [],
    manufacturingProcessChains: [{ id: config.process.id, itemId: config.process.itemId, title: config.process.title, description: config.process.description, ...metadata(processAliases), ...provenance(processAliases.map(alias => `process-${alias}`)), limitations: config.limitations.slice(2) }],
    manufacturingRouteVariants: config.process.variants.map(variant => ({ id: variant.id, processChainId: config.process.id, name: variant.name, description: variant.description, stepIds: variant.stepKeys.map(stepId), applicability: variant.applicability, ...metadata(processAliases), ...provenance(processAliases.map(alias => `process-${alias}`)), limitations: ["可选工艺结构，没有指定工厂、纱支、配方或订单。", "该工艺分支与国家路线分支分别组织，不证明某国使用了这一整套设备。"] })),
    manufacturingProcessSteps: processSteps,
    equipmentCategories: config.process.equipment.map(([key, name, alias]) => ({ id: equipmentId(key), name, description: `${name}的通用类别，不指定型号、产能或供应商。`, ...metadata([alias]) })),
    processRequirements: requirements, organizationCapabilities: [],
    tradeGuides: [], tariffMeasures: [], tradeRequirements: [], tradeProcedures: [], tradeProcedureSteps: [], tradeDocumentRequirements: [], policyDocuments: [],
    missingDataNotes: ["印度与孟加拉的 HS610910 请求未返回匹配记录；不代表零贸易。", "没有指定 T 恤的单件用料、材料重量、成本、利润或厂商供货关系。", "本商品未发布税率、许可或贸易手续资料。"], warnings: []
  };
  const audit = {
    schemaVersion: "cotton-tshirt-release-audit.v1", batchId: config.batchId, reviewedAt: config.reviewedAt, productId: config.productId, datasetVersion: config.datasetVersion, contentVersion: config.contentVersion,
    inputs: { content: { path: cottonContentPath, sha256: sha256(contentBytes) }, review: { path: cottonReviewPath, sha256: sha256(reviewBytes) }, snapshots: review.sourceSnapshots.map(({ alias, path, sha256: hash }) => ({ alias, path, sha256: hash })) },
    transformations: ["核对 H6=HS2022，610910 为聚合服装分类；保留 aggregate crosswalk。", "通过官方数量字典将 qtyUnitCode=5 转为 items；netWgt 仅保存在审计和质量说明，不覆盖 qty。", "逐条提取原始 primaryValue/qty 与质量标志；不相加世界总计和伙伴记录，不为无记录的国家造零。", "按已审核内容建立三组代表分支、两种纺纱路线及明确输入输出；所有路线数值未知且为 null。", "复用 WDI 通用原文中中国与美国 2024/2025 宏观背景，保留原来源版本，不读取任何手机贸易。"],
    classification: { classCode: hsDictionary.classCode, className: hsDictionary.className, selectedEntry: hs, mappingType: "aggregate" }, quantityUnit: unit,
    tradeRows: tradeRowsAudit, emptyTradeResponses: review.emptyTradeResponses,
    counts: { items: fixture.items.length, countries: fixture.entities.length, storyNodes: nodes.length, storyFlows: flows.length, representativeBranches: config.branches.length, directlySupportedMaterialRelations: flows.filter(flow => flow.evidenceLevel === "bilateral_supported").length, tradeObservations: tradeObservations.length, worldTotals: tradeObservations.filter(row => row.partnerScope === "world_total").length, bilateralStatistics: tradeObservations.filter(row => row.partnerScope === "entity").length, macroIndicators: macroIndicators.length, manufacturingSteps: processSteps.length, manufacturingVariants: config.process.variants.length, equipmentCategories: fixture.equipmentCategories.length, organizations: 0 },
    validation: { pinnedSourceHashes: "passed", sharedWdiBodyHashes: "passed", officialCountryMappings: "passed", classificationDictionary: "passed", quantityDictionary: "passed", tradeScopeAndUniqueDimensions: "passed", previewLimitNotReached: true, emptyResponsesCreateNoFacts: true, activeManifestChanged: false },
    limitations: config.limitations
  };
  const fixtureBytes = jsonText(fixture);
  const auditBytes = jsonText(audit);
  const manifest = { schemaVersion: "fixture-manifest.v1", fixtures: [{ productId: config.productId, path: "fixture.json" }], datasetVersion: config.datasetVersion, generatedAt: config.reviewedAt, fixtureSha256: sha256(fixtureBytes), release: { productId: config.productId, datasetVersion: config.datasetVersion, releasePath: `releases/${config.productId}/${config.datasetVersion}`, immutable: true }, evidenceReview: { batchId: config.batchId, contentSource: cottonContentPath, contentPathBase: "repository-root", contentSha256: sha256(contentBytes), sourceReview: cottonReviewPath, sourceReviewSha256: sha256(reviewBytes), auditPath: "review-audit.json", auditPathBase: "release-directory", auditSha256: sha256(auditBytes) } };
  return { config, fixture, audit, manifest, files: { "fixture.json": fixtureBytes, "manifest.json": jsonText(manifest), "review-audit.json": auditBytes } };
}

async function writeImmutable(path, bytes) {
  await mkdir(dirname(path), { recursive: true });
  try { await writeFile(path, bytes, { flag: "wx" }); }
  catch (error) { if (error.code !== "EEXIST") throw error; assert(await readFile(path, "utf8") === bytes, `Immutable output already differs: ${path}`); }
}

async function main() {
  const args = process.argv.slice(2);
  assert(args.every(arg => arg === "--prepare-release"), "Usage: node scripts/build-cotton-tshirt.mjs [--prepare-release]");
  const result = await buildCottonTshirt();
  if (args.includes("--prepare-release")) {
    const check = spawnSync(process.execPath, [resolve(repositoryRoot, "node_modules/vitest/vitest.mjs"), "run", "tests/cotton-tshirt-release.test.ts"], { cwd: repositoryRoot, stdio: "inherit" });
    assert(check.status === 0, "Cotton contract / domain regression tests must pass before preparing an immutable release");
  }
  const output = args.includes("--prepare-release") ? `data/published/releases/${result.config.productId}/${result.config.datasetVersion}` : `data/candidates/${result.config.batchId}`;
  for (const [name, bytes] of Object.entries(result.files)) await writeImmutable(resolve(repositoryRoot, output, name), bytes);
  console.log(JSON.stringify({ status: "prepared", output, ...result.audit.counts, activeManifestChanged: false }, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
