import { createHash } from "node:crypto";
import { readFile, mkdtemp, mkdir, cp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { ProductFixtureSchema, type ProductFixture } from "@globe-chain/contracts";
import { loadFixtureRepositoryFromManifest } from "@globe-chain/db";
import { createInMemoryFixtureRepository, createProductQueryService, type ProductQueryService } from "@globe-chain/domain";
import { buildElectricBicycle, electricBicycleContentPath, electricBicycleReviewPath } from "../scripts/build-electric-bicycle.mjs";
import { createMapView } from "../apps/web/lib/map-view-model";

const productId = "generic-electric-bicycle";
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

describe("electric bicycle independent candidate", () => {
  let built: Awaited<ReturnType<typeof buildElectricBicycle>>;
  let fixture: ProductFixture;
  let queries: ProductQueryService;
  beforeAll(async () => {
    built = await buildElectricBicycle();
    fixture = ProductFixtureSchema.parse(built.fixture);
    queries = createProductQueryService(createInMemoryFixtureRepository([fixture]));
  });

  it("passes published contracts and makes every direct component inspectable through generic queries", () => {
    expect(fixture.datasetVersion.status).toBe("published");
    expect(fixture.items).toHaveLength(15);
    const overview = queries.getProductOverview(productId)!;
    expect(fixture.items.find(item => item.id === productId)?.name).toBe("通用电动自行车");
    expect(overview.directChildren).toHaveLength(10);
    expect(queries.getProductBreakdown(productId)?.children).toHaveLength(10);
    for (const component of overview.componentCoverage) {
      expect(component.hasInspectableStory || component.processChains.length > 0, component.item.id).toBe(true);
      expect(component.processChains.length, component.item.id).toBeGreaterThan(0);
      expect(component.processChains.some(chain => queries.getManufacturingProcessChain(productId, chain.id)!.steps.some(step => [...step.inputItems, ...step.outputItems].some(item => item.id === component.item.id))), component.item.id).toBe(true);
    }
    expect(queries.getSupplyChainStory(productId)?.steps).toHaveLength(3);
    expect(JSON.stringify(fixture).includes('"method":"mock"')).toBe(false);
    expect(fixture.items.some(item => /smartphone|soybean|cotton/.test(item.id))).toBe(false);
    expect(fixture.items.some(item => /本批|不指定|不代表|未核验|没有|不表示/.test(item.description ?? ""))).toBe(false);
    expect(fixture.processRequirements.some(requirement => /代表步骤|不代表|仅由|核验/.test(requirement.description))).toBe(false);
  });

  it("transforms all three original rows exactly and preserves independent quality and weight", async () => {
    const raw = JSON.parse(await readFile("data/raw/ebike-research/comtrade-china-871160-2024.json", "utf8"));
    expect(fixture.tradeObservations).toHaveLength(raw.data.length);
    expect(built.audit.rawRecords).toHaveLength(raw.data.length);
    for (const [index, row] of raw.data.entries()) {
      const fact = fixture.tradeObservations.find(record => record.partnerCode === row.partnerCode)!;
      expect(fact).toMatchObject({ reporterCode: 156, partnerCode: row.partnerCode, partner2Code: row.partner2Code, flowCode: "X", direction: "export", classificationSystem: "HS", classificationVersion: "2022", classificationCode: "871160", value: row.primaryValue, quantity: row.qty, currency: "USD", unit: "items", quantityDataStatus: "observed", valueDataStatus: "observed", sourceId: "source-ebike-trade", method: "official" });
      expect(fact.period.label).toBe("2024");
      for (const key of ["isQtyEstimated", "isNetWgtEstimated", "isReported", "isAggregate", "legacyEstimationFlag"] as const) expect(fact.quality?.[key]).toBe(row[key]);
      expect(fact.qualityNote).toContain(`"netWgt":${row.netWgt}`);
      expect(built.audit.rawRecords[index]).toMatchObject({ dataIndex: index, observationId: fact.id, original: row, rawRowSha256: hash(JSON.stringify(row)) });
    }
    expect(fixture.tradeObservations.find(row => row.partnerCode === 0)).toMatchObject({ value: 5817244571, quantity: 22113408, partnerEntityId: null, partnerScope: "world_total", quality: { isReported: false, isAggregate: true } });
    expect(fixture.tradeObservations.find(row => row.partnerCode === 276)).toMatchObject({ value: 244744677, quantity: 935578, partnerEntityId: "country-de", partnerScope: "entity" });
    expect(fixture.tradeObservations.find(row => row.partnerCode === 702)).toMatchObject({ value: 19270071, quantity: 32649, partnerEntityId: "country-sg", partnerScope: "entity" });
    expect(fixture.tradeObservations.some(row => row.partnerCode === 840 || row.partnerCode === 842)).toBe(false);
    expect(fixture.classificationCrosswalks[0].mappingType).toBe("aggregate");
    expect(fixture.classificationCrosswalks[0].limitation).toContain("摩托车");
    expect(built.audit.quantityUnit).toMatchObject({ qtyCode: 5, qtyAbbr: "u", qtyDescription: "Number of items" });
  });

  it("keeps export structure representative and separates every route edge from measured trade statistics", () => {
    expect(fixture.storyGraph.flows).toHaveLength(9);
    const exports = fixture.storyGraph.flows.filter(flow => flow.processStageId === "export" && flow.relationType === "trade");
    expect(exports.map(flow => flow.id)).toEqual(["flow-ebike-export-de", "flow-ebike-export-sg"]);
    for (const flow of exports) {
      expect(flow).toMatchObject({ flowKind: "representative_supply", method: "curated", unit: null, currency: null, processStageId: "export", evidenceLevel: "representative", dataStatus: "unknown", valueDataStatus: "unknown", quantityDataStatus: "unknown" });
      expect(flow.period.label).toBe("2024");
      expect(flow.notes).toContain("宽口径");
      const ev = fixture.evidence.find(entry => flow.evidenceIds.includes(entry.id) && entry.supportType === "trade_observation")!;
      expect(ev.sourceId).toBe("source-ebike-trade");
      expect(ev.scope?.entityIds).toContain("country-cn");
      expect(ev.scope?.supportsBilateralFlow).toBe(false);
      expect(ev.scope?.period).toEqual(flow.period);
      expect(ev.scope?.classificationCodes[0].mappingType).toBe("aggregate");
    }
    expect(fixture.storyGraph.flows.filter(flow => flow.evidenceLevel === "bilateral_supported")).toHaveLength(0);
    for (const flow of fixture.storyGraph.flows) expect(flow).toMatchObject({ value: null, quantity: null, currency: null, unit: null, valueDataStatus: "unknown", quantityDataStatus: "unknown", dataStatus: "unknown", evidenceLevel: "representative", method: "curated", flowKind: "representative_supply" });
    expect(fixture.storyGraph.nodes.find(node => node.id === "node-ebike-cn-components")?.evidenceLevel).toBe("representative");
    expect(fixture.storyGraph.nodes.find(node => node.id === "node-ebike-cn-assembly")?.evidenceLevel).toBe("representative");
    expect(fixture.storyGraph.nodes.find(node => node.id === "node-ebike-cn-cell")?.period?.label).toBe("2014");
    for (const record of [...fixture.storyGraph.nodes, ...fixture.storyGraph.flows]) {
      expect(record.evidenceIds.length).toBeGreaterThan(0);
      expect(record.period).toBeTruthy();
      expect(record.datasetVersionId).toBe(fixture.datasetVersion.id);
      expect(record.contentVersionId).toBe(fixture.contentVersions[0].id);
    }
  });

  it("connects battery, parts, exports and recovery in an acyclic graph without inventing return flows", () => {
    const reachable = (start: string, finish: string) => {
      const visited = new Set([start]), queue = [start];
      while (queue.length) {
        const current = queue.shift();
        for (const flow of fixture.storyGraph.flows.filter(flow => flow.fromEntityId === current)) {
          if (flow.toEntityId === finish) return true;
          if (!visited.has(flow.toEntityId)) { visited.add(flow.toEntityId); queue.push(flow.toEntityId); }
        }
      }
      return false;
    };
    expect(reachable("node-ebike-materials", "node-ebike-de-market")).toBe(true);
    expect(reachable("node-ebike-cn-components", "node-ebike-sg-market")).toBe(true);
    expect(reachable("node-ebike-cn-pack", "node-ebike-cn-recovery")).toBe(true);
    expect(reachable("node-ebike-de-market", "node-ebike-cn-recovery")).toBe(false);
    expect(reachable("node-ebike-sg-market", "node-ebike-cn-recovery")).toBe(false);
    for (const node of fixture.storyGraph.nodes) expect(reachable(node.id, node.id)).toBe(false);
    for (const flow of fixture.storyGraph.flows) {
      expect(fixture.storyGraph.nodes.some(node => node.id === flow.fromEntityId)).toBe(true);
      expect(fixture.storyGraph.nodes.some(node => node.id === flow.toEntityId)).toBe(true);
      expect(fixture.storyGraph.steps.some(step => step.flowIds.includes(flow.id))).toBe(true);
    }
  });

  it("shows eight documented assembly steps with source-backed equipment and explicit battery handling", () => {
    const assembly = queries.getManufacturingProcessChain(productId, "process-chain-ebike-vehicle-assembly")!;
    expect(assembly.steps).toHaveLength(8);
    expect(fixture.manufacturingProcessSteps).toHaveLength(10);
    expect(fixture.equipmentCategories).toHaveLength(8);
    for (const chain of fixture.manufacturingProcessChains) {
      const view = queries.getManufacturingProcessChain(productId, chain.id)!;
      expect(view.steps.every(step => step.inputItems.length > 0 && step.outputItems.length > 0 && step.evidence.length > 0 && step.sources.length > 0)).toBe(true);
    }
    const systems = fixture.manufacturingProcessSteps.find(step => step.id.endsWith("assembly-systems"))!;
    expect(systems.inputItemIds).toContain("ebike-battery-mount");
    expect(systems.inputItemIds).not.toContain("ebike-battery-pack");
    expect(systems.description).toContain("电池卡位与连接件");
    expect(systems.limitations.some(text => text.includes("仅含卡位及连接件"))).toBe(true);
    const test = fixture.manufacturingProcessSteps.find(step => step.id.endsWith("assembly-test"))!;
    expect(test.inputItemIds).toContain("ebike-battery-pack");
    expect(test.outputItemIds).toContain("ebike-battery-pack");
    expect(test.description).toContain("取出测试电池");
    expect(fixture.manufacturingProcessSteps.find(step => step.id.endsWith("assembly-pack"))?.description).toContain("一起打包出货");
    expect(fixture.equipmentCategories.every(equipment => equipment.sourceIds.includes("source-ebike-assembly"))).toBe(true);
    expect(fixture.organizations).toHaveLength(0);
    expect(fixture.facilities).toHaveLength(0);
    expect(fixture.organizationCapabilities).toHaveLength(0);
    for (const chain of fixture.manufacturingProcessChains.filter(chain => chain.id !== assembly.chain.id)) expect(chain.dataStatus).toBe("unknown");
  });

  it("maps three verified countries and separates world total from bilateral lines", () => {
    const route = createMapView(queries, { product: productId, layer: "supply-chain" })!;
    expect(route.countries.map(country => country.id).sort()).toEqual(["country-cn", "country-de", "country-sg"]);
    expect(route.countries.every(country => country.m49)).toBe(true);
    const trade = createMapView(queries, { product: productId, layer: "trade", year: "2024" })!;
    expect(trade.lines).toHaveLength(2);
    expect(trade.lines.map(line => line.toCountryId).sort()).toEqual(["country-de", "country-sg"]);
    expect(trade.lines.every(line => line.fromCountryId === "country-cn" && line.quantityDataStatus === "observed" && line.unit === "items")).toBe(true);
    expect(queries.getTradeMapView(productId)?.observations.filter(row => row.partnerScope === "world_total")).toHaveLength(1);
    expect(createMapView(queries, { product: productId, layer: "trade", year: "2025" })?.lines).toHaveLength(0);
  });

  it("returns honest partial ledgers, provenance and research export through common modules", () => {
    const china = queries.getCountryLedger(productId, "country-cn", { label: "2024" })!;
    expect(china.tradeObservations).toHaveLength(3);
    expect(china.macroIndicators).toHaveLength(0);
    for (const id of ["country-de", "country-sg"]) {
      const ledger = queries.getCountryLedger(productId, id)!;
      expect(ledger.tradeAvailability).toBe("unknown");
      expect(ledger.tradeObservations).toHaveLength(0);
      expect(ledger.relatedNodes.length).toBeGreaterThan(0);
    }
    for (const node of fixture.storyGraph.nodes) expect(queries.getSupplyChainNode(productId, node.id)?.sources.length).toBeGreaterThan(0);
    expect(queries.getProvenance(productId)).toBeTruthy();
    const exported = queries.getProductResearchExport(productId)!;
    expect(exported.release.datasetVersion.version).toBe(fixture.datasetVersion.version);
    expect(exported.recordCounts).toMatchObject({ items: 15, storyNodes: 10, storyFlows: 9, tradeObservations: 3, manufacturingProcessSteps: 10, equipmentCategories: 8 });
    expect(exported.snapshot.tradeObservations).toEqual(fixture.tradeObservations);
    expect(queries.getTradeGuides(productId)).toHaveLength(0);
    expect(fixture.materialTradeObservations).toHaveLength(0);
    expect(fixture.macroIndicators).toHaveLength(0);
  });

  it("rebuilds byte-identically and verifies all reviewed raw, content and audit hashes", async () => {
    const activeBefore = await readFile("data/published/active-manifest.json", "utf8");
    const again = await buildElectricBicycle();
    expect(await readFile("data/published/active-manifest.json", "utf8")).toBe(activeBefore);
    expect(again.files).toEqual(built.files);
    expect(built.manifest.fixtureSha256).toBe(hash(built.files["fixture.json"]));
    expect(built.manifest.evidenceReview.auditSha256).toBe(hash(built.files["review-audit.json"]));
    expect(built.manifest.evidenceReview.contentSha256).toBe(hash(await readFile(electricBicycleContentPath)));
    expect(built.manifest.evidenceReview.sourceReviewSha256).toBe(hash(await readFile(electricBicycleReviewPath)));
    for (const snapshot of [...built.audit.inputs.snapshots, ...built.audit.inputs.allResearchOriginals]) expect(hash(await readFile(snapshot.path))).toBe(snapshot.sha256);
    expect(built.audit.validation.activeManifestChanged).toBe(false);
    expect(built.audit.validation.absentUSRecordIsZero).toBe(false);
  });

  it("loads only this independent published candidate through the frozen fixture adapter", async () => {
    const temporary = await mkdtemp(resolve(tmpdir(), "globe-ebike-adapter-"));
    for (const [name, bytes] of Object.entries(built.files)) await writeFile(resolve(temporary, name), bytes as string);
    const repository = await loadFixtureRepositoryFromManifest(resolve(temporary, "manifest.json"));
    expect(repository.listProductIds()).toEqual([productId]);
    expect(Object.isFrozen(repository.getProductFixture(productId))).toBe(true);
    const loaded = createProductQueryService(repository);
    expect(loaded.getProductOverview(productId)?.datasetVersion.version).toBe("globe-chain-electric-bicycle-2026.1");
    expect(loaded.getTradeMapView(productId)?.observations).toHaveLength(3);
  });

  it("rejects changed raw bytes before publishing any derived fact", async () => {
    const temporary = await mkdtemp(resolve(tmpdir(), "globe-ebike-tamper-"));
    for (const path of [electricBicycleContentPath, electricBicycleReviewPath, built.audit.inputs.rawManifest.path]) {
      await mkdir(dirname(resolve(temporary, path)), { recursive: true });
      await cp(resolve(path), resolve(temporary, path));
    }
    const first = built.audit.inputs.snapshots[0].path;
    await mkdir(dirname(resolve(temporary, first)), { recursive: true });
    await writeFile(resolve(temporary, first), "tampered reviewed original");
    await expect(buildElectricBicycle(temporary)).rejects.toThrow("Reviewed source hash changed");
  });
});
