import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const homeAirConditionerContentPath = "content/products/home-air-conditioner-2026-10.json";
export const homeAirConditionerReviewPath = "content/reviews/home-air-conditioner-2026-10-21.json";
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const unique = values => [...new Set(values)];
const assert = (condition, message) => { if (!condition) throw new Error(message); };

async function readPinned(root, path, expected) {
  const absolute = resolve(root, path), child = relative(root, absolute);
  assert(child && !isAbsolute(child) && !child.startsWith(".."), `Unsafe input path: ${path}`);
  const bytes = await readFile(absolute);
  assert(hash(bytes) === expected, `Reviewed source hash changed: ${path}`);
  return bytes;
}

/** Offline, deterministic construction; never changes the active manifest. */
export async function buildHomeAirConditioner(root = repositoryRoot) {
  const contentBytes = await readFile(resolve(root, homeAirConditionerContentPath));
  const reviewBytes = await readFile(resolve(root, homeAirConditionerReviewPath));
  const c = JSON.parse(contentBytes), review = JSON.parse(reviewBytes);
  assert(c.productId === "generic-home-air-conditioner" && c.datasetVersion === "globe-chain-home-air-conditioner-2026.1", "Home AC identity requires a new review");
  const rawManifest = JSON.parse(await readPinned(root, review.rawManifest.path, review.rawManifest.sha256));
  const snapshots = new Map();
  for (const spec of review.sourceSnapshots) {
    const bytes = await readPinned(root, spec.path, spec.sha256);
    assert(bytes.length === spec.bytes && spec.httpStatus === 200, `Unusable source snapshot: ${spec.alias}`);
    if (spec.alias !== "countries") {
      const entry = rawManifest.find(row => spec.path.endsWith(`/${row.file}`));
      assert(entry?.httpStatus === 200 && entry.sha256 === spec.sha256 && entry.bytes === bytes.length && entry.url === spec.source.url && entry.retrievedAt === spec.source.retrievedAt, `Raw manifest does not match source: ${spec.alias}`);
    }
    snapshots.set(spec.alias, { ...spec, bytes });
  }
  const snapshot = key => { const s = snapshots.get(key); assert(s, `Unknown source alias: ${key}`); return s; };
  const sourceId = key => key === "curation" ? "source-home-ac-curation" : snapshot(key).source.id;
  const period = key => { assert(c.periods[key], `Unknown period: ${key}`); return c.periods[key]; };
  const version = c.datasetVersionId, contentVersion = c.contentVersionId;
  const common = { method: "curated", datasetVersionId: version, contentVersionId: contentVersion };
  const meta = (aliases, periodKey = "technical") => ({ ...common, sourceIds: unique(aliases.map(sourceId)), period: period(periodKey), dataStatus: "observed" });
  const itemRows = [[c.productId, c.productName, "final_product", null, c.description, "doe"], ...c.items];
  const itemById = new Map(itemRows.map(row => [row[0], row]));
  assert(itemById.size === itemRows.length, "Duplicate content item IDs");
  const technicalItems = itemRows.filter(row => row[5] !== "hs").map(row => row[0]);
  const stepId = key => `home-ac-step-${key}`;
  const equipmentId = key => `home-ac-equipment-${key}`;
  const nodeId = itemId => `home-ac-node-${itemId}`;
  const hsDictionary = JSON.parse(snapshot("hs").bytes);
  assert(hsDictionary.classCode === "H6" && hsDictionary.className === "HS2022", "HS dictionary identity changed");
  const selection = review.tradeSelection;
  const codes = selection.commodityCodes.map(code => {
    const entry = hsDictionary.results.find(row => row.id === code);
    assert(entry?.aggrlevel === 6 && entry.standardUnitAbbr === "u", `Unverified HS code/unit: ${code}`);
    assert(itemById.has(`ac-related-hs${code}`), `Missing explicit category item: ${code}`);
    return entry;
  });
  const quantityUnit = JSON.parse(snapshot("units").bytes).results.find(row => row.qtyCode === 5);
  assert(quantityUnit?.qtyAbbr === "u" && quantityUnit.qtyDescription === "Number of items", "Quantity code 5 must be number of items");
  const countriesHtml = snapshot("countries").bytes.toString("utf8");
  for (const country of c.countries) {
    const name = country.sourceName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert(new RegExp(`<td>\\s*${name}\\s*</td>\\s*<td>\\s*${country.m49}\\s*</td>\\s*<td>\\s*${country.iso2}\\s*</td>\\s*<td>\\s*${country.iso3}\\s*</td>`).test(countriesHtml), `UN M49 mapping not found: ${country.id}`);
  }
  const curationSource = { id: sourceId("curation"), name: "家用房间空调结构与研究索引整理", publisher: "GlobeChain", url: null, publishedAt: c.reviewedAt, retrievedAt: c.reviewedAt, datasetVersion: c.contentVersion, license: "项目原创整理；各原始来源条款分别适用。", notes: `${homeAirConditionerContentPath}; SHA-256=${hash(contentBytes)}。历史技术、历史国家角色与2024贸易分开；研究索引不证明同批物流。` };
  const evidence = [];
  function addEvidence(key, alias, supportType, scope, locator, notes) {
    const id = `evidence-home-ac-${key}`;
    evidence.push({ id, sourceId: sourceId(alias), supportType, scope: { entityIds: [], fromEntityId: null, toEntityId: null, itemIds: [], processStageIds: [], processStepIds: [], equipmentCategoryIds: [], organizationIds: [], classificationCodes: [], direction: null, period: null, scopeDescription: notes, supportsCountryRole: false, supportsBilateralFlow: false, supportsProcessContext: false, supportsManufacturerCapability: false, supportsCommercialRelationship: false, supportsPolicyGuidance: false, limitations: c.limitations, ...scope }, locator: alias === "curation" ? `${homeAirConditionerContentPath}; SHA-256=${hash(contentBytes)}; ${locator}` : `${snapshot(alias).path}; SHA-256=${snapshot(alias).sha256}; ${locator}`, excerpt: null, notes });
    return id;
  }
  const curationEvidence = addEvidence("curation", "curation", "curation_method", { itemIds: itemRows.map(row => row[0]), period: period("story") }, "representativeStatement; methodology; limitations", "按原始来源组织部件、技术支线、国家历史背景和相关成品贸易；跨期资料只作索引，不对应同一批物料。");
  const processEvidence = addEvidence("process", "doe", "process_context", { itemIds: technicalItems, processStageIds: c.stages.slice(0, 6).map(row => row[0]), processStepIds: c.process.steps.map(row => stepId(row[0])), equipmentCategoryIds: c.process.equipment.map(row => equipmentId(row[0])), period: period("technical"), supportsProcessContext: true }, snapshot("doe").locator, "1997年历史技术参考，正文1-1列部件，1-2述制造，图1.1列供给部件与子装配。按功能整理设备类别，不指认当代国家、工厂或品牌；塑料成型方式未细分。");
  const roleEvidence = addEvidence("china-role", "iea", "country_role", { entityIds: ["country-cn"], itemIds: [c.productId], processStageIds: ["ac-production-context"], period: period("chinaRole"), supportsCountryRole: true }, snapshot("iea").locator, "IEA2019报告的2017统计背景支持中国房间空调生产角色；报告中约70%的文字不在本批转成可比较年度份额，亦不用于证明2024出口来源工厂。");
  const provenance = ids => ({ evidenceIds: unique(ids), sourceIds: unique(ids.map(id => { const ev = evidence.find(row => row.id === id); assert(ev, `Unknown evidence ID ${id}`); return ev.sourceId; })) });
  const processProvenance = provenance([curationEvidence, processEvidence]);
  const processMeta = { ...meta(["doe"]), ...processProvenance, limitations: c.limitations.slice(1, 5) };
  const outputStepByItem = new Map(c.process.steps.flatMap(step => step[4].map(itemId => [itemId, step[0]])));
  const stageByStep = { cabinet: "ac-cabinet", fins: "ac-exchanger", thread: "ac-exchanger", braze: "ac-exchanger", "exchanger-leak": "ac-exchanger", subassembly: "ac-subassembly", assembly: "ac-assembly", charge: "ac-charge-test-pack", "test-pack": "ac-charge-test-pack" };
  const nodes = technicalItems.map(itemId => ({ id: nodeId(itemId), nodeType: outputStepByItem.has(itemId) ? "process" : "item", label: itemById.get(itemId)[1], entityId: null, itemId, itemType: itemById.get(itemId)[2], processStageId: stageByStep[outputStepByItem.get(itemId)] ?? "ac-materials", ...meta(["doe"]), ...processProvenance, evidenceLevel: "representative", notes: "1997年历史工艺中的功能投入或产出；不指定国家、工厂、单机用量或物流。" }));
  const flows = c.process.steps.flatMap(([key, , , inputs, outputs]) => inputs.map((itemId, index) => ({ id: `home-ac-flow-${key}-${index + 1}`, fromEntityId: nodeId(itemId), toEntityId: nodeId(outputs[0]), itemId, processStageId: stageByStep[key], relationType: "input", flowKind: "representative_supply", ...meta(["doe"]), ...processProvenance, evidenceLevel: "representative", value: null, quantity: null, currency: null, unit: null, dataStatus: "unknown", valueDataStatus: "unknown", quantityDataStatus: "unknown", confidence: null, notes: "有来源的制造结构关系；数值未知，不表示观测物流或固定用量。" })));
  nodes.push({ id: "home-ac-cn-role", nodeType: "entity", label: "中国 · 历史生产背景", entityId: "country-cn", itemId: c.productId, itemType: "final_product", processStageId: "ac-production-context", ...meta(["iea"], "chinaRole"), ...provenance([roleEvidence]), evidenceLevel: "role_supported", notes: "2017统计背景（IEA2019报告）；不是当前产量或份额。" });
  const unmeasuredLink = (id, from, to, itemId, stage, notes) => ({ id, fromEntityId: from, toEntityId: to, itemId, processStageId: stage, relationType: "dependency", flowKind: "representative_supply", ...meta(["curation"], "story"), ...provenance([curationEvidence]), evidenceLevel: "representative", value: null, quantity: null, currency: null, unit: null, dataStatus: "unknown", valueDataStatus: "unknown", quantityDataStatus: "unknown", confidence: null, notes });
  flows.push(unmeasuredLink("home-ac-context-history", nodeId(c.productId), "home-ac-cn-role", c.productId, "ac-production-context", "跨期研究索引：历史技术与中国生产背景并列；不主张1997年工艺在中国工厂应用或同一台设备的谱系。"));
  const rawTrade = JSON.parse(snapshot("trade").bytes);
  assert(rawTrade.error === "" && rawTrade.count === selection.expectedRawCount && rawTrade.data.length === selection.expectedRawCount && rawTrade.data.length < selection.previewLimit, "Trade response error/count/cap changed");
  const tradeKeys = new Set(), tradeObservations = [], tradeRows = [], excludedTradeRows = [];
  const partnerEntity = new Map([[276, "country-de"], [842, "country-us"]]);
  for (const row of rawTrade.data) {
    assert(row.reporterCode === selection.reporterCode && row.refYear === 2024 && row.period === selection.period && row.typeCode === "C" && row.freqCode === "A" && row.classificationCode === selection.classificationCode && row.isOriginalClassification === true && selection.commodityCodes.includes(row.cmdCode) && [0, ...selection.partners].includes(row.partnerCode) && ["X", "M"].includes(row.flowCode) && row.partner2Code === 0 && row.motCode === 0 && row.customsCode === "C00" && row.qtyUnitCode === 5, "Unexpected raw trade dimensions");
    const key = `${row.cmdCode}-${row.partnerCode}-${row.flowCode}-${row.period}`;
    assert(!tradeKeys.has(key), "Duplicate raw trade dimensions"); tradeKeys.add(key);
    if (row.flowCode !== selection.flowCode || !selection.partners.includes(row.partnerCode)) {
      excludedTradeRows.push({ key, classificationCode: row.cmdCode, partnerCode: row.partnerCode, flowCode: row.flowCode, isReported: row.isReported, isAggregate: row.isAggregate, reason: row.partnerCode === 0 ? "world_total excluded; do not add to bilateral observations" : "import outside reviewed export-only scope" });
      continue;
    }
    assert(row.isReported === true && row.isAggregate === false && row.isQtyEstimated === false && row.isNetWgtEstimated === false && row.legacyEstimationFlag === 0, "Reviewed bilateral quality flags changed");
    assert(Number.isFinite(row.fobvalue) && row.fobvalue >= 0 && row.primaryValue === row.fobvalue && Number.isFinite(row.qty) && row.qty >= 0 && Number.isFinite(row.netWgt) && row.netWgt >= 0, "Invalid FOB / items / weight");
    const quality = { legacyEstimationFlag: row.legacyEstimationFlag, isQtyEstimated: row.isQtyEstimated, isNetWgtEstimated: row.isNetWgtEstimated, isReported: row.isReported, isAggregate: row.isAggregate, sourceDatasetCode: row.classificationCode, sourcePublicationDate: null, sourceRevision: null };
    const original = { classificationCode: row.classificationCode, isOriginalClassification: row.isOriginalClassification, qtyUnitCode: row.qtyUnitCode, qtyUnitAbbr: row.qtyUnitAbbr, altQtyUnitCode: row.altQtyUnitCode, altQty: row.altQty, isAltQtyEstimated: row.isAltQtyEstimated, netWgt: row.netWgt, isNetWgtEstimated: row.isNetWgtEstimated, grossWgt: row.grossWgt, isGrossWgtEstimated: row.isGrossWgtEstimated, cifvalue: row.cifvalue, fobvalue: row.fobvalue, partner2Code: row.partner2Code, motCode: row.motCode, customsCode: row.customsCode };
    const id = `home-ac-trade-${key}`, categoryItemId = `ac-related-hs${row.cmdCode}`, targetCountry = partnerEntity.get(row.partnerCode), hs = codes.find(code => code.id === row.cmdCode);
    const classificationScope = [{ system: "HS", version: "2022", code: hs.id, mappingType: "exact", description: hs.text }];
    const scope = { entityIds: ["country-cn", targetCountry], itemIds: [categoryItemId], classificationCodes: classificationScope, processStageIds: ["ac-related-trade"], direction: "export", period: period("trade") };
    const bilateralEvidence = addEvidence(`bilateral-${key}`, "trade", "bilateral_flow", { ...scope, fromEntityId: "country-cn", toEntityId: targetCountry, supportsBilateralFlow: true }, `data[reporterCode=156,partnerCode=${row.partnerCode},cmdCode=${row.cmdCode},flowCode=X,period=2024]`, "中国报告的2024年直接双边出口；只支持该HS完整分类范围，不升级为某一款家用空调的精确供货。美国842保留为来源伙伴码，地理M49仍为840。");
    const marketEvidence = addEvidence(`market-${key}`, "trade", "trade_observation", { ...scope, supportsCountryRole: true }, `data[${key}]`, "具体伙伴贸易记录支持该宽口径成品的出口方与贸易目的地角色，不推断最终消费、品牌或厂商。");
    const fromNode = `home-ac-export-${row.cmdCode}`, toNode = `home-ac-market-${row.cmdCode}-${row.partnerCode}`;
    if (!nodes.some(node => node.id === fromNode)) {
      nodes.push({ id: fromNode, nodeType: "market", label: `中国 · HS${row.cmdCode}相关成品出口`, entityId: "country-cn", itemId: categoryItemId, itemType: "component", processStageId: "ac-related-trade", ...meta(["trade"], "trade"), ...provenance([marketEvidence]), evidenceLevel: "role_supported", notes: "2024年相关成品贸易；不等于某款家用机型产量或销量。" });
      flows.push(unmeasuredLink(`home-ac-context-${row.cmdCode}`, nodeId(c.productId), fromNode, categoryItemId, "ac-related-trade", "跨期分类索引：历史制造结构与2024相关成品贸易分别有来源；不证明同一工厂或批次，不转移份额或货量。"));
    }
    nodes.push({ id: toNode, nodeType: "market", label: `${c.countries.find(country => country.id === targetCountry).name} · HS${row.cmdCode}贸易目的地`, entityId: targetCountry, itemId: categoryItemId, itemType: "component", processStageId: "ac-related-trade", ...meta(["trade"], "trade"), ...provenance([marketEvidence]), evidenceLevel: "role_supported", notes: "中国报告的具体伙伴目的地；不推断零售或最终使用。" });
    flows.push({ id: `home-ac-bilateral-${key}`, fromEntityId: fromNode, toEntityId: toNode, itemId: categoryItemId, processStageId: "ac-related-trade", relationType: "trade", flowKind: "representative_supply", ...meta(["trade"], "trade"), ...provenance([bilateralEvidence]), evidenceLevel: "bilateral_supported", value: null, quantity: null, currency: null, unit: null, dataStatus: "unknown", valueDataStatus: "unknown", quantityDataStatus: "unknown", confidence: null, notes: `直接统计支持的HS${row.cmdCode}双边方向；具体FOB金额、件数和净重见独立海关观察${id}。路线数值不代替统计账本。` });
    tradeObservations.push({ id, reporterEntityId: "country-cn", reporterCode: row.reporterCode, partnerEntityId: targetCountry, partnerCode: row.partnerCode, partner2Code: 0, flowCode: "X", partnerScope: "entity", direction: "export", classificationSystem: "HS", classificationVersion: "2022", classificationCode: row.cmdCode, itemId: c.productId, period: period("trade"), value: row.fobvalue, quantity: row.qty, currency: "USD", unit: "items", statisticalConcept: "customs", sourceId: sourceId("trade"), datasetVersionId: version, method: "official", dataStatus: "observed", valueDataStatus: "observed", quantityDataStatus: "observed", quality, qualityNote: `相关成品宽口径HS${row.cmdCode}，不是某款家用空调销量。出口FOB现价USD；数量码5由官方字典确认为items；净重kg另存，不能替换件数。无世界总计混入。raw=${snapshot("trade").path}; SHA-256=${snapshot("trade").sha256}; original=${JSON.stringify(original)}` });
    tradeRows.push({ id, key, rawSnapshot: snapshot("trade").path, rawSha256: snapshot("trade").sha256, reporterCode: row.reporterCode, partnerCode: row.partnerCode, commodityCode: row.cmdCode, flowCode: row.flowCode, period: row.period, primaryValue: row.primaryValue, fobvalue: row.fobvalue, qty: row.qty, netWgt: row.netWgt, qtyUnitCode: row.qtyUnitCode, normalizedUnit: "items", original, quality });
  }
  assert(tradeObservations.length === selection.expectedSelectedCount && excludedTradeRows.length === 8, "Reviewed export selection changed");
  const branch = (id, title, description, stepKeys) => ({ id: `home-ac-branch-${id}`, order: 0, title, description, nodeIds: unique(stepKeys.flatMap(key => { const s = c.process.steps.find(row => row[0] === key); return [...s[3], ...s[4]].map(nodeId); })), flowIds: flows.filter(flow => stepKeys.some(key => flow.id.startsWith(`home-ac-flow-${key}-`))).map(flow => flow.id), evidenceIds: [curationEvidence, processEvidence], method: "curated", contentStatus: "published", contentVersionId: contentVersion });
  const branches = [
    branch("housing", "机壳支线", "钣金和塑料格栅形成外壳，随后进入整机总装。", ["cabinet"]),
    branch("exchanger", "铜管与铝翅片支线", "铝翅片冲压叠片、铜管穿片、扩管钎焊后检漏；用量和材料产国未知。", ["fins", "thread", "braze", "exchanger-leak"]),
    branch("components", "功能部件支线", "压缩机、风机、电控与阀件进入子装配；无厂商客户关系。", ["subassembly"]),
    branch("assembly", "总装、充注与包装", "三条投入支线汇合，充注后整机检漏、包装和标识。", ["assembly", "charge", "test-pack"]),
    { id: "home-ac-branch-markets", order: 0, title: "生产背景与两个出口市场", description: "中国历史生产背景与2024年两类相关成品出口分开阅读；德国、美国为中国报告的伙伴目的地。", nodeIds: [nodeId(c.productId), ...nodes.filter(node => node.entityId).map(node => node.id)], flowIds: flows.filter(flow => !flow.id.startsWith("home-ac-flow-")).map(flow => flow.id), evidenceIds: unique([curationEvidence, roleEvidence, ...evidence.filter(ev => ["bilateral_flow", "trade_observation"].includes(ev.supportType)).map(ev => ev.id)]), method: "curated", contentStatus: "published", contentVersionId: contentVersion }
  ].map((b, index) => ({ ...b, order: index + 1 }));
  const sources = [...review.sourceSnapshots.map(spec => spec.source), curationSource];
  const fixture = {
    schemaVersion: "product-fixture.v1", productId: c.productId,
    datasetVersion: { id: version, name: "家用房间空调：部件、制造与相关成品贸易", version: c.datasetVersion, publishedAt: c.reviewedAt, sourceIds: sources.map(s => s.id), coverage: null, status: "published", notes: "独立可发布格式候选，未激活。1997技术参考、2017统计背景与2024双边贸易分别保留原始期间。" },
    contentVersions: [{ id: contentVersion, version: c.contentVersion, status: "published", publishedAt: c.reviewedAt, notes: c.limitations.join(" ") }], sources, evidence, evidenceGaps: [],
    entities: c.countries.map(({ sourceName, ...country }) => ({ ...country, kind: "country", parentId: null, sourceIds: [sourceId("countries")], method: "official", dataStatus: "observed", datasetVersionId: version, validPeriod: period("curation") })),
    items: itemRows.map(([id, name, itemType, parentItemId, description, alias]) => ({ id, slug: id, name, itemType, parentItemId, category: "机械设备", description, sourceIds: [sourceId(alias)], method: "curated", dataStatus: "observed", datasetVersionId: version, validPeriod: id === c.productId ? period("curation") : period(alias === "hs" ? "trade" : "technical") })),
    processStages: c.stages.map(([id, label], order) => ({ id, code: id, label, order: order + 1, description: `${label}；期间与适用范围见逐条来源。`, sourceIds: [sourceId(id === "ac-production-context" ? "iea" : id === "ac-related-trade" ? "trade" : "doe")], method: "curated", dataStatus: "observed", datasetVersionId: version })),
    productionActivities: [{ id: "home-ac-production-context-cn", locationEntityId: "country-cn", processStageId: "ac-production-context", inputItemIds: [], outputItemIds: [c.productId], ...meta(["iea"], "chinaRole"), ...provenance([roleEvidence]), evidenceLevel: "role_supported", notes: "仅为中国历史生产角色；没有工厂、部件投入或产量记录。" }],
    classificationCodes: codes.map(hs => ({ id: `home-ac-hs2022-${hs.id}`, system: "HS", version: "2022", code: hs.id, level: hs.aggrlevel, label: hs.text, validPeriod: period("trade"), sourceIds: [sourceId("hs")], method: "official", dataStatus: "observed", datasetVersionId: version })),
    classificationCrosswalks: codes.flatMap(hs => [
      { id: `home-ac-crosswalk-product-${hs.id}`, itemId: c.productId, classificationCodeId: `home-ac-hs2022-${hs.id}`, mappingType: "aggregate", confidence: null, notes: "家用房间空调内容的相关成品统计入口；官方分类范围更宽。", limitation: c.limitations[0], period: period("trade"), sourceIds: [sourceId("hs"), sourceId("curation")], method: "curated", dataStatus: "observed", datasetVersionId: version },
      { id: `home-ac-crosswalk-category-${hs.id}`, itemId: `ac-related-hs${hs.id}`, classificationCodeId: `home-ac-hs2022-${hs.id}`, mappingType: "exact", confidence: null, notes: hs.text, limitation: "仅此显式HS范围条目与分类精确对应；不把精确映射传播到家用空调商品。", period: period("trade"), sourceIds: [sourceId("hs")], method: "curated", dataStatus: "observed", datasetVersionId: version }
    ]),
    storyGraph: { productId: c.productId, period: period("story"), ...common, representativeStatement: c.representativeStatement, methodology: c.methodology, limitations: c.limitations, nodes, flows, steps: branches, warnings: [] },
    tradeObservations, materialTradeObservations: [], macroIndicators: [], indicatorDefinitions: [],
    manufacturingProcessChains: [{ id: c.process.id, itemId: c.productId, title: c.process.title, description: c.process.description, ...processMeta }],
    manufacturingRouteVariants: [],
    manufacturingProcessSteps: c.process.steps.map(([key, name, phase, inputItemIds, outputItemIds, description], order) => ({ id: stepId(key), processChainId: c.process.id, order: order + 1, name, phase, inputItemIds, outputItemIds, description, routeVariantIds: [], ...processMeta })),
    equipmentCategories: c.process.equipment.map(([key, name]) => ({ id: equipmentId(key), name, description: "完成对应制造步骤的功能设备或工装。", ...meta(["doe"]) })),
    processRequirements: c.process.steps.flatMap(([key, , , inputs, , , equipmentKeys]) => [
      ...inputs.map((itemId, index) => ({ id: `home-ac-requirement-${key}-input-${index + 1}`, processStepId: stepId(key), requirementType: "material", itemId, equipmentCategoryId: null, name: itemById.get(itemId)[1], necessity: "core", description: "用于该工序的材料或部件投入。", ...processMeta })),
      ...equipmentKeys.map(equipmentKey => ({ id: `home-ac-requirement-${key}-equipment-${equipmentKey}`, processStepId: stepId(key), requirementType: "equipment", itemId: null, equipmentCategoryId: equipmentId(equipmentKey), name: c.process.equipment.find(row => row[0] === equipmentKey)[1], necessity: equipmentKey === "plastic-molding" ? "optional" : "core", description: equipmentKey === "plastic-molding" ? "塑料件可外购或厂内成型，采用厂内路线时使用成型工装。" : "完成该步骤的功能设备或工装。", ...processMeta }))
    ]),
    organizations: [], facilities: [], organizationCapabilities: [], tradeGuides: [], tariffMeasures: [], tradeRequirements: [], tradeProcedures: [], tradeProcedureSteps: [], tradeDocumentRequirements: [], policyDocuments: [], missingDataNotes: c.limitations, warnings: []
  };
  fixture.evidenceGaps.push({ gapId: "home-ac-gap-batch-lineage", flowId: "home-ac-context-history", nodeId: null, currentClaim: "制造结构、历史生产角色与相关成品出口之间提供研究索引。", currentEvidenceLevel: "representative", missingEvidence: "可连接材料、工厂、品牌和出口货物批次的公开证据；以及当代工艺适用性资料。", acceptableEvidenceTypes: ["bilateral_flow", "commercial_relationship", "process_context"], candidateSources: [{ name: "获授权的工厂和批次公开记录", publisher: "相关生产及贸易主体", url: null, license: "公开披露或合法授权", notes: "国家贸易总额与行业生产角色不能代替批次记录。" }], classificationCandidates: [], status: "not_publicly_observable", nonInferences: ["不把1997工艺当作2026中国现况。", "不把国家生产角色、HS出口或设备功能类目视作厂商供货证据。"], evidenceIds: [curationEvidence], period: period("curation"), ...common });
  const counts = { items: fixture.items.length, countries: fixture.entities.length, storyNodes: nodes.length, storyFlows: flows.length, branches: branches.length, tradeObservations: tradeObservations.length, worldTotals: 0, bilateralStatistics: tradeObservations.length, manufacturingSteps: fixture.manufacturingProcessSteps.length, equipmentCategories: fixture.equipmentCategories.length, organizations: 0 };
  const audit = { schemaVersion: "home-air-conditioner-release-audit.v1", batchId: c.batchId, reviewedAt: c.reviewedAt, productId: c.productId, datasetVersion: c.datasetVersion, inputs: { content: { path: homeAirConditionerContentPath, sha256: hash(contentBytes) }, review: { path: homeAirConditionerReviewPath, sha256: hash(reviewBytes) }, rawManifest: review.rawManifest, snapshots: review.sourceSnapshots.map(({ alias, path, sha256, bytes, locator }) => ({ alias, path, sha256, bytes, locator })) }, transformations: ["离线核对原始manifest与六个已保存输入SHA-256、字节数和成功状态。", "以封面原件纠正DOE年份为1997；IEA历史国家背景不发布当前份额。", "从HS2022提取841510/841582；商品aggregate映射与显式分类条目exact映射分开。", "从12条原始记录中严格筛选4条2024中国报告双边出口；排除世界总计与进口，不求和填补。", "FOB为USD，qtyUnitCode=5经官方字典转items；净重kg和原始质量标记分别保留。", "从DOE的部件、制造文字和图1.1整理九步、三个投入支线及功能设备；所有技术节点无国家归属。", "结构和跨期研究索引均无数值，不创建单机用量、厂商或贸易指南事实。"], publicationCorrections: review.publicationCorrections, classification: { classCode: hsDictionary.classCode, className: hsDictionary.className, selectedEntries: codes }, quantityUnit, tradeRows, excludedTradeRows, counts, validation: { pinnedSourceHashes: "passed", rawManifest: "passed", officialCountryMappings: "passed", sourceNativeUSPartnerCode: 842, geographicUSM49: "840", classificationAndQuantityDictionaries: "passed", rawScopeAndUniqueDimensions: "passed", previewLimitNotReached: true, activeManifestChanged: false }, limitations: c.limitations };
  const fixtureBytes = json(fixture), auditBytes = json(audit);
  const manifest = { schemaVersion: "fixture-manifest.v1", fixtures: [{ productId: c.productId, path: "fixture.json" }], datasetVersion: c.datasetVersion, generatedAt: c.reviewedAt, fixtureSha256: hash(fixtureBytes), release: { productId: c.productId, datasetVersion: c.datasetVersion, releasePath: `releases/${c.productId}/${c.datasetVersion}`, immutable: true }, evidenceReview: { batchId: c.batchId, contentSource: homeAirConditionerContentPath, contentPathBase: "repository-root", contentSha256: hash(contentBytes), sourceReview: homeAirConditionerReviewPath, sourceReviewSha256: hash(reviewBytes), auditPath: "review-audit.json", auditPathBase: "release-directory", auditSha256: hash(auditBytes) } };
  return { config: c, fixture, audit, manifest, files: { "fixture.json": fixtureBytes, "manifest.json": json(manifest), "review-audit.json": auditBytes } };
}

