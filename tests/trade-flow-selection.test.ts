import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { loadFixtureRepositoryFromManifest } from "@globe-chain/db";
import {
  createInMemoryFixtureRepository,
  selectTradeFlows,
  type FixtureRepository,
  type ReadonlyProductFixture
} from "@globe-chain/domain";

describe("selectTradeFlows with published smartphone data", () => {
  let repository: FixtureRepository;
  beforeAll(async () => {
    repository = await loadFixtureRepositoryFromManifest(
      resolve("data/published/releases/generic-smartphone/globe-chain-smartphone-2026.6/manifest.json")
    );
  });

  it("returns null for unknown product", () => {
    const result = selectTradeFlows(repository, "nonexistent", {
      itemIds: ["generic-smartphone"],
      year: "2024",
      currency: "USD"
    });
    expect(result).toBeNull();
  });

  it("returns null for empty itemIds", () => {
    const result = selectTradeFlows(repository, "generic-smartphone", {
      itemIds: [],
      year: "2024",
      currency: "USD"
    });
    expect(result).toBeNull();
  });

  it("selects bilateral flows for the finished product in 2024 USD", () => {
    const result = selectTradeFlows(repository, "generic-smartphone", {
      itemIds: ["generic-smartphone"],
      year: "2024",
      currency: "USD"
    });
    expect(result).not.toBeNull();
    expect(result!.year).toBe("2024");
    expect(result!.currency).toBe("USD");
    expect(result!.flows.length).toBeGreaterThan(0);
    expect(result!.flows.every(f => f.observation.period.label === "2024")).toBe(true);
    expect(result!.flows.every(f => f.observation.currency === "USD")).toBe(true);
    expect(result!.flows.every(f => f.observation.partnerScope !== "world_total")).toBe(true);
  });

  it("separates world totals from bilateral flows", () => {
    const result = selectTradeFlows(repository, "generic-smartphone", {
      itemIds: ["generic-smartphone"],
      year: "2025",
      currency: "USD"
    });
    expect(result).not.toBeNull();
    expect(result!.worldTotals.length).toBeGreaterThan(0);
    expect(result!.worldTotals.every(f => f.observation.partnerScope === "world_total")).toBe(true);
    expect(result!.worldTotals.every(f => f.sourceEntity === null && f.destinationEntity === null)).toBe(true);
    expect(result!.flows.every(f => f.observation.partnerScope !== "world_total")).toBe(true);
  });

  it("reverses import direction so source is partner and destination is reporter", () => {
    const result = selectTradeFlows(repository, "generic-smartphone", {
      itemIds: ["generic-smartphone"],
      year: "2024",
      currency: "USD"
    });
    expect(result).not.toBeNull();
    for (const flow of result!.flows) {
      if (flow.observation.direction === "export") {
        expect(flow.sourceEntity?.id).toBe(flow.observation.reporter?.id);
        expect(flow.destinationEntity?.id).toBe(flow.observation.partner?.id);
      } else {
        expect(flow.sourceEntity?.id).toBe(flow.observation.partner?.id);
        expect(flow.destinationEntity?.id).toBe(flow.observation.reporter?.id);
      }
    }
  });

  it("does not duplicate when parent and child items are both selected", () => {
    const parentOnly = selectTradeFlows(repository, "generic-smartphone", {
      itemIds: ["generic-smartphone"],
      year: "2024",
      currency: "USD"
    });
    const parentAndChild = selectTradeFlows(repository, "generic-smartphone", {
      itemIds: ["generic-smartphone", "battery"],
      year: "2024",
      currency: "USD"
    });
    expect(parentOnly).not.toBeNull();
    expect(parentAndChild).not.toBeNull();
    const parentIds = new Set(parentOnly!.flows.map(f => f.observation.id));
    const combinedIds = new Set(parentAndChild!.flows.map(f => f.observation.id));
    expect([...parentIds].every(id => combinedIds.has(id))).toBe(true);
    expect(combinedIds.size).toBeGreaterThan(parentIds.size);
    expect(combinedIds.size).toBe(parentAndChild!.flows.length);
  });

  it("does not duplicate when the same item is selected multiple times", () => {
    const single = selectTradeFlows(repository, "generic-smartphone", {
      itemIds: ["battery"],
      year: "2025",
      currency: "USD"
    });
    const duplicate = selectTradeFlows(repository, "generic-smartphone", {
      itemIds: ["battery", "battery", "battery"],
      year: "2025",
      currency: "USD"
    });
    expect(single).not.toBeNull();
    expect(duplicate).not.toBeNull();
    expect(duplicate!.flows.length).toBe(single!.flows.length);
    expect(duplicate!.worldTotals.length).toBe(single!.worldTotals.length);
  });

  it("merges observations from sibling items without duplication", () => {
    const batteryOnly = selectTradeFlows(repository, "generic-smartphone", {
      itemIds: ["battery"],
      year: "2025",
      currency: "USD"
    });
    const displayOnly = selectTradeFlows(repository, "generic-smartphone", {
      itemIds: ["display"],
      year: "2025",
      currency: "USD"
    });
    const combined = selectTradeFlows(repository, "generic-smartphone", {
      itemIds: ["battery", "display"],
      year: "2025",
      currency: "USD"
    });
    expect(batteryOnly).not.toBeNull();
    expect(displayOnly).not.toBeNull();
    expect(combined).not.toBeNull();
    const batteryIds = new Set(batteryOnly!.flows.map(f => f.observation.id));
    const displayIds = new Set(displayOnly!.flows.map(f => f.observation.id));
    const combinedIds = new Set(combined!.flows.map(f => f.observation.id));
    const overlap = [...batteryIds].filter(id => displayIds.has(id));
    expect(overlap.length).toBe(0);
    expect(combinedIds.size).toBe(batteryIds.size + displayIds.size);
  });

  it("preserves dataset version and source provenance on every record", () => {
    const result = selectTradeFlows(repository, "generic-smartphone", {
      itemIds: ["generic-smartphone"],
      year: "2024",
      currency: "USD"
    });
    expect(result).not.toBeNull();
    expect(result!.datasetVersion.id).toBeTruthy();
    expect(result!.datasetVersion.status).toBe("published");
    for (const flow of [...result!.flows, ...result!.worldTotals]) {
      expect(flow.observation.source).not.toBeNull();
      expect(flow.observation.datasetVersion).not.toBeNull();
    }
  });

  it("returns a frozen result that cannot be mutated", () => {
    const result = selectTradeFlows(repository, "generic-smartphone", {
      itemIds: ["generic-smartphone"],
      year: "2024",
      currency: "USD"
    });
    expect(result).not.toBeNull();
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result!.flows)).toBe(true);
    expect(Object.isFrozen(result!.worldTotals)).toBe(true);
    expect(Object.isFrozen(result!.warnings)).toBe(true);
    expect(Object.isFrozen(result!.classificationOverlaps)).toBe(true);
    if (result!.flows.length > 0) {
      expect(Object.isFrozen(result!.flows[0])).toBe(true);
    }
  });

  it("does not mutate the input options", () => {
    const itemIds = ["generic-smartphone", "battery"];
    const options = { itemIds, year: "2024", currency: "USD" };
    const frozenIds = [...itemIds];
    selectTradeFlows(repository, "generic-smartphone", options);
    expect(options.itemIds).toEqual(frozenIds);
    expect(options.year).toBe("2024");
    expect(options.currency).toBe("USD");
  });
});

