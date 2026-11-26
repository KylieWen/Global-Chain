import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const cameraDroneInputPath = "data/research/drone-2026-11-26/research-input.json";
export const cameraDronePartsPath = "data/research/drone-2026-11-26/extracts/parts-tables.json";
const hash = (value) => createHash("sha256").update(value).digest("hex");
const hashText = (value) => hash(Buffer.from(value, "utf8"));
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const unique = (values) => [...new Set(values)];
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const sameHash = (actual, expected) => actual.toLowerCase() === String(expected).toLowerCase();

async function readPinned(repositoryRoot, path, expected) {
  const absolute = resolve(repositoryRoot, path);
  const child = relative(repositoryRoot, absolute);
  assert(child && !isAbsolute(child) && !child.startsWith(".."), `Unsafe input path: ${path}`);
  const bytes = await readFile(absolute);
  assert(sameHash(hash(bytes), expected), `Reviewed source hash changed: ${path}`);
  return bytes;
}

/** Offline and deterministic: no network calls, current clock or active-manifest writes. */
export async function buildCameraDrone(repositoryRoot = root) {
  const inputBytes = await readFile(resolve(repositoryRoot, cameraDroneInputPath));
  const input = JSON.parse(inputBytes.toString("utf8"));
  const partsBytes = await readFile(resolve(repositoryRoot, cameraDronePartsPath));
  const parts = JSON.parse(partsBytes.toString("utf8"));

  const identity = input.identity;
  assert(identity.productId === "generic-camera-drone", "Camera drone identity requires a new research input");
  const ds = identity.datasetVersion;
  const cv = identity.contentVersion;
  const period = identity.period;

  // Pin the official DJI snapshot and the shared HS2022 H6 classification dictionary.
  const normalizeSha = (value) => String(value).toLowerCase();
  const djiSource = { ...input.sources.find((source) => source.id === "source-dji-parts"), rawSha256: normalizeSha(input.sources.find((source) => source.id === "source-dji-parts").rawSha256) };
  const hsSource = { ...input.sources.find((source) => source.id === "source-hs2022-h6"), rawSha256: normalizeSha(input.sources.find((source) => source.id === "source-hs2022-h6").rawSha256) };
  const curationSource = input.sources.find((source) => source.id === "source-drone-curation");
  assert(djiSource && hsSource && curationSource, "Research input sources are incomplete");
  const htmlBytes = await readPinned(repositoryRoot, djiSource.rawPath, djiSource.rawSha256);
  const metaBytes = await readFile(resolve(repositoryRoot, "data/research/drone-2026-11-26/raw/dji-support-zh-cn03400007809.html.meta.json"));
  const meta = JSON.parse(metaBytes.toString("utf8"));
  assert(sameHash(meta.sha256, djiSource.rawSha256), "DJI snapshot metadata hash mismatch");
  const hsBytes = await readPinned(repositoryRoot, hsSource.rawPath, hsSource.rawSha256);

  const dictionary = JSON.parse(hsBytes.toString("utf8"));
  assert(dictionary.classCode === "H6" && dictionary.className === "HS2022", "Unverified HS2022 H6 dictionary identity");
  const heading = dictionary.results.find((row) => row.id === input.classification.headingCode);
  assert(heading && heading.aggrlevel === 4 && /Unmanned aircraft/.test(heading.text), "Unverified HS8806 heading identity");
  const subheadings = dictionary.results.filter((row) => /^8806\d{2}$/.test(row.id));

  // Map every official part name to a curated generic node; the official wording stays in the audit.
  const nameToNode = new Map();
  for (const node of input.bom) {
    for (const officialName of node.officialNames) {
      assert(!nameToNode.has(officialName), `Duplicate official name mapping: ${officialName}`);
      nameToNode.set(officialName, node.id);
    }
  }

  const partsAudit = [];
  const officialNamesSeen = new Set();
  const modelsSeen = new Set();
  const categoriesSeen = new Set();
  let rowIndex = 0;
  for (const table of parts.tables) {
    modelsSeen.add(table.model);
    for (const row of table.rows) {
      if (!row.partName) continue;
      rowIndex += 1;
      const mappedNodeId = nameToNode.get(row.partName);
      assert(mappedNodeId, `Official part name has no curated node: ${row.partName}`);
      categoriesSeen.add(row.category);
      officialNamesSeen.add(row.partName);
      const original = { category: row.category, partName: row.partName, priceCNY: row.priceCNY };
      const rawRowSha256 = hashText(JSON.stringify(original));
      partsAudit.push({
        auditId: `audit-drone-part-${String(rowIndex).padStart(3, "0")}`,
        model: table.model,
        officialCategory: row.category,
        officialPartName: row.partName,
        officialPriceCNY: row.priceCNY,
        officialPriceCNYNormalized: row.priceCNY ? row.priceCNY.replace(/[^\d.]/g, "") : null,
        mappedNodeId,
        sourceId: djiSource.id,
        snapshotPath: djiSource.rawPath,
        snapshotSha256: djiSource.rawSha256,
        rawRowSha256,
        original
      });
    }
  }
  assert(partsAudit.length === 86, `Expected 86 official part rows, got ${partsAudit.length}`);
  assert(modelsSeen.size === 9, `Expected 9 DJI Mini models, got ${modelsSeen.size}`);
  assert(categoriesSeen.size === 3, `Expected 3 official categories, got ${categoriesSeen.size}`);
  assert(officialNamesSeen.size === 35, `Expected 35 distinct official part names, got ${officialNamesSeen.size}`);
  for (const officialName of nameToNode.keys()) {
    assert(officialNamesSeen.has(officialName), `Curated name missing from official table: ${officialName}`);
  }

  const sourceRecords = input.sources.map(({ rawPath: _rawPath, rawSha256: _rawSha256, ...source }) => source);
  const sourceById = new Map(sourceRecords.map((source) => [source.id, source]));

  const common = { method: "curated", datasetVersionId: ds.id, contentVersionId: cv.id };
  const allItemIds = input.bom.map((node) => node.id);
  const componentItemIds = input.bom.filter((node) => node.parentItemId !== null).map((node) => node.id);

  const evidence = [];
  const curationEvidenceId = "evidence-drone-curation";
  const partsEvidenceId = "evidence-drone-parts";
  const classificationEvidenceId = "evidence-drone-classification";

  evidence.push({
    id: curationEvidenceId,
    sourceId: curationSource.id,
    supportType: "curation_method",
    scope: {
      entityIds: [],
      fromEntityId: null,
      toEntityId: null,
      itemIds: allItemIds,
      processStageIds: [],
      processStepIds: [],
      equipmentCategoryIds: [],
      organizationIds: [],
      classificationCodes: [],
      direction: null,
      period,
      scopeDescription: "把官方维修表中同类别配件名合并为通用组件节点的策展范围；型号差异、版本后缀与维修报价保留在审计记录。",
      supportsCountryRole: false,
      supportsBilateralFlow: false,
      supportsProcessContext: false,
      supportsManufacturerCapability: false,
      supportsCommercialRelationship: false,
      supportsPolicyGuidance: false,
      limitations: input.story.limitations
    },
    locator: `${cameraDroneInputPath}; SHA-256=${hash(inputBytes)}`,
    excerpt: null,
    notes: "通用层级为策展抽象，不代表任一具体型号的完整物料清单。"
  });

  evidence.push({
    id: partsEvidenceId,
    sourceId: djiSource.id,
    supportType: "process_context",
    scope: {
      entityIds: [],
      fromEntityId: null,
      toEntityId: null,
      itemIds: componentItemIds,
      processStageIds: [],
      processStepIds: [],
      equipmentCategoryIds: [],
      organizationIds: [],
      classificationCodes: [],
      direction: null,
      period,
      scopeDescription: "官方维修部件表列出的飞行器、云台、遥控器部件分类与配件名称；仅说明部件层级，不描述制造工序、产地或供应商。",
      supportsCountryRole: false,
      supportsBilateralFlow: false,
      supportsProcessContext: true,
      supportsManufacturerCapability: false,
      supportsCommercialRelationship: false,
      supportsPolicyGuidance: false,
      limitations: input.story.limitations
    },
    locator: `${djiSource.rawPath}; SHA-256=${djiSource.rawSha256}; ${djiSource.url}`,
    excerpt: null,
    notes: "官方单价为维修备件 CNY 报价，仅作为备件事实留存审计，不进入成本、利润或零售价结论。"
  });

  evidence.push({
    id: classificationEvidenceId,
    sourceId: hsSource.id,
    supportType: "classification",
    scope: {
      entityIds: [],
      fromEntityId: null,
      toEntityId: null,
      itemIds: [identity.productId],
      processStageIds: [],
      processStepIds: [],
      equipmentCategoryIds: [],
      organizationIds: [],
      classificationCodes: [{ system: "HS", version: "2022", code: input.classification.headingCode, mappingType: "aggregate", description: input.classification.limitation }],
      direction: null,
      period,
      scopeDescription: "HS2022 品目 8806 分类参考；不证明具体六位子目、最终用途或供应链关系。",
      supportsCountryRole: false,
      supportsBilateralFlow: false,
      supportsProcessContext: false,
      supportsManufacturerCapability: false,
      supportsCommercialRelationship: false,
      supportsPolicyGuidance: false,
      limitations: [input.classification.limitation]
    },
    locator: `${hsSource.rawPath}; SHA-256=${hsSource.rawSha256}; HS2022 H6 reference`,
    excerpt: heading.text,
    notes: "分类字典为共享本地快照，不是贸易观测。"
  });

  const items = input.bom.map((node) => ({
    id: node.id,
    slug: node.id,
    name: node.name,
    itemType: node.itemType,
    parentItemId: node.parentItemId,
    category: identity.productCategory,
    description: node.description,
    sourceIds: [djiSource.id, curationSource.id],
    method: "curated",
    dataStatus: "observed",
    datasetVersionId: ds.id,
    validPeriod: period
  }));

  const nodes = input.bom.map((node) => ({
    id: `node-drone-${node.id}`,
    nodeType: "item",
    label: node.name,
    entityId: null,
    itemId: node.id,
    itemType: node.itemType,
    processStageId: null,
    period,
    sourceIds: [djiSource.id, curationSource.id],
    evidenceIds: [curationEvidenceId, partsEvidenceId],
    evidenceLevel: "representative",
    method: "curated",
    dataStatus: "unknown",
    datasetVersionId: ds.id,
    contentVersionId: cv.id,
    notes: node.officialCategory ? `官方分类：${node.officialCategory}` : null
  }));

  const rootNodeId = `node-drone-${identity.productId}`;

  const classificationCode = {
    id: "hs-2022-8806",
    system: "HS",
    version: "2022",
    code: input.classification.headingCode,
    level: heading.aggrlevel,
    label: heading.text,
    validPeriod: period,
    sourceIds: [hsSource.id],
    method: "official",
    dataStatus: "observed",
    datasetVersionId: ds.id
  };
  const classificationCrosswalk = {
    id: "crosswalk-drone-hs8806",
    itemId: identity.productId,
    classificationCodeId: classificationCode.id,
    mappingType: input.classification.mappingType,
    confidence: null,
    notes: "通用航拍无人机对应 HS2022 品目 8806（无人驾驶航空器）；具体六位子目取决于最大起飞重量与操控方式，本批无重量与操控观测。",
    limitation: input.classification.limitation,
    period,
    sourceIds: [hsSource.id, curationSource.id],
    method: "curated",
    dataStatus: "observed",
    datasetVersionId: ds.id
  };

  const gaps = input.gaps.map((gap) => ({
    gapId: gap.id,
    nodeId: rootNodeId,
    flowId: null,
    currentClaim: gap.currentClaim,
    currentEvidenceLevel: "none",
    missingEvidence: gap.missingEvidence,
    acceptableEvidenceTypes: gap.acceptableEvidenceTypes,
    candidateSources: gap.candidateSources,
    classificationCandidates: gap.id === "gap-drone-trade-8806"
      ? [{ system: "HS", version: "2022", code: input.classification.headingCode, label: heading.text, mappingType: "aggregate", limitation: input.classification.limitation, supportsEndUse: false }]
      : [],
    status: "open",
    nonInferences: gap.nonInferences,
    evidenceIds: [],
    period,
    method: "curated",
    datasetVersionId: ds.id,
    contentVersionId: cv.id
  }));

  const steps = input.story.steps.map((step, order) => ({
    id: `step-drone-${step.order}`,
    order,
    title: step.title,
    description: step.description,
    nodeIds: step.nodeRefs.map((ref) => `node-drone-${ref}`),
    flowIds: [],
    evidenceIds: [curationEvidenceId],
    method: "curated",
    contentStatus: "published",
    contentVersionId: cv.id
  }));

  const fixture = {
    schemaVersion: "product-fixture.v1",
    productId: identity.productId,
    datasetVersion: {
      id: ds.id,
      name: ds.name,
      version: ds.version,
      publishedAt: ds.publishedAt,
      sourceIds: sourceRecords.map((source) => source.id),
      coverage: null,
      status: "published",
      notes: "结构参照 DJI Mini 系列官方维修部件表；本批无贸易、产地、材料、工序与供应商观测，相关维度保持空态并登记证据缺口。"
    },
    contentVersions: [{ id: cv.id, version: cv.version, status: "published", publishedAt: cv.publishedAt, notes: input.story.limitations.join(" ") }],
    sources: sourceRecords,
    evidence,
    evidenceGaps: gaps,
    entities: [],
    items,
    processStages: [],
    productionActivities: [],
    classificationCodes: [classificationCode],
    classificationCrosswalks: [classificationCrosswalk],
    storyGraph: {
      productId: identity.productId,
      period,
      method: "curated",
      representativeStatement: input.story.representativeStatement,
      methodology: input.story.methodology,
      limitations: input.story.limitations,
      nodes,
      flows: [],
      steps,
      datasetVersionId: ds.id,
      contentVersionId: cv.id,
      warnings: ["本批无 HS2022 8806 贸易观测、无国家角色与材料/工序证据；部件层级为结构参照，不含产地、供应商或贸易连线。"]
    },
    tradeObservations: [],
    materialTradeObservations: [],
    macroIndicators: [],
    indicatorDefinitions: [],
    organizations: [],
    facilities: [],
    manufacturingProcessChains: [],
    manufacturingRouteVariants: [],
    manufacturingProcessSteps: [],
    equipmentCategories: [],
    processRequirements: [],
    organizationCapabilities: [],
    tradeGuides: [],
    tariffMeasures: [],
    tradeRequirements: [],
    tradeProcedures: [],
    tradeProcedureSteps: [],
    tradeDocumentRequirements: [],
    policyDocuments: [],
    missingDataNotes: [
      ...input.story.limitations,
      `购买提示仅提及而未列入维修报价表的项目：${input.officialTable.purchaseNoteOnly.join("、")}；本批不据此建立 BOM 节点。`
    ],
    warnings: ["仅有官方维修部件表结构参照；贸易账本、国家角色、材料配比、工序设备与供应商均为空态，缺失不等于零。"]
  };

  const bomNodeTree = input.bom.map((node) => ({
    id: node.id,
    depth: node.depth,
    itemType: node.itemType,
    parentItemId: node.parentItemId,
    name: node.name,
    officialCategory: node.officialCategory,
    mappedOfficialNames: node.officialNames
  }));

  const audit = {
    schemaVersion: "camera-drone-review.v1",
    batchId: "camera-drone-structure-2026-1",
    reviewedAt: ds.publishedAt,
    datasetVersion: ds.version,
    inputs: {
      researchInput: { path: cameraDroneInputPath, sha256: hash(inputBytes) },
      partsTables: { path: cameraDronePartsPath, sha256: hash(partsBytes) },
      snapshots: [
        { alias: "dji-parts", path: djiSource.rawPath, sha256: djiSource.rawSha256, retrievedAt: djiSource.retrievedAt, url: djiSource.url },
        { alias: "hs2022-h6", path: hsSource.rawPath, sha256: hsSource.rawSha256, retrievedAt: hsSource.retrievedAt, url: hsSource.url }
      ]
    },
    partsAudit,
    purchaseNoteOnly: input.officialTable.purchaseNoteOnly,
    structuralReference: input.officialTable.structuralReference,
    classification: {
      classCode: dictionary.classCode,
      className: dictionary.className,
      original: heading,
      subheadings,
      mappingType: input.classification.mappingType
    },
    counts: {
      items: fixture.items.length,
      modules: input.bom.filter((node) => node.depth === 1).length,
      components: input.bom.filter((node) => node.depth === 2).length,
      storyNodes: nodes.length,
      storyFlows: 0,
      partsRows: partsAudit.length,
      mappedRows: partsAudit.length,
      unmappedRows: 0,
      distinctOfficialNames: officialNamesSeen.size,
      models: modelsSeen.size,
      officialCategories: categoriesSeen.size,
      tradeObservations: 0,
      entities: 0,
      evidenceGaps: gaps.length
    },
    validation: {
      offline: true,
      activeManifestChanged: false,
      sourceHashesVerified: true,
      absentTradeRecordIsZero: false,
      publication: "candidate first; activation only through the official release tooling"
    },
    limitations: input.story.limitations
  };

  const fixtureText = json(fixture);
  const auditText = json(audit);
  const manifest = {
    schemaVersion: "fixture-manifest.v1",
    fixtures: [{ productId: identity.productId, path: "fixture.json", datasetVersion: ds.version, fixtureSha256: hashText(fixtureText) }],
    datasetVersion: ds.version,
    generatedAt: ds.publishedAt.slice(0, 10),
    fixtureSha256: hashText(fixtureText),
    notes: [fixture.datasetVersion.notes],
    release: { productId: identity.productId, datasetVersion: ds.version, releasePath: `releases/${identity.productId}/${ds.version}`, immutable: true },
    evidenceReview: {
      batchId: audit.batchId,
      contentSource: cameraDroneInputPath,
      contentPathBase: "repository-root",
      contentSha256: hash(inputBytes),
      auditPath: "review-audit.json",
      auditPathBase: "release-directory",
      auditSha256: hashText(auditText)
    }
  };

  return {
    config: input,
    fixture,
    audit,
    manifest,
    bomNodeTree,
    files: { "fixture.json": fixtureText, "manifest.json": json(manifest), "review-audit.json": auditText }
  };
}