async function writeImmutable(path, bytes) {
  await mkdir(dirname(path), { recursive: true });
  try { await writeFile(path, bytes, { flag: "wx" }); }
  catch (error) { if (error.code !== "EEXIST") throw error; assert(await readFile(path, "utf8") === bytes, `Immutable output already differs: ${path}`); }
}

async function main() {
  const args = process.argv.slice(2);
  assert(args.every(arg => arg === "--prepare-release"), "Usage: node scripts/build-home-air-conditioner.mjs [--prepare-release]");
  const result = await buildHomeAirConditioner();
  if (args.includes("--prepare-release")) {
    const check = spawnSync(process.execPath, [resolve(repositoryRoot, "node_modules/vitest/vitest.mjs"), "run", "tests/home-air-conditioner-release.test.ts"], { cwd: repositoryRoot, stdio: "inherit" });
    assert(check.status === 0, "Home AC contracts and queries must pass before preparing a release");
  }
  const output = args.includes("--prepare-release") ? `data/published/releases/${result.config.productId}/${result.config.datasetVersion}` : `data/candidates/${result.config.batchId}`;
  for (const [name, bytes] of Object.entries(result.files)) await writeImmutable(resolve(repositoryRoot, output, name), bytes);
  console.log(json({ status: "prepared-not-activated", output, ...result.audit.counts, activeManifestChanged: false }));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