describe("selectTradeFlows with published soybean oil data", () => {
  let repository: FixtureRepository;
  beforeAll(async () => {
    repository = await loadFixtureRepositoryFromManifest(
      resolve("data/published/releases/generic-soybean-oil/globe-chain-soybean-oil-2026.3/manifest.json")
    );
  });

  it("overlays finished oil, soybeans and crude oil in the same year", () => {
    const itemIds = ["generic-soybean-oil", "soybean", "crude-soybean-oil"];
    const result = selectTradeFlows(repository, "generic-soybean-oil", { itemIds, year: "2024", currency: "USD" })!;
    for (const itemId of itemIds) {
      expect(result.flows.some(f => f.item.id === itemId)).toBe(true);
    }
    const preferred = result.flows.filter(f => f.isPreferredRecord);
    const keys = preferred.map(f => JSON.stringify([f.observation.classification.system, f.observation.classification.version, f.observation.classification.code, f.sourceEntity!.id, f.destinationEntity!.id]));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("selects bilateral and world total records for the product", () => {
    const result = selectTradeFlows(repository, "generic-soybean-oil", {
      itemIds: ["generic-soybean-oil"],
      year: "2024",
      currency: "USD"
    });
    expect(result).not.toBeNull();
    const allRecords = [...result!.flows, ...result!.worldTotals];
    expect(allRecords.length).toBeGreaterThan(0);
    expect(allRecords.every(r => r.observation.period.label === "2024")).toBe(true);
    expect(allRecords.every(r => r.observation.currency === "USD")).toBe(true);
  });

  it("filters out records from other years", () => {
    const result = selectTradeFlows(repository, "generic-soybean-oil", {
      itemIds: ["generic-soybean-oil"],
      year: "1900",
      currency: "USD"
    });
    expect(result).not.toBeNull();
    expect(result!.flows.length).toBe(0);
    expect(result!.worldTotals.length).toBe(0);
  });

  it("filters out records with different currency", () => {
    const result = selectTradeFlows(repository, "generic-soybean-oil", {
      itemIds: ["generic-soybean-oil"],
      year: "2024",
      currency: "CNY"
    });
    expect(result).not.toBeNull();
    expect(result!.flows.length).toBe(0);
    expect(result!.worldTotals.length).toBe(0);
  });

  it("returns observations for a non-root item focus including its descendants", () => {
    const result = selectTradeFlows(repository, "generic-soybean-oil", {
      itemIds: ["soybean"],
      year: "2024",
      currency: "USD"
    });
    expect(result).not.toBeNull();
    const allRecords = [...result!.flows, ...result!.worldTotals];
    for (const record of allRecords) {
      expect(record.observation.period.label).toBe("2024");
      expect(record.observation.currency).toBe("USD");
    }
  });

  it("does not duplicate when parent and child are both selected", () => {
    const parentOnly = selectTradeFlows(repository, "generic-soybean-oil", {
      itemIds: ["soybean"],
      year: "2024",
      currency: "USD"
    });
    const parentAndChild = selectTradeFlows(repository, "generic-soybean-oil", {
      itemIds: ["soybean", "soybean-flakes"],
      year: "2024",
      currency: "USD"
    });
    expect(parentOnly).not.toBeNull();
    expect(parentAndChild).not.toBeNull();
    const parentIds = new Set([
      ...parentOnly!.flows.map(f => f.observation.id),
      ...parentOnly!.worldTotals.map(f => f.observation.id)
    ]);
    const combinedIds = new Set([
      ...parentAndChild!.flows.map(f => f.observation.id),
      ...parentAndChild!.worldTotals.map(f => f.observation.id)
    ]);
    expect(combinedIds.size).toBe(parentIds.size);
  });
});

describe("selectTradeFlows mirror dedup with synthetic data", () => {
  function createMirrorFixture(): ReadonlyProductFixture {
    const datasetVersion = Object.freeze({
      id: "ds-mirror-test",
      name: "Mirror Test",
      version: "mirror-test-1.0",
      publishedAt: "2026-01-01",
      sourceIds: ["src-a"],
      coverage: null,
      status: "published" as const,
      notes: null
    });
    const source = Object.freeze({
      id: "src-a",
      name: "Test Source",
      publisher: "Test",
      url: null,
      license: null,
      publishedAt: null,
      retrievedAt: null,
      datasetVersion: null,
      notes: null
    });
    const entityA = Object.freeze({
      id: "country-a",
      kind: "country" as const,
      name: "Country A",
      iso2: "AA",
      iso3: "AAA",
      m49: "001",
      parentId: null,
      sourceIds: ["src-a"],
      dataStatus: "observed" as const,
      method: "official" as const,
      datasetVersionId: "ds-mirror-test",
      validPeriod: null
    });
    const entityB = Object.freeze({
      id: "country-b",
      kind: "country" as const,
      name: "Country B",
      iso2: "BB",
      iso3: "BBB",
      m49: "002",
      parentId: null,
      sourceIds: ["src-a"],
      dataStatus: "observed" as const,
      method: "official" as const,
      datasetVersionId: "ds-mirror-test",
      validPeriod: null
    });
    const product = Object.freeze({
      id: "test-product",
      slug: "test-product",
      name: "Test Product",
      itemType: "final_product" as const,
      parentItemId: null,
      category: "test",
      description: null,
      sourceIds: ["src-a"],
      dataStatus: "observed" as const,
      method: "official" as const,
      datasetVersionId: "ds-mirror-test",
      validPeriod: null
    });
    const classificationCode = Object.freeze({
      id: "cls-851713",
      system: "HS",
      version: "2022",
      code: "851713",
      level: 6,
      label: "Smartphones",
      validPeriod: null,
      sourceIds: ["src-a"],
      dataStatus: "observed" as const,
      method: "official" as const,
      datasetVersionId: "ds-mirror-test"
    });
    const crosswalk = Object.freeze({
      id: "xwalk-product",
      itemId: "test-product",
      classificationCodeId: "cls-851713",
      mappingType: "exact" as const,
      confidence: 1,
      notes: null,
      limitation: null,
      period: { granularity: "annual" as const, start: "2024-01-01", end: "2024-12-31", label: "2024" },
      sourceIds: ["src-a"],
      method: "official" as const,
      dataStatus: "observed" as const,
      datasetVersionId: "ds-mirror-test"
    });
    const period = Object.freeze({
      granularity: "annual" as const,
      start: "2024-01-01",
      end: "2024-12-31",
      label: "2024"
    });
    const exportRecord = Object.freeze({
      id: "trade-a-export-to-b",
      reporterEntityId: "country-a",
      reporterCode: 1,
      partnerEntityId: "country-b",
      partnerCode: 2,
      partner2Code: 0,
      partnerScope: "entity" as const,
      direction: "export" as const,
      flowCode: "X" as const,
      classificationSystem: "HS",
      classificationVersion: "2022",
      classificationCode: "851713",
      itemId: "test-product",
      period,
      value: 1000000,
      quantity: 5000,
      currency: "USD",
      unit: "items",
      statisticalConcept: "customs" as const,
      sourceId: "src-a",
      datasetVersionId: "ds-mirror-test",
      method: "official" as const,
      dataStatus: "observed" as const,
      valueDataStatus: "observed" as const,
      quantityDataStatus: "observed" as const,
      quality: null,
      qualityNote: null
    });
    const importRecord = Object.freeze({
      id: "trade-b-import-from-a",
      reporterEntityId: "country-b",
      reporterCode: 2,
      partnerEntityId: "country-a",
      partnerCode: 1,
      partner2Code: 0,
      partnerScope: "entity" as const,
      direction: "import" as const,
      flowCode: "M" as const,
      classificationSystem: "HS",
      classificationVersion: "2022",
      classificationCode: "851713",
      itemId: "test-product",
      period,
      value: 1050000,
      quantity: 5100,
      currency: "USD",
      unit: "items",
      statisticalConcept: "customs" as const,
      sourceId: "src-a",
      datasetVersionId: "ds-mirror-test",
      method: "official" as const,
      dataStatus: "observed" as const,
      valueDataStatus: "observed" as const,
      quantityDataStatus: "observed" as const,
      quality: null,
      qualityNote: null
    });

    return Object.freeze({
      schemaVersion: "product-fixture.v1",
      productId: "test-product",
      datasetVersion,
      contentVersions: [],
      sources: [source],
      evidence: [],
      evidenceGaps: [],
      entities: [entityA, entityB],
      items: [product],
      processStages: [],
      productionActivities: [],
      classificationCodes: [classificationCode],
      classificationCrosswalks: [crosswalk],
      storyGraph: {
        period,
        method: "curated",
        representativeStatement: null,
        methodology: [],
        limitations: [],
        contentVersionId: null,
        nodes: [],
        flows: [],
        steps: [],
        warnings: []
      },
      tradeObservations: [exportRecord, importRecord],
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
      missingDataNotes: [],
      warnings: []
    }) as unknown as ReadonlyProductFixture;
  }

  it("keeps different classification versions in separate comparison groups", () => {
    const fixture = createMirrorFixture();
    const records = fixture.tradeObservations.map((r, i) => ({ ...r, classificationVersion: i === 0 ? "2022" : "2017" }));
    const repo = createInMemoryFixtureRepository([{ ...fixture, tradeObservations: records }]);
    const result = selectTradeFlows(repo, "test-product", { itemIds: ["test-product"], year: "2024", currency: "USD" })!;
    expect(result.flows.filter(f => f.isPreferredRecord)).toHaveLength(2);
  });

  it("selects only one preferred record when multiple exporters report the same scope", () => {
    const fixture = createMirrorFixture();
    const exporter = fixture.tradeObservations.find(r => r.direction === "export")!;
    const repo = createInMemoryFixtureRepository([{ ...fixture, tradeObservations: [...fixture.tradeObservations, { ...exporter, id: "duplicate-export" }] }]);
    const result = selectTradeFlows(repo, "test-product", { itemIds: ["test-product"], year: "2024", currency: "USD" })!;
    expect(result.flows).toHaveLength(3);
    expect(result.flows.filter(f => f.isPreferredRecord)).toHaveLength(1);
    expect(result.flows.filter(f => !f.isPreferredRecord).every(f => f.notSummable)).toBe(true);
  });

  it("does not draw unspecified partners or absent geographic endpoints", () => {
    const fixture = createMirrorFixture();
    const records = fixture.tradeObservations.map(r => ({ ...r, partnerEntityId: "missing-country" }));
    const repo = createInMemoryFixtureRepository([{ ...fixture, tradeObservations: records }]);
    expect(selectTradeFlows(repo, "test-product", { itemIds: ["test-product"], year: "2024", currency: "USD" })!.flows).toHaveLength(0);
  });

  it("uses actual annual dates rather than the display label", () => {
    const fixture = createMirrorFixture();
    const records = fixture.tradeObservations.map(r => ({ ...r, period: { ...r.period, label: "Annual statistics" } }));
    const repo = createInMemoryFixtureRepository([{ ...fixture, tradeObservations: records }]);
    expect(selectTradeFlows(repo, "test-product", { itemIds: ["test-product"], year: "2024", currency: "USD" })!.flows).toHaveLength(2);
  });

  it("prefers export report and marks import as alternative in mirror pair", () => {
    const fixture = createMirrorFixture();
    const repository = createInMemoryFixtureRepository([fixture]);
    const result = selectTradeFlows(repository, "test-product", {
      itemIds: ["test-product"],
      year: "2024",
      currency: "USD"
    });
    expect(result).not.toBeNull();
    expect(result!.flows.length).toBe(2);

    const preferred = result!.flows.find(f => f.isPreferredRecord)!;
    const alternative = result!.flows.find(f => !f.isPreferredRecord)!;

    expect(preferred).toBeDefined();
    expect(alternative).toBeDefined();
    expect(preferred.observation.direction).toBe("export");
    expect(preferred.observation.id).toBe("trade-a-export-to-b");
    expect(alternative.observation.direction).toBe("import");
    expect(alternative.observation.id).toBe("trade-b-import-from-a");
    expect(preferred.alternativeRecordId).toBe("trade-b-import-from-a");
    expect(alternative.alternativeRecordId).toBe("trade-a-export-to-b");
  });

  it("does not sum mirror records even though values differ", () => {
    const fixture = createMirrorFixture();
    const repository = createInMemoryFixtureRepository([fixture]);
    const result = selectTradeFlows(repository, "test-product", {
      itemIds: ["test-product"],
      year: "2024",
      currency: "USD"
    });
    expect(result).not.toBeNull();
    const exportFlow = result!.flows.find(f => f.observation.direction === "export")!;
    const importFlow = result!.flows.find(f => f.observation.direction === "import")!;
    expect(exportFlow.observation.value).toBe(1000000);
    expect(importFlow.observation.value).toBe(1050000);
    expect(result!.warnings).toContain(
      "同一HS分类、同向国家对存在镜像报告；优先保留出口方报告，替代记录不合计。"
    );
  });
});

describe("selectTradeFlows cross-year and cross-currency boundary", () => {
  function createMultiYearFixture(): ReadonlyProductFixture {
    const datasetVersion = Object.freeze({
      id: "ds-multi-year",
      name: "Multi Year Test",
      version: "multi-year-1.0",
      publishedAt: "2026-01-01",
      sourceIds: ["src-a"],
      coverage: null,
      status: "published" as const,
      notes: null
    });
    const source = Object.freeze({
      id: "src-a",
      name: "Test Source",
      publisher: "Test",
      url: null,
      license: null,
      publishedAt: null,
      retrievedAt: null,
      datasetVersion: null,
      notes: null
    });
    const entityA = Object.freeze({
      id: "country-a",
      kind: "country" as const,
      name: "Country A",
      iso2: "AA",
      iso3: "AAA",
      m49: "001",
      parentId: null,
      sourceIds: ["src-a"],
      dataStatus: "observed" as const,
      method: "official" as const,
      datasetVersionId: "ds-multi-year",
      validPeriod: null
    });
    const entityB = Object.freeze({
      id: "country-b",
      kind: "country" as const,
      name: "Country B",
      iso2: "BB",
      iso3: "BBB",
      m49: "002",
      parentId: null,
      sourceIds: ["src-a"],
      dataStatus: "observed" as const,
      method: "official" as const,
      datasetVersionId: "ds-multi-year",
      validPeriod: null
    });
    const product = Object.freeze({
      id: "test-product",
      slug: "test-product",
      name: "Test Product",
      itemType: "final_product" as const,
      parentItemId: null,
      category: "test",
      description: null,
      sourceIds: ["src-a"],
      dataStatus: "observed" as const,
      method: "official" as const,
      datasetVersionId: "ds-multi-year",
      validPeriod: null
    });
    const classificationCode = Object.freeze({
      id: "cls-851713",
      system: "HS",
      version: "2022",
      code: "851713",
      level: 6,
      label: "Smartphones",
      validPeriod: null,
      sourceIds: ["src-a"],
      dataStatus: "observed" as const,
      method: "official" as const,
      datasetVersionId: "ds-multi-year"
    });
    const crosswalk = Object.freeze({
      id: "xwalk-product",
      itemId: "test-product",
      classificationCodeId: "cls-851713",
      mappingType: "exact" as const,
      confidence: 1,
      notes: null,
      limitation: null,
      period: { granularity: "annual" as const, start: "2023-01-01", end: "2025-12-31", label: "2023-2025" },
      sourceIds: ["src-a"],
      method: "official" as const,
      dataStatus: "observed" as const,
      datasetVersionId: "ds-multi-year"
    });

    const makeObservation = (id: string, year: string, currency: string, value: number) =>
      Object.freeze({
        id,
        reporterEntityId: "country-a",
        reporterCode: 1,
        partnerEntityId: "country-b",
        partnerCode: 2,
        partner2Code: 0,
        partnerScope: "entity" as const,
        direction: "export" as const,
        flowCode: "X" as const,
        classificationSystem: "HS",
        classificationVersion: "2022",
        classificationCode: "851713",
        itemId: "test-product",
        period: Object.freeze({
          granularity: "annual" as const,
          start: `${year}-01-01`,
          end: `${year}-12-31`,
          label: year
        }),
        value,
        quantity: null,
        currency,
        unit: null,
        statisticalConcept: "customs" as const,
        sourceId: "src-a",
        datasetVersionId: "ds-multi-year",
        method: "official" as const,
        dataStatus: "observed" as const,
        valueDataStatus: "observed" as const,
        quantityDataStatus: "unknown" as const,
        quality: null,
        qualityNote: null
      });

    return Object.freeze({
      schemaVersion: "product-fixture.v1",
      productId: "test-product",
      datasetVersion,
      contentVersions: [],
      sources: [source],
      evidence: [],
      evidenceGaps: [],
      entities: [entityA, entityB],
      items: [product],
      processStages: [],
      productionActivities: [],
      classificationCodes: [classificationCode],
      classificationCrosswalks: [crosswalk],
      storyGraph: {
        period: Object.freeze({
          granularity: "annual" as const,
          start: "2023-01-01",
          end: "2025-12-31",
          label: "2023-2025"
        }),
        method: "curated",
        representativeStatement: null,
        methodology: [],
        limitations: [],
        contentVersionId: null,
        nodes: [],
        flows: [],
        steps: [],
        warnings: []
      },
      tradeObservations: [
        makeObservation("obs-2023-usd", "2023", "USD", 100),
        makeObservation("obs-2024-usd", "2024", "USD", 200),
        makeObservation("obs-2024-eur", "2024", "EUR", 180),
        makeObservation("obs-2025-usd", "2025", "USD", 300)
      ],
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
      missingDataNotes: [],
      warnings: []
    }) as unknown as ReadonlyProductFixture;
  }

  it("only returns records matching the specified year", () => {
    const fixture = createMultiYearFixture();
    const repository = createInMemoryFixtureRepository([fixture]);
    const result = selectTradeFlows(repository, "test-product", {
      itemIds: ["test-product"],
      year: "2024",
      currency: "USD"
    });
    expect(result).not.toBeNull();
    expect(result!.flows.length).toBe(1);
    expect(result!.flows[0].observation.id).toBe("obs-2024-usd");
    expect(result!.flows[0].observation.value).toBe(200);
  });

  it("does not mix records from different years", () => {
    const fixture = createMultiYearFixture();
    const repository = createInMemoryFixtureRepository([fixture]);
    const result2023 = selectTradeFlows(repository, "test-product", {
      itemIds: ["test-product"],
      year: "2023",
      currency: "USD"
    });
    const result2025 = selectTradeFlows(repository, "test-product", {
      itemIds: ["test-product"],
      year: "2025",
      currency: "USD"
    });
    expect(result2023!.flows[0].observation.value).toBe(100);
    expect(result2025!.flows[0].observation.value).toBe(300);
  });

  it("does not mix records from different currencies", () => {
    const fixture = createMultiYearFixture();
    const repository = createInMemoryFixtureRepository([fixture]);
    const usd = selectTradeFlows(repository, "test-product", {
      itemIds: ["test-product"],
      year: "2024",
      currency: "USD"
    });
    const eur = selectTradeFlows(repository, "test-product", {
      itemIds: ["test-product"],
      year: "2024",
      currency: "EUR"
    });
    expect(usd!.flows.length).toBe(1);
    expect(usd!.flows[0].observation.currency).toBe("USD");
    expect(eur!.flows.length).toBe(1);
    expect(eur!.flows[0].observation.currency).toBe("EUR");
  });
});

describe("selectTradeFlows zero and unknown value handling", () => {
  function createZeroUnknownFixture(): ReadonlyProductFixture {
    const datasetVersion = Object.freeze({
      id: "ds-zero-unknown",
      name: "Zero Unknown Test",
      version: "zero-unknown-1.0",
      publishedAt: "2026-01-01",
      sourceIds: ["src-a"],
      coverage: null,
      status: "published" as const,
      notes: null
    });
    const source = Object.freeze({
      id: "src-a",
      name: "Test Source",
      publisher: "Test",
      url: null,
      license: null,
      publishedAt: null,
      retrievedAt: null,
      datasetVersion: null,
      notes: null
    });
    const entityA = Object.freeze({
      id: "country-a",
      kind: "country" as const,
      name: "Country A",
      iso2: "AA",
      iso3: "AAA",
      m49: "001",
      parentId: null,
      sourceIds: ["src-a"],
      dataStatus: "observed" as const,
      method: "official" as const,
      datasetVersionId: "ds-zero-unknown",
      validPeriod: null
    });
    const entityB = Object.freeze({
      id: "country-b",
      kind: "country" as const,
      name: "Country B",
      iso2: "BB",
      iso3: "BBB",
      m49: "002",
      parentId: null,
      sourceIds: ["src-a"],
      dataStatus: "observed" as const,
      method: "official" as const,
      datasetVersionId: "ds-zero-unknown",
      validPeriod: null
    });
    const product = Object.freeze({
      id: "test-product",
      slug: "test-product",
      name: "Test Product",
      itemType: "final_product" as const,
      parentItemId: null,
      category: "test",
      description: null,
      sourceIds: ["src-a"],
      dataStatus: "observed" as const,
      method: "official" as const,
      datasetVersionId: "ds-zero-unknown",
      validPeriod: null
    });
    const classificationCode = Object.freeze({
      id: "cls-851713",
      system: "HS",
      version: "2022",
      code: "851713",
      level: 6,
      label: "Smartphones",
      validPeriod: null,
      sourceIds: ["src-a"],
      dataStatus: "observed" as const,
      method: "official" as const,
      datasetVersionId: "ds-zero-unknown"
    });
    const crosswalk = Object.freeze({
      id: "xwalk-product",
      itemId: "test-product",
      classificationCodeId: "cls-851713",
      mappingType: "exact" as const,
      confidence: 1,
      notes: null,
      limitation: null,
      period: { granularity: "annual" as const, start: "2024-01-01", end: "2024-12-31", label: "2024" },
      sourceIds: ["src-a"],
      method: "official" as const,
      dataStatus: "observed" as const,
      datasetVersionId: "ds-zero-unknown"
    });
    const period = Object.freeze({
      granularity: "annual" as const,
      start: "2024-01-01",
      end: "2024-12-31",
      label: "2024"
    });

    return Object.freeze({
      schemaVersion: "product-fixture.v1",
      productId: "test-product",
      datasetVersion,
      contentVersions: [],
      sources: [source],
      evidence: [],
      evidenceGaps: [],
      entities: [entityA, entityB],
      items: [product],
      processStages: [],
      productionActivities: [],
      classificationCodes: [classificationCode],
      classificationCrosswalks: [crosswalk],
      storyGraph: {
        period,
        method: "curated",
        representativeStatement: null,
        methodology: [],
        limitations: [],
        contentVersionId: null,
        nodes: [],
        flows: [],
        steps: [],
        warnings: []
      },
      tradeObservations: [
        Object.freeze({
          id: "obs-zero-value",
          reporterEntityId: "country-a",
          reporterCode: 1,
          partnerEntityId: "country-b",
          partnerCode: 2,
          partner2Code: 0,
          partnerScope: "entity" as const,
          direction: "export" as const,
          flowCode: "X" as const,
          classificationSystem: "HS",
          classificationVersion: "2022",
          classificationCode: "851713",
          itemId: "test-product",
          period,
          value: 0,
          quantity: 0,
          currency: "USD",
          unit: "items",
          statisticalConcept: "customs" as const,
          sourceId: "src-a",
          datasetVersionId: "ds-zero-unknown",
          method: "official" as const,
          dataStatus: "observed" as const,
          valueDataStatus: "observed" as const,
          quantityDataStatus: "observed" as const,
          quality: null,
          qualityNote: null
        }),
        Object.freeze({
          id: "obs-unknown-value",
          reporterEntityId: "country-b",
          reporterCode: 2,
          partnerEntityId: null,
          partnerCode: 0,
          partner2Code: 0,
          partnerScope: "world_total" as const,
          direction: "import" as const,
          flowCode: "M" as const,
          classificationSystem: "HS",
          classificationVersion: "2022",
          classificationCode: "851713",
          itemId: "test-product",
          period,
          value: null,
          quantity: null,
          currency: "USD",
          unit: null,
          statisticalConcept: "customs" as const,
          sourceId: "src-a",
          datasetVersionId: "ds-zero-unknown",
          method: "official" as const,
          dataStatus: "unknown" as const,
          valueDataStatus: "unknown" as const,
          quantityDataStatus: "unknown" as const,
          quality: null,
          qualityNote: null
        })
      ],
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
      missingDataNotes: [],
      warnings: []
    }) as unknown as ReadonlyProductFixture;
  }

  it("preserves zero values as observed, not unknown", () => {
    const fixture = createZeroUnknownFixture();
    const repository = createInMemoryFixtureRepository([fixture]);
    const result = selectTradeFlows(repository, "test-product", {
      itemIds: ["test-product"],
      year: "2024",
      currency: "USD"
    });
    expect(result).not.toBeNull();
    const zeroFlow = result!.flows.find(f => f.observation.id === "obs-zero-value");
    expect(zeroFlow).toBeDefined();
    expect(zeroFlow!.observation.value).toBe(0);
    expect(zeroFlow!.observation.valueDataStatus).toBe("observed");
  });

  it("preserves unknown values without converting to zero", () => {
    const fixture = createZeroUnknownFixture();
    const repository = createInMemoryFixtureRepository([fixture]);
    const result = selectTradeFlows(repository, "test-product", {
      itemIds: ["test-product"],
      year: "2024",
      currency: "USD"
    });
    expect(result).not.toBeNull();
    const unknownFlow = result!.worldTotals.find(f => f.observation.id === "obs-unknown-value");
    expect(unknownFlow).toBeDefined();
    expect(unknownFlow!.observation.value).toBeNull();
    expect(unknownFlow!.observation.valueDataStatus).toBe("unknown");
  });
});

describe("selectTradeFlows classification overlap detection", () => {
  function createOverlapFixture(): ReadonlyProductFixture {
    const datasetVersion = Object.freeze({
      id: "ds-overlap",
      name: "Overlap Test",
      version: "overlap-1.0",
      publishedAt: "2026-01-01",
      sourceIds: ["src-a"],
      coverage: null,
      status: "published" as const,
      notes: null
    });
    const source = Object.freeze({
      id: "src-a",
      name: "Test Source",
      publisher: "Test",
      url: null,
      license: null,
      publishedAt: null,
      retrievedAt: null,
      datasetVersion: null,
      notes: null
    });
    const entityA = Object.freeze({
      id: "country-a",
      kind: "country" as const,
      name: "Country A",
      iso2: "AA",
      iso3: "AAA",
      m49: "001",
      parentId: null,
      sourceIds: ["src-a"],
      dataStatus: "observed" as const,
      method: "official" as const,
      datasetVersionId: "ds-overlap",
      validPeriod: null
    });
    const entityB = Object.freeze({
      id: "country-b",
      kind: "country" as const,
      name: "Country B",
      iso2: "BB",
      iso3: "BBB",
      m49: "002",
      parentId: null,
      sourceIds: ["src-a"],
      dataStatus: "observed" as const,
      method: "official" as const,
      datasetVersionId: "ds-overlap",
      validPeriod: null
    });
    const product = Object.freeze({
      id: "test-product",
      slug: "test-product",
      name: "Test Product",
      itemType: "final_product" as const,
      parentItemId: null,
      category: "test",
      description: null,
      sourceIds: ["src-a"],
      dataStatus: "observed" as const,
      method: "official" as const,
      datasetVersionId: "ds-overlap",
      validPeriod: null
    });
    const component = Object.freeze({
      id: "test-component",
      slug: "test-component",
      name: "Test Component",
      itemType: "component" as const,
      parentItemId: "test-product",
      category: "test",
      description: null,
      sourceIds: ["src-a"],
      dataStatus: "observed" as const,
      method: "official" as const,
      datasetVersionId: "ds-overlap",
      validPeriod: null
    });
    const parentClassification = Object.freeze({
      id: "cls-8517",
      system: "HS",
      version: "2022",
      code: "8517",
      level: 4,
      label: "Phones broad",
      validPeriod: null,
      sourceIds: ["src-a"],
      dataStatus: "observed" as const,
      method: "official" as const,
      datasetVersionId: "ds-overlap"
    });
    const childClassification = Object.freeze({
      id: "cls-851713",
      system: "HS",
      version: "2022",
      code: "851713",
      level: 6,
      label: "Smartphones",
      validPeriod: null,
      sourceIds: ["src-a"],
      dataStatus: "observed" as const,
      method: "official" as const,
      datasetVersionId: "ds-overlap"
    });
    const parentCrosswalk = Object.freeze({
      id: "xwalk-product-parent",
      itemId: "test-product",
      classificationCodeId: "cls-8517",
      mappingType: "aggregate" as const,
      confidence: 0.8,
      notes: null,
      limitation: "Broad classification",
      period: { granularity: "annual" as const, start: "2024-01-01", end: "2024-12-31", label: "2024" },
      sourceIds: ["src-a"],
      method: "official" as const,
      dataStatus: "observed" as const,
      datasetVersionId: "ds-overlap"
    });
    const childCrosswalk = Object.freeze({
      id: "xwalk-component-child",
      itemId: "test-component",
      classificationCodeId: "cls-851713",
      mappingType: "exact" as const,
      confidence: 1,
      notes: null,
      limitation: null,
      period: { granularity: "annual" as const, start: "2024-01-01", end: "2024-12-31", label: "2024" },
      sourceIds: ["src-a"],
      method: "official" as const,
      dataStatus: "observed" as const,
      datasetVersionId: "ds-overlap"
    });
    const period = Object.freeze({
      granularity: "annual" as const,
      start: "2024-01-01",
      end: "2024-12-31",
      label: "2024"
    });

    return Object.freeze({
      schemaVersion: "product-fixture.v1",
      productId: "test-product",
      datasetVersion,
      contentVersions: [],
      sources: [source],
      evidence: [],
      evidenceGaps: [],
      entities: [entityA, entityB],
      items: [product, component],
      processStages: [],
      productionActivities: [],
      classificationCodes: [parentClassification, childClassification],
      classificationCrosswalks: [parentCrosswalk, childCrosswalk],
      storyGraph: {
        period,
        method: "curated",
        representativeStatement: null,
        methodology: [],
        limitations: [],
        contentVersionId: null,
        nodes: [],
        flows: [],
        steps: [],
        warnings: []
      },
      tradeObservations: [
        Object.freeze({
          id: "obs-parent-code",
          reporterEntityId: "country-a",
          reporterCode: 1,
          partnerEntityId: "country-b",
          partnerCode: 2,
          partner2Code: 0,
          partnerScope: "entity" as const,
          direction: "export" as const,
          flowCode: "X" as const,
          classificationSystem: "HS",
          classificationVersion: "2022",
          classificationCode: "8517",
          itemId: "test-product",
          period,
          value: 5000000,
          quantity: null,
          currency: "USD",
          unit: null,
          statisticalConcept: "customs" as const,
          sourceId: "src-a",
          datasetVersionId: "ds-overlap",
          method: "official" as const,
          dataStatus: "observed" as const,
          valueDataStatus: "observed" as const,
          quantityDataStatus: "unknown" as const,
          quality: null,
          qualityNote: null
        }),
        Object.freeze({
          id: "obs-child-code",
          reporterEntityId: "country-a",
          reporterCode: 1,
          partnerEntityId: "country-b",
          partnerCode: 2,
          partner2Code: 0,
          partnerScope: "entity" as const,
          direction: "export" as const,
          flowCode: "X" as const,
          classificationSystem: "HS",
          classificationVersion: "2022",
          classificationCode: "851713",
          itemId: "test-component",
          period,
          value: 3000000,
          quantity: null,
          currency: "USD",
          unit: null,
          statisticalConcept: "customs" as const,
          sourceId: "src-a",
          datasetVersionId: "ds-overlap",
          method: "official" as const,
          dataStatus: "observed" as const,
          valueDataStatus: "observed" as const,
          quantityDataStatus: "unknown" as const,
          quality: null,
          qualityNote: null
        })
      ],
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
      missingDataNotes: [],
      warnings: []
    }) as unknown as ReadonlyProductFixture;
  }

  it("marks parent-child HS classification overlaps as not summable", () => {
    const fixture = createOverlapFixture();
    const repository = createInMemoryFixtureRepository([fixture]);
    const result = selectTradeFlows(repository, "test-product", {
      itemIds: ["test-product", "test-component"],
      year: "2024",
      currency: "USD"
    });
    expect(result).not.toBeNull();
    expect(result!.classificationOverlaps.length).toBe(1);
    expect(result!.classificationOverlaps[0].parentCode).toBe("8517");
    expect(result!.classificationOverlaps[0].childCode).toBe("851713");
    expect(result!.flows.every(f => f.notSummable)).toBe(true);
    expect(result!.warnings).toContain(
      "所选物品存在HS父子分类重叠，对应记录标记为不可直接相加。"
    );
  });

  it("does not flag non-overlapping classification codes", () => {
    const fixture = createOverlapFixture();
    const repository = createInMemoryFixtureRepository([fixture]);
    const result = selectTradeFlows(repository, "test-product", {
      itemIds: ["test-product"],
      year: "2024",
      currency: "USD"
    });
    expect(result).not.toBeNull();
    expect(result!.classificationOverlaps.length).toBe(0);
    expect(result!.flows.every(f => !f.notSummable)).toBe(true);
  });
});