async function writeImmutable(path, bytes) {
  await mkdir(dirname(path), { recursive: true });
  try {
    await writeFile(path, bytes, { flag: "wx" });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    assert(await readFile(path, "utf8") === bytes, `Immutable output differs: ${path}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  assert(args.every((arg) => arg === "--prepare-release"), "Usage: node scripts/build-drone.mjs [--prepare-release]");
  const result = await buildCameraDrone();
  if (args.includes("--prepare-release")) {
    const check = spawnSync(process.execPath, [resolve(root, "node_modules/vitest/vitest.mjs"), "run", "tests/generic-camera-drone-release.test.ts"], { cwd: root, stdio: "inherit" });
    assert(check.status === 0, "Camera drone contracts and domain regression tests must pass before release preparation");
  }
  const output = args.includes("--prepare-release")
    ? `data/published/releases/${result.config.identity.productId}/${result.config.identity.datasetVersion.version}`
    : `data/candidates/camera-drone-structure-2026-1`;
  for (const [name, bytes] of Object.entries(result.files)) await writeImmutable(resolve(root, output, name), bytes);
  await writeImmutable(resolve(root, "data/research/drone-2026-11-26/extracts/bom-node-tree.json"), json(result.bomNodeTree));
  console.log(json({ status: args.includes("--prepare-release") ? "prepared-not-activated" : "candidate", output, fixtureSha256: result.manifest.fixtureSha256, ...result.audit.counts, activeManifestChanged: false }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
