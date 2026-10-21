import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const chinaHvacEquipmentBasePath = "data/published/releases/generic-home-air-conditioner/globe-chain-home-air-conditioner-2026.2/fixture.json";
export const chinaHvacEquipmentResearchPath = "content/industry/china-hvac-equipment-supplement-2026-10-22.json";
const expectedBaseHash = "78028e78b4e2293ae59af289968afa7471867405d428666abefc6bb496eb1a33";
const expectedResearchHash = "e4cce3382176de24c2e19ab443ea557184f4558b8a1a362fb43b50b4261b5aca";
const productId = "generic-home-air-conditioner", version = "globe-chain-home-air-conditioner-2026.3";
const datasetId = "dataset-home-air-conditioner-2026-3", reviewedAt = "2026-10-22";
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const unique = values => [...new Set(values)];
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const sourceId = id => `source-china-hvac-${id}`;
async function readPinned(root, path, expected) {
  const absolute = resolve(root, path), child = relative(root, absolute);
  assert(child && !isAbsolute(child) && child !== ".." && !child.startsWith("..\\") && !child.startsWith("../"), `Unsafe input path: ${path}`);
  const bytes = await readFile(absolute);
  if (expected) assert(hash(bytes) === expected, `Reviewed input hash changed: ${path}`);
  return bytes;
}
function remap(value, previous) {
  if (Array.isArray(value)) return value.map(child => remap(child, previous));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, key === "datasetVersionId" && child === previous ? datasetId : remap(child, previous)]));
}
function normalizePeriod(period) {
  assert(period && /^\d{4}-\d{2}-\d{2}$/.test(period.start) && /^\d{4}-\d{2}-\d{2}$/.test(period.end) && period.start <= period.end, "Invalid industry period");
  assert(["annual", "quarterly", "monthly", "snapshot"].includes(period.granularity), "Unsupported industry period");
  return { ...period, granularity: period.granularity === "snapshot" ? "monthly" : period.granularity };
}
function meta(record) {
  assert(record.status === "validated" && record.sourceIds?.length, "Unreviewed or unsourced industry record");
  return { period: normalizePeriod(record.period), unit: "not_applicable", method: "curated", dataStatus: "observed", datasetVersionId: datasetId, sourceIds: unique(record.sourceIds.map(sourceId)) };
}
function linksFor(organization, sources) {
  const links = [
    ...(organization.links ?? []),
    ...(organization.productUrl ? [{ label: organization.productUrl === organization.contactUrl ? "产品与联系" : "官方产品", kind: organization.productUrl === organization.contactUrl ? "contact" : "product", url: organization.productUrl }] : []),
    ...(organization.contactUrl ? [{ label: "联系企业", kind: "contact", url: organization.contactUrl }] : []),
    ...organization.sourceIds.map(id => sources.get(id)).filter(source => source?.url).map(source => ({ label: source.name, kind: source.url === organization.contactUrl ? "contact" : "product", url: source.url }))
  ];
  const seen = new Set();
  return links.filter(link => { assert(/^https?:\/\//.test(link.url), `Unsafe official link: ${link.url}`); if (seen.has(link.url)) return false; seen.add(link.url); return true; });
}

/** Append-only reviewed equipment/service expansion; no network calls or activation. */
export async function buildChinaHvacEquipment(root = repositoryRoot) {
  const baseBytes = await readPinned(root, chinaHvacEquipmentBasePath, expectedBaseHash);
  const researchBytes = await readPinned(root, chinaHvacEquipmentResearchPath, expectedResearchHash);
  const baseline = JSON.parse(baseBytes), research = JSON.parse(researchBytes);
  assert(research.schemaVersion === "china-hvac-research.v1" && research.status === "validated", "Unreviewed equipment research");
  const fixture = remap(baseline, baseline.datasetVersion.id), network = fixture.industryNetwork;
  assert(network?.schemaVersion === "industry-network.v1", "Equipment expansion requires an existing industry network");
  const inputs = [{ path: chinaHvacEquipmentBasePath, sha256: hash(baseBytes) }, { path: chinaHvacEquipmentResearchPath, sha256: hash(researchBytes) }];
  const sourceMap = new Map(), sourceAudit = [];
  const existingSources = new Set(fixture.sources.map(source => source.id));
  for (const source of research.sources) {
    assert(source.httpStatus === 200 && /^[a-f0-9]{64}$/.test(source.sha256), `Unusable equipment source: ${source.id}`);
    assert(!existingSources.has(sourceId(source.id)) && !sourceMap.has(source.id), `Duplicate equipment source: ${source.id}`);
    const raw = await readPinned(root, source.rawFile, source.sha256);
    inputs.push({ path: source.rawFile, sha256: hash(raw) });
    const linked = [];
    for (const id of source.linkedRawIds ?? []) {
      const path = `${dirname(source.rawFile).replaceAll("\\", "/")}/manifest-additional.json`;
      const bytes = await readPinned(root, path);
      const manifest = JSON.parse(bytes), entries = Array.isArray(manifest) ? manifest : manifest.entries;
      const entry = entries.find(row => row.id === id);
      assert(entry?.httpStatus === 200 && (entry.rawFile || entry.file), `Missing linked equipment body: ${id}`);
      const rawPath = entry.rawFile ?? `${dirname(source.rawFile).replaceAll("\\", "/")}/${entry.file}`;
      const body = await readPinned(root, rawPath, entry.sha256);
      assert(body.length === entry.bytes, `Linked equipment body changed: ${id}`);
      inputs.push({ path, sha256: hash(bytes) }, { path: rawPath, sha256: hash(body) });
      linked.push({ id, path: rawPath, sha256: hash(body), url: entry.url });
    }
    sourceMap.set(source.id, source);
    sourceAudit.push({ id: source.id, sourceId: sourceId(source.id), rawFile: source.rawFile, sha256: source.sha256, retrievedAt: source.retrievedAt, locator: source.locator, period: source.period, linked });
    fixture.sources.push({ id: sourceId(source.id), name: source.name, publisher: source.publisher, url: source.url, publishedAt: source.publishedAt, retrievedAt: source.retrievedAt, license: source.license, datasetVersion: source.datasetVersion ?? research.datasetVersion, notes: `${source.locator} ${source.scope ?? ""} Snapshot: ${source.rawFile}; SHA256=${source.sha256}; originalPeriod=${JSON.stringify(source.period)}.` });
  }
  const newTopics = research.topics.map(topic => ({ id: topic.id, label: topic.label, kind: topic.kind === "intermediate" ? "component" : topic.kind, description: topic.displayDescription ?? topic.description, ...(topic.itemIds?.length ? { itemIds: topic.itemIds } : {}), ...meta(topic) }));
  const topicIds = new Set(network.topics.map(topic => topic.id));
  for (const topic of newTopics) { assert(!topicIds.has(topic.id), `Duplicate equipment topic: ${topic.id}`); topicIds.add(topic.id); }
  const topicLabels = new Map([...network.topics, ...newTopics].map(topic => [topic.id, topic.label]));
  const newRelations = research.relations.map((relation, index) => ({ id: relation.id ?? `china-hvac-equipment-relation-${index + 1}`, fromTopicId: relation.fromTopicId, toTopicId: relation.toTopicId, kind: relation.kind, description: relation.displayDescription ?? (relation.kind === "sold_through" ? "查看官方产品或服务入口。" : `${topicLabels.get(relation.fromTopicId)}${relation.kind === "process_input" ? "进入" : "用于"}${topicLabels.get(relation.toTopicId)}。`), ...meta(relation) }));
  const relationKeys = new Set(network.relations.map(relation => `${relation.fromTopicId}|${relation.toTopicId}|${relation.kind}`));
  for (const relation of newRelations) {
    const key = `${relation.fromTopicId}|${relation.toTopicId}|${relation.kind}`;
    assert(!relationKeys.has(key), `Duplicate equipment relationship: ${key}`); relationKeys.add(key);
    assert(topicIds.has(relation.fromTopicId) && topicIds.has(relation.toTopicId) && relation.fromTopicId !== relation.toTopicId, `Unknown equipment relationship topic: ${relation.id}`);
  }
  const newOrganizations = research.organizations.map(organization => ({ id: organization.id, name: organization.name, description: organization.displayDescription ?? organization.description, topicIds: organization.topicIds, links: linksFor(organization, sourceMap), ...meta(organization) }));
  const organizationIds = new Set(network.organizations.map(organization => organization.id));
  for (const organization of newOrganizations) { assert(!organizationIds.has(organization.id), `Duplicate equipment organization: ${organization.id}`); organizationIds.add(organization.id); }
  const extensions = [];
  for (const extension of research.organizationExtensions ?? []) {
    const organization = network.organizations.find(row => row.id === extension.id);
    assert(organization, `Unknown organization extension: ${extension.id}`);
    const before = structuredClone(organization), metadata = meta(extension);
    assert(extension.topicIds?.length && extension.links?.length, `Incomplete organization extension: ${extension.id}`);
    organization.topicIds = unique([...organization.topicIds, ...extension.topicIds]);
    organization.sourceIds = unique([...organization.sourceIds, ...metadata.sourceIds]);
    const seenLinks = new Set(organization.links.map(link => link.url));
    for (const link of extension.links) {
      assert(/^https?:\/\//.test(link.url), `Unsafe extension link: ${link.url}`);
      if (!seenLinks.has(link.url)) { organization.links.push(link); seenLinks.add(link.url); }
    }
    const start = [before.period.start, metadata.period.start].sort()[0], end = [before.period.end, metadata.period.end].sort().at(-1);
    organization.period = { granularity: start.slice(0, 7) === end.slice(0, 7) ? "monthly" : "annual", start, end, label: `${start}—${end} 官网观察资料` };
    extensions.push({ id: extension.id, before, addition: extension, after: structuredClone(organization), method: "curated", notes: "保留旧名称、用途和全部能力/入口，仅追加新能力和官方服务；期间为两次网页观察范围，原记录与新增资料期间分别保留。" });
  }
  network.topics.push(...newTopics); network.relations.push(...newRelations); network.organizations.push(...newOrganizations);
  network.sourceIds = unique([...network.sourceIds, ...research.sources.map(source => sourceId(source.id))]);
  const allSourceIds = new Set(fixture.sources.map(source => source.id));
  for (const record of [network, ...network.topics, ...network.relations, ...network.organizations]) assert(record.sourceIds.every(id => allSourceIds.has(id)), `Unknown equipment source reference: ${record.id}`);
  for (const topic of network.topics) assert((topic.itemIds ?? []).every(id => fixture.items.some(item => item.id === id)), `Unknown equipment product correspondence: ${topic.id}`);
  for (const organization of network.organizations) assert(organization.topicIds.every(id => topicIds.has(id)) && organization.links.length, `Unknown organization capability: ${organization.id}`);
  fixture.contentVersions.push({ id: "content-china-hvac-equipment-2026-3", version: "china-hvac-equipment-content-2026.3", status: "published", publishedAt: reviewedAt, notes: "追加现代制造设备和官方售后与网点导航；保留旧产业环节、商品、工艺和贸易事实。" });
  fixture.datasetVersion = { ...fixture.datasetVersion, id: datasetId, version, publishedAt: reviewedAt, sourceIds: fixture.sources.map(source => source.id), notes: "在2026.2基础上追加现代制造设备与官方服务入口；各来源保留实际期间，企业公开能力与商业供货分开。" };
  const audit = { schemaVersion: "china-hvac-equipment-release-review.v1", batchId: "china-hvac-equipment-2026-10-22", reviewedAt, productId, datasetVersion: version, base: { path: chinaHvacEquipmentBasePath, sha256: expectedBaseHash }, inputs: [...new Map(inputs.map(input => [input.path, input])).values()], sources: sourceAudit, originalRecords: research, organizationExtensions: extensions, transformations: ["固定2026.2基线，递归将datasetVersionId重映为2026.3，其余旧事实保持。", "新技术关系和企业能力仅追加；同向同类重复关系拒绝，不猜测商业供货。", "官网snapshot以monthly承载，精确保留观察起止日；1997工艺保持原年。", "已有企业扩展只追加能力/来源/官方入口，保留旧记录和新观察各自期间，不重复计算企业。"], added: { topics: newTopics.length, relations: newRelations.length, organizations: newOrganizations.length, sources: research.sources.length }, counts: { topics: network.topics.length, relations: network.relations.length, organizations: network.organizations.length, officialLinks: network.organizations.reduce((sum, organization) => sum + organization.links.length, 0), researchSources: network.sourceIds.length }, validation: { activeManifestChanged: false, baseReleaseChanged: false, runtimeExternalCalls: false, mockRecordsAdded: false } };
  const fixtureBytes = json(fixture), auditBytes = json(audit);
  const manifest = { schemaVersion: "fixture-manifest.v1", fixtures: [{ productId, path: "fixture.json" }], datasetVersion: version, generatedAt: reviewedAt, fixtureSha256: hash(fixtureBytes), release: { productId, datasetVersion: version, releasePath: `releases/${productId}/${version}`, immutable: true }, evidenceReview: { batchId: audit.batchId, contentSource: chinaHvacEquipmentResearchPath, contentPathBase: "repository-root", contentSha256: hash(researchBytes), auditPath: "review-audit.json", auditPathBase: "release-directory", auditSha256: hash(auditBytes) } };
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
  assert(args.every(arg => arg === "--prepare-release"), "Usage: node scripts/build-china-hvac-equipment.mjs [--prepare-release]");
  const result = await buildChinaHvacEquipment();
  const immutable = args.includes("--prepare-release");
  if (immutable) {
    const check = spawnSync(process.execPath, [resolve(repositoryRoot, "node_modules/vitest/vitest.mjs"), "run", "tests/china-hvac-equipment-release.test.ts"], { cwd: repositoryRoot, stdio: "inherit" });
    assert(check.status === 0, "HVAC equipment contracts must pass before preparing release");
  }
  const output = immutable ? `data/published/releases/${productId}/${version}` : "data/candidates/china-hvac-2026-3";
  for (const [name, bytes] of Object.entries(result.files)) await writeOutput(resolve(repositoryRoot, output, name), bytes, immutable);
  console.log(json({ status: "prepared-not-activated", output, ...result.audit.counts, fixtureSha256: result.manifest.fixtureSha256, activeManifestChanged: false }));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error.message); process.exitCode = 1; });
