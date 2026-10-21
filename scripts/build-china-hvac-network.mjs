import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const chinaHvacResearchPath = "content/industry/china-hvac-reviewed-2026-10.json";
export const chinaHvacSupplementPath = "content/industry/china-hvac-supplement-2026-10-22.json";
export const chinaHvacCoreSupplementPath = "content/industry/china-hvac-core-supplement-2026-10-22.json";
export const chinaHvacBasePath = "data/published/releases/generic-home-air-conditioner/globe-chain-home-air-conditioner-2026.1/fixture.json";
const expectedBaseHash = "19a3b48b7cb086fb399af3fbb6a8bc21420b9141c8db31fd6be2f7fea0352b39";
const expectedResearchHash = "9c3a46c05691ed644ee9e3c707d806a1d9a8f826e424042c4a03fdc69673937e";
const expectedSupplementHash = "8d974eaf9a8b174216893694d0b10fe7d624b5f0131b73b5cb3102688987a0f1";
const expectedCoreHash = "ca804a75e29886097f7a9d8617b65b66732b53d7def35765f395359f7b5415c8";
const productId = "generic-home-air-conditioner";
const version = "globe-chain-home-air-conditioner-2026.2";
const datasetId = "dataset-home-air-conditioner-2026-2";
const reviewedAt = "2026-10-22";
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const unique = values => [...new Set(values)];
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const sourceId = id => `source-china-hvac-${id}`;
const supportedKinds = new Set(["material", "component", "process", "equipment", "product", "channel", "service"]);
const summaries = {
  "copper-material": "制冷用铜管的上游铜与铜合金材料。",
  "copper-tube": "内螺纹管、复绕盘管与空调直管，用于换热器和管路连接。",
  "aluminium-fin": "铝卷材经加工形成翅片，与铜管组成换热器的传热结构。",
  "heat-exchanger": "由铜管与铝翅片构成的换热器，可沿材料、加工设备和整机用途继续探索。",
  "tube-manufacturing": "铜管加工涉及连铸、铣面、轧制、拉伸和内螺纹成型。",
  "fin-forming": "利用冲压设备，将卷材加工成换热器翅片。",
  "coil-expansion": "对换热盘管扩管、翻边，并衔接进出料操作。",
  "brazing": "连接回弯管，是铜管铝翅片换热器制造中的一道工序。",
  "leak-testing": "检查换热器与整机的密封性，衔接装配和测试。",
  "fin-press-equipment": "翅片冲压生产线，用于铜铝翅片换热器的翅片生产。",
  "expander-equipment": "多工位立式胀管设备，用于换热盘管扩管和翻边。",
  "compressor": "往复、转子和涡旋压缩机，面向空调、制冷与热泵应用。",
  "control-valve": "电子膨胀阀，是制冷系统的控制部件。",
  "evaporative-condenser": "蒸发式冷凝器，可从官方换热设备目录查看产品与业务入口。",
  "ice-machine": "片冰、管冰、板冰和直蒸块冰等设备与制冰系统。",
  "water-chiller": "冷水机组，可从官方制冷设备目录继续查看。",
  "room-air-conditioner": "房间空调是换热器、压缩机和控制部件的下游整机应用。",
  "b2b-official-contact": "查看工业产品和企业业务联系入口，自行沟通需求。",
  "consumer-official-store": "进入品牌官方商城，了解面向消费者的空调产品。"
};
const organizationSummaries = {
  "org-jintian": "内螺纹铜管、复绕盘管和空调直管，配有铜管制造设备介绍。",
  "org-gmcc": "空调与制冷压缩机、电子膨胀阀，覆盖家用和商用空调等应用。",
  "org-jingda": "翅片冲压线和多工位胀管机等换热器制造设备。",
  "org-snowman": "蒸发式冷凝器、多类制冰机和冷水机产品。",
  "org-gree": "家用空调产品与品牌官方商城。"
};

