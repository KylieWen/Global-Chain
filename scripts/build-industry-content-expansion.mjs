import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { activatePublishedRelease } from './lib/published-releases.mjs';

// Re-publish verified technical records as navigable upstream/downstream content.
// This does not infer geographic production, customers, trade or new suppliers.
const root = resolve(import.meta.dirname, '..');
const published = resolve(root, 'data/published');
const manifest = JSON.parse(await readFile(resolve(root, 'content/data-refresh/industry-content-expansion-2026-10-24.json'), 'utf8'));
const require = createRequire(import.meta.url);
const { createServer } = createRequire(require.resolve('vitest/package.json'))('vite');
const loader = await createServer({ root, configFile: false, logLevel: 'error', server: { middlewareMode: true, preTransformRequests: false }, appType: 'custom' });
const { ProductFixtureSchema } = await loader.ssrLoadModule('/packages/contracts/src/index.ts');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const stamp = '2026-10-24T01:45:00.000Z';
const results = [];
try {
  for (const entry of manifest.fixtures) {
    const originalBytes = await readFile(resolve(published, entry.path));
    if (hash(originalBytes) !== entry.fixtureSha256) throw new Error('Changed source release');
    const fixture = JSON.parse(originalBytes.toString('utf8'));
    const oldVersion = fixture.datasetVersion.version;
    const version = oldVersion.replace(/\.(\d+)$/, (_, value) => `.${Number(value) + 1}`);
    const directory = resolve(published, 'releases', entry.productId, version);
    const alreadyPublished = existsSync(directory);
    const oldId = fixture.datasetVersion.id;
    const id = `${oldId}-industry-expansion`;
    const replaceVersion = value => {
      if (!value || typeof value !== 'object') return;
      for (const [key, child] of Object.entries(value)) {
        if (key === 'datasetVersionId' && child === oldId) value[key] = id;
        else replaceVersion(child);
      }
    };
    replaceVersion(fixture);
    fixture.datasetVersion = { ...fixture.datasetVersion, id, version, name: `${fixture.datasetVersion.name} · 上下游内容扩充`, publishedAt: stamp };
    const product = fixture.items.find(item => item.id === entry.productId);
    const steps = fixture.manufacturingProcessSteps.filter(step => step.dataStatus === 'observed' && step.sourceIds.length);
    const itemById = new Map(fixture.items.map(item => [item.id, item]));
    const fact = record => ({ period: record.period ?? record.validPeriod, unit: 'not_applicable', method: 'curated', dataStatus: 'observed', datasetVersionId: id, sourceIds: [...record.sourceIds] });
    const oldNetwork = fixture.industryNetwork;
    const regionId = 'region-technical-reference';
    const anchor = steps[0];
    if (!anchor) throw new Error(`No verified process for ${entry.productId}`);
    if (!oldNetwork && !fixture.entities.some(entity => entity.id === regionId)) fixture.entities.push({ id: regionId, kind: 'region', name: '跨地区通用工艺资料', parentId: null, sourceIds: anchor.sourceIds, dataStatus: 'observed', method: 'curated', datasetVersionId: id, validPeriod: anchor.period });
    const network = oldNetwork ?? { schemaVersion: 'industry-network.v1', id: `${entry.productId}-technical-industry`, title: `${product.name}材料、制造与设备上下游`, regionEntityId: regionId, defaultTopicId: '', topics: [], relations: [], organizations: [], ...fact(anchor) };
    const before = { topics: network.topics.length, relations: network.relations.length, organizations: network.organizations.length };
    const topicById = new Map(network.topics.map(topic => [topic.id, topic]));
    const addTopic = topic => { if (!topicById.has(topic.id)) { network.topics.push(topic); topicById.set(topic.id, topic); } return topic.id; };
    const addItem = (itemId, step) => {
      const item = itemById.get(itemId);
      if (!item) throw new Error(`Missing item ${itemId}`);
      return addTopic({ id: `technical-item-${itemId}`, label: item.name, description: item.description || `${item.name}在已收录工艺中的投入或产出；可继续查看相关加工与设备。`, kind: item.itemType === 'final_product' ? 'product' : ['raw_material', 'material'].includes(item.itemType) ? 'material' : 'component', itemIds: [itemId], ...fact(step) });
    };
    const addRelation = (from, to, kind, record, description) => {
      if (from === to) return;
      const relationId = `technical-${from}-${to}-${kind}`;
      if (network.relations.some(relation => relation.id === relationId)) return;
      network.relations.push({ id: relationId, fromTopicId: from, toTopicId: to, kind, description, ...fact(record) });
    };
    const stepById = new Map();
    for (const step of steps) {
      const stepId = addTopic({ id: `technical-step-${step.id}`, label: step.name, description: step.description, kind: 'process', itemIds: [...new Set([...step.inputItemIds, ...step.outputItemIds])], ...fact(step) });
      stepById.set(step.id, stepId);
      for (const itemId of step.inputItemIds) addRelation(addItem(itemId, step), stepId, 'process_input', step, `${itemById.get(itemId).name}进入${step.name}。依据原工序投入记录，保留原资料期间；不指认企业间供货。`);
      for (const itemId of step.outputItemIds) addRelation(stepId, addItem(itemId, step), 'used_in', step, `${step.name}形成${itemById.get(itemId).name}。依据原工序产出记录，不附加产量、路线份额或地理归属。`);
    }
    const equipmentById = new Map(fixture.equipmentCategories.map(equipment => [equipment.id, equipment]));
    const equipmentTopics = new Map();
    for (const requirement of fixture.processRequirements) {
      const stepId = stepById.get(requirement.processStepId);
      const equipment = equipmentById.get(requirement.equipmentCategoryId);
      if (!stepId || !equipment || requirement.dataStatus !== 'observed' || !requirement.sourceIds.length) continue;
      const equipmentId = addTopic({ id: `technical-equipment-${equipment.id}`, label: equipment.name, description: equipment.description || requirement.description, kind: 'equipment', ...fact(requirement) });
      equipmentTopics.set(equipment.id, equipmentId);
      addRelation(equipmentId, stepId, 'equipment_for', requirement, requirement.description);
    }
    for (const organization of fixture.organizations) {
      const capabilities = fixture.organizationCapabilities.filter(capability => capability.organizationId === organization.id && capability.dataStatus === 'observed' && capability.capabilityEvidenceLevel === 'manufacturer_supported' && equipmentTopics.has(capability.equipmentCategoryId));
      if (!capabilities.length || !organization.website) continue;
      const topicIds = [...new Set(capabilities.map(capability => equipmentTopics.get(capability.equipmentCategoryId)))];
      network.organizations.push({ id: `technical-${organization.id}`, name: organization.name, description: capabilities.map(capability => capability.claim).join(' '), topicIds, links: [{ label: '企业官方网站', kind: 'product', url: organization.website }], ...fact(capabilities[0]), sourceIds: [...new Set(capabilities.flatMap(capability => capability.sourceIds))] });
    }
    if (!oldNetwork) network.defaultTopicId = topicById.has(`technical-item-${entry.productId}`) ? `technical-item-${entry.productId}` : stepById.values().next().value;
    fixture.industryNetwork = network;
    ProductFixtureSchema.parse(fixture);
    const bytes = Buffer.from(JSON.stringify(fixture, null, 2) + '\n');
    const audit = { batchId: 'industry-content-expansion-2026-10-24', baseVersion: oldVersion, basePath: entry.path, baseSha256: hash(originalBytes), method: 'Only observed process inputs/outputs/equipment and manufacturer-supported capabilities are projected into existing industry records. No new geographic/trade facts or inferred suppliers.', before, after: { topics: network.topics.length, relations: network.relations.length, organizations: network.organizations.length }, extractedAt: stamp };
    const auditBytes = Buffer.from(JSON.stringify(audit, null, 2) + '\n');
    const release = { schemaVersion: 'fixture-manifest.v1', fixtures: [{ productId: entry.productId, path: 'fixture.json' }], datasetVersion: version, generatedAt: '2026-10-24', fixtureSha256: hash(bytes), release: { productId: entry.productId, datasetVersion: version, releasePath: `releases/${entry.productId}/${version}`, immutable: true }, evidenceReview: { batchId: audit.batchId, auditPath: 'review-audit.json', auditSha256: hash(auditBytes) } };
    if (alreadyPublished) {
      if (hash(await readFile(resolve(directory, 'fixture.json'))) !== hash(bytes) || hash(await readFile(resolve(directory, 'review-audit.json'))) !== hash(auditBytes)) throw new Error('Changed immutable expansion');
      results.push({productId: entry.productId, version, ...audit.after, unchanged: true});
      continue;
    }
    await mkdir(directory, { recursive: true });
    await writeFile(resolve(directory, 'fixture.json'), bytes);
    await writeFile(resolve(directory, 'review-audit.json'), auditBytes);
    await writeFile(resolve(directory, 'manifest.json'), JSON.stringify(release, null, 2) + '\n');
    await activatePublishedRelease(published, { productId: entry.productId, datasetVersion: version });
    results.push({ productId: entry.productId, version, ...audit.after, addedTopics: audit.after.topics - before.topics, addedRelations: audit.after.relations - before.relations });
  }
  console.log(JSON.stringify(results));
} finally { await loader.close(); }