// Research correspondence connects equivalent functions to existing product
// records; it never assigns current suppliers, materials or formulations to the
// historical 1997 manufacturing reference.
const topicItemIds = {
  "copper-tube": ["ac-copper-tube"],
  "tube-manufacturing": ["ac-copper-tube"],
  "aluminium-fin": ["ac-aluminium-sheet", "ac-aluminium-fins"],
  "fin-forming": ["ac-aluminium-fins"],
  "heat-exchanger": ["ac-heat-exchanger"],
  "compressor": ["ac-compressor"],
  "control-valve": ["ac-valves"],
  "room-air-conditioner": ["generic-home-air-conditioner"],
  "brazing": ["ac-brazed-exchanger"],
  "coil-expansion": ["ac-threaded-exchanger"],
  "hvaccore22-aircon-motor": ["ac-fan-motor"],
  "hvaccore22-aircon-fan": ["ac-fan-motor"],
  "hvaccore22-ac-controller": ["ac-controller"],
  "hvaccore22-compressor-drive": ["ac-controller"],
  "hvaccore22-r32": ["ac-refrigerant"],
  "hvaccore22-housing": ["ac-housing"]
};
async function readInside(root, path, expected) {
  const absolute = resolve(root, path), child = relative(root, absolute);
  assert(child && !isAbsolute(child) && child !== ".." && !child.startsWith("..\\") && !child.startsWith("../"), `Unsafe input path: ${path}`);
  const bytes = await readFile(absolute);
  if (expected) assert(hash(bytes) === expected, `Reviewed input hash changed: ${path}`);
  return bytes;
}
function remapDataset(value, oldId) {
  if (Array.isArray(value)) return value.map(child => remapDataset(child, oldId));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, key === "datasetVersionId" && child === oldId ? datasetId : remapDataset(child, oldId)]));
}
function normalizePeriod(period) {
  assert(period && /^\d{4}-\d{2}-\d{2}$/.test(period.start) && period.start <= period.end, "Invalid research period");
  assert(["annual", "quarterly", "monthly", "snapshot"].includes(period.granularity), "Unsupported research period");
  // The contract stores a dated observation with monthly granularity; the exact
  // start/end and explicit snapshot label remain unchanged, never a full-year claim.
  return { ...period, granularity: period.granularity === "snapshot" ? "monthly" : period.granularity };
}
function metadata(record) {
  assert(record.status === "validated", "Unreviewed industry record");
  assert(Array.isArray(record.sourceIds) && record.sourceIds.length > 0, "Industry record lacks sources");
  return { period: normalizePeriod(record.period), unit: "not_applicable", method: "curated", dataStatus: "observed", datasetVersionId: datasetId, sourceIds: unique(record.sourceIds.map(sourceId)) };
}
function officialLinks(organization, sources) {
  const candidates = [
    ...(organization.links ?? []),
    ...(organization.productUrl ? [{ url: organization.productUrl, label: organization.productUrl === organization.contactUrl ? "产品与联系" : "官方产品", kind: organization.productUrl === organization.contactUrl ? "contact" : "product" }] : []),
    ...(organization.contactUrl ? [{ url: organization.contactUrl, label: "联系企业", kind: "contact" }] : []),
    ...organization.sourceIds.map(id => sources.get(id)).filter(source => source?.url).map(source => ({
      url: source.url, label: source.name,
      kind: source.url === organization.contactUrl ? "contact" : /store|mall/i.test(source.id) ? "sales" : "product"
    }))
  ];
  const seen = new Set();
  return candidates.filter(link => {
    assert(/^https?:\/\//.test(link.url), `Unsafe official link: ${link.url}`);
    if (seen.has(link.url)) return false;
    seen.add(link.url); return true;
  });
}

/** Deterministic offline build from pinned source snapshots; no activation or networking. */
export async function buildChinaHvacNetwork(root = repositoryRoot, { includeSupplement = true } = {}) {
  const baseBytes = await readInside(root, chinaHvacBasePath, expectedBaseHash);
  const researchBytes = await readInside(root, chinaHvacResearchPath, expectedResearchHash);
  const baseline = JSON.parse(baseBytes), research = JSON.parse(researchBytes);
  const batches = [{ path: chinaHvacResearchPath, bytes: researchBytes, value: research }];
  if (includeSupplement) {
    const bytes = await readInside(root, chinaHvacSupplementPath, expectedSupplementHash);
    batches.push({ path: chinaHvacSupplementPath, bytes, value: JSON.parse(bytes) });
  }
  if (includeSupplement) {
    const bytes = await readInside(root, chinaHvacCoreSupplementPath, expectedCoreHash);
    batches.push({ path: chinaHvacCoreSupplementPath, bytes, value: JSON.parse(bytes) });
  }
  const inputs = [{ path: chinaHvacBasePath, sha256: hash(baseBytes) }, ...batches.map(batch => ({ path: batch.path, sha256: hash(batch.bytes) }))];
  const sourceMap = new Map(), topics = [], relations = [], organizations = [], sourceAudit = [];
  const manifests = new Map();
  for (const batch of batches) {
    const value = batch.value;
    assert(value.status === "validated" && value.schemaVersion === "china-hvac-research.v1", `Unreviewed research batch: ${batch.path}`);
    for (const source of value.sources) {
      assert(!sourceMap.has(source.id), `Duplicate research source: ${source.id}`);
      assert(source.httpStatus === 200 && /^[a-f0-9]{64}$/.test(source.sha256), `Unusable research source: ${source.id}`);
      const bytes = await readInside(root, source.rawFile, source.sha256);
      inputs.push({ path: source.rawFile, sha256: hash(bytes) });
      sourceMap.set(source.id, source);
      const linked = [];
      for (const id of source.linkedRawIds ?? []) {
        const manifestPath = `${dirname(source.rawFile).replaceAll("\\", "/")}/manifest-additional.json`;
        if (!manifests.has(manifestPath)) {
          const manifestBytes = await readInside(root, manifestPath);
          inputs.push({ path: manifestPath, sha256: hash(manifestBytes) });
          const parsedManifest = JSON.parse(manifestBytes);
          manifests.set(manifestPath, Array.isArray(parsedManifest) ? parsedManifest : parsedManifest.entries);
        }
        const entry = manifests.get(manifestPath).find(row => row.id === id);
        assert(entry?.httpStatus === 200 && (entry.file || entry.rawFile) && entry.sha256, `Missing linked official body: ${id}`);
        const path = entry.rawFile ?? `${dirname(source.rawFile).replaceAll("\\", "/")}/${entry.file}`;
        const raw = await readInside(root, path, entry.sha256);
        assert(raw.length === entry.bytes, `Linked body length changed: ${id}`);
        inputs.push({ path, sha256: hash(raw) });
        linked.push({ id, path, sha256: hash(raw), url: entry.url });
      }
      sourceAudit.push({ id: source.id, sourceId: sourceId(source.id), rawFile: source.rawFile, sha256: source.sha256, retrievedAt: source.retrievedAt, locator: source.locator, period: source.period, linked });
    }
    topics.push(...value.topics);
    relations.push(...value.relations);
    organizations.push(...value.organizations);
  }
  // A supplement can correct a dated research record without editing its source batch.
  for (const batch of batches) for (const [collection, patches] of Object.entries(batch.value.overrides ?? {})) {
    const rows = { topics, relations, organizations }[collection];
    assert(rows && Array.isArray(patches), `Unsupported review override: ${collection}`);
    for (const patch of patches) {
      const row = rows.find(record => record.id === patch.id);
      assert(row, `Unknown override record: ${patch.id}`);
      Object.assign(row, patch);
    }
  }
  for (const collection of [topics, organizations]) assert(new Set(collection.map(row => row.id)).size === collection.length, "Duplicate research record ID");
  const fixture = remapDataset(baseline, baseline.datasetVersion.id);
  const curationSourceId = "source-china-hvac-curation-2026-2";
  fixture.sources.push(...[...sourceMap.values()].map(source => ({
    id: sourceId(source.id), name: source.name, publisher: source.publisher, url: source.url,
    publishedAt: source.publishedAt, retrievedAt: source.retrievedAt, license: source.license,
    datasetVersion: source.datasetVersion ?? research.datasetVersion,
    notes: `${source.locator} ${source.scope ?? ""} Snapshot: ${source.rawFile}; SHA-256=${source.sha256}. 原始期间：${JSON.stringify(source.period)}。`
  })), { id: curationSourceId, name: "中国空调产业环节与官方入口整理", publisher: "GlobeChain", url: null, publishedAt: reviewedAt, retrievedAt: reviewedAt, license: "项目原创整理；原始来源条款分别适用。", datasetVersion: "china-hvac-content-2026.2", notes: "按公开产品能力、技术用途和官方入口组织环节；主题关系与企业供货关系分别表达。源研究和转换审计保留逐条原说明。" });
  const normalizedTopics = topics.map(topic => {
    const kind = topic.kind === "intermediate" ? "component" : topic.kind;
    assert(supportedKinds.has(kind), `Unsupported topic kind: ${kind}`);
    return { id: topic.id, label: topic.label, kind, description: topic.displayDescription ?? summaries[topic.id] ?? topic.description, ...(topicItemIds[topic.id] ? { itemIds: topicItemIds[topic.id] } : {}), ...metadata(topic) };
  });
  const topicLabels = new Map(normalizedTopics.map(topic => [topic.id, topic.label]));
  const latestRelations = new Map();
  for (const relation of relations) {
    const key = `${relation.fromTopicId}|${relation.toTopicId}|${relation.kind}`;
    const previous = latestRelations.get(key);
    if (!previous || previous.period.start < relation.period.start) latestRelations.set(key, relation);
  }
  const normalizedRelations = [...latestRelations.values()].map((relation, index) => ({
    id: relation.id ?? `china-hvac-relation-${index + 1}`, fromTopicId: relation.fromTopicId, toTopicId: relation.toTopicId,
    kind: relation.kind, description: relation.displayDescription ?? (relation.kind === "sold_through" ? "查看官方产品与业务入口。" : `${topicLabels.get(relation.fromTopicId)}${relation.kind === "process_input" ? "进入" : "用于"}${topicLabels.get(relation.toTopicId)}。`), ...metadata(relation)
  }));
  const normalizedOrganizations = organizations.map(organization => ({
    id: organization.id, name: organization.name, description: organization.displayDescription ?? organizationSummaries[organization.id] ?? organization.description,
    topicIds: organization.topicIds, links: officialLinks(organization, sourceMap), ...metadata(organization)
  }));
  const topicIds = new Set(normalizedTopics.map(topic => topic.id));
  const validSourceIds = new Set(fixture.sources.map(source => source.id));
  assert(topicIds.has("heat-exchanger"), "Missing heat exchanger starting topic");
  for (const record of [...normalizedTopics, ...normalizedRelations, ...normalizedOrganizations]) assert(record.sourceIds.every(id => validSourceIds.has(id)), `Unknown source in industry record: ${record.id}`);
  for (const topic of normalizedTopics) assert((topic.itemIds ?? []).every(id => fixture.items.some(item => item.id === id)), `Unknown product correspondence: ${topic.id}`);
  for (const relation of normalizedRelations) assert(topicIds.has(relation.fromTopicId) && topicIds.has(relation.toTopicId) && relation.fromTopicId !== relation.toTopicId, `Invalid industry relation: ${relation.id}`);
  for (const organization of normalizedOrganizations) assert(organization.topicIds.every(id => topicIds.has(id)) && organization.links.length > 0, `Invalid industry organization: ${organization.id}`);
  fixture.industryNetwork = { schemaVersion: "industry-network.v1", id: "china-hvac-participants", title: "中国空调与制冷产业链", regionEntityId: "country-cn", defaultTopicId: "heat-exchanger", topics: normalizedTopics, relations: normalizedRelations, organizations: normalizedOrganizations, period: { granularity: "annual", start: "1997-01-01", end: reviewedAt, label: "1997技术参考 / 2026-10官网资料" }, unit: "not_applicable", sourceIds: [...sourceMap.keys()].map(sourceId), datasetVersionId: datasetId, method: "curated", dataStatus: "observed" };
  fixture.contentVersions.push({ id: "content-china-hvac-2026-2", version: "china-hvac-content-2026.2", status: "published", publishedAt: reviewedAt, notes: "新增中国空调与制冷产业环节、企业公开能力和官方入口；原有商品路线、工艺和贸易保持原期间。企业间实际供货不由主题邻接推断。" });
  fixture.datasetVersion = { ...fixture.datasetVersion, id: datasetId, version, publishedAt: reviewedAt, sourceIds: fixture.sources.map(source => source.id), notes: "在2026.1基础上增加中国产业环节与官方信息入口；保留1997技术、2017背景、2024贸易及官网观察各自期间。" };
  const audit = { schemaVersion: "china-hvac-release-review.v1", batchId: "china-hvac-2026-10-22", reviewedAt, productId, datasetVersion: version, base: { path: chinaHvacBasePath, sha256: expectedBaseHash }, inputs: [...new Map(inputs.map(input => [input.path, input])).values()], sources: sourceAudit, transformations: ["只将基线datasetVersionId重映到新版本，原内容版本和全部既有事实保持。", "snapshot转monthly兼容契约，保留原起止日期与观察快照标签，不扩展为整月或全年。", "intermediate归入component，process保持工艺类别。", "逐记录保留来源期间，DOE1997不重写为2026。", "短摘要供首层浏览，完整研究说明保留在本审计与原研究中。", "主题技术关系不建立企业间供货；官网链接供用户自行访问。", "同向同类主题关系取最近有来源的一条；旧记录及原期间完整保留originalRecords，不混合为同一观察。"], originalRecords: { topics, relations, organizations }, topicItemCrosswalk: normalizedTopics.filter(topic => topic.itemIds?.length).map(topic => ({ topicId: topic.id, itemIds: topic.itemIds, period: topic.period, unit: "not_applicable", method: "curated", dataStatus: "observed", datasetVersionId: datasetId, sourceIds: unique([...topic.sourceIds, ...topic.itemIds.flatMap(id => fixture.items.find(item => item.id === id).sourceIds)]), scope: "同类功能、材料类别或工序投入产出的研究索引；不是特定机型BOM、当前工厂工艺或企业供货证据。", notes: topic.id === "coil-expansion" ? "关联穿管半成品为扩管步骤投入；不将其命名为已扩管产出。" : topic.id === "hvaccore22-r32" ? "R32链接到通用制冷剂类别；不将历史工艺工质改为R32。" : "保留产业资料与既有商品事实各自年份。" })), counts: { topics: normalizedTopics.length, relations: normalizedRelations.length, organizations: normalizedOrganizations.length, officialLinks: normalizedOrganizations.reduce((sum, organization) => sum + organization.links.length, 0), researchSources: sourceMap.size }, validation: { activeManifestChanged: false, baseReleaseChanged: false, runtimeExternalCalls: false, mockRecordsAdded: false } };
  const fixtureBytes = json(fixture), auditBytes = json(audit);
  const manifest = { schemaVersion: "fixture-manifest.v1", fixtures: [{ productId, path: "fixture.json" }], datasetVersion: version, generatedAt: reviewedAt, fixtureSha256: hash(fixtureBytes), release: { productId, datasetVersion: version, releasePath: `releases/${productId}/${version}`, immutable: true }, evidenceReview: { batchId: audit.batchId, contentSource: chinaHvacResearchPath, contentPathBase: "repository-root", contentSha256: hash(researchBytes), auditPath: "review-audit.json", auditPathBase: "release-directory", auditSha256: hash(auditBytes) } };
  return { fixture, audit, manifest, files: { "fixture.json": fixtureBytes, "review-audit.json": auditBytes, "manifest.json": json(manifest) } };
}

async function writeOutput(path, bytes, immutable) {
  await mkdir(dirname(path), { recursive: true });
  if (!immutable) { await writeFile(path, bytes); return; }
  try { await writeFile(path, bytes, { flag: "wx" }); }
  catch (error) { if (error.code !== "EEXIST") throw error; assert(await readFile(path, "utf8") === bytes, `Immutable output already differs: ${path}`); }
}
async function main() {
  const args = process.argv.slice(2);
  assert(args.every(arg => arg === "--prepare-release"), "Usage: node scripts/build-china-hvac-network.mjs [--prepare-release]");
  const result = await buildChinaHvacNetwork();
  const immutable = args.includes("--prepare-release");
  if (immutable) {
    const check = spawnSync(process.execPath, [resolve(repositoryRoot, "node_modules/vitest/vitest.mjs"), "run", "tests/china-hvac-release.test.ts"], { cwd: repositoryRoot, stdio: "inherit" });
    assert(check.status === 0, "China HVAC contracts must pass before preparing release");
  }
  const output = immutable ? `data/published/releases/${productId}/${version}` : "data/candidates/china-hvac-2026-2";
  for (const [name, bytes] of Object.entries(result.files)) await writeOutput(resolve(repositoryRoot, output, name), bytes, immutable);
  console.log(json({ status: "prepared-not-activated", output, ...result.audit.counts, fixtureSha256: result.manifest.fixtureSha256, activeManifestChanged: false }));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
