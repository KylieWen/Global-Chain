import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { loadFixtureRepositoryFromManifest } from "@globe-chain/db";
import { createProductQueryService, type ProductQueryService } from "@globe-chain/domain";
import { createMapView } from "../apps/web/lib/map-view-model";
import { clampMapTransform, zoomMap } from "../apps/web/lib/map-geometry";
import { mapPath } from "../apps/web/lib/paths";

describe("map exploration with separate evidence layers", () => {
  let queries: ProductQueryService;
  beforeAll(async () => {
    queries = createProductQueryService(await loadFixtureRepositoryFromManifest(resolve("data/published/releases/generic-smartphone/globe-chain-smartphone-2026.2/manifest.json")));
  });

  it("keeps curated routes separate from statistical observations and preserves unknown quantities", () => {
    const routes = createMapView(queries, { product: "generic-smartphone", layer: "supply-chain" })!;
    const statistics = createMapView(queries, { product: "generic-smartphone", layer: "trade" })!;
    expect(routes.lines.length).toBeGreaterThan(0);
    expect(routes.lines.every(line => line.kind === "supply-chain" && line.quantity === null && line.quantityDataStatus === "unknown" && line.contentVersion && line.sources.length)).toBe(true);
    expect(statistics.lines).toHaveLength(8);
    expect(statistics.lines.every(line => line.kind === "trade" && line.reporterName && line.classification && line.method === "official" && line.sources.length)).toBe(true);
    expect(statistics.lines.some(line => routes.lines.some(route => route.id === line.id))).toBe(false);
  });

  it("filters the actual records by year and report direction", () => {
    const records = createMapView(queries, { product: "generic-smartphone", layer: "trade", year: "2024", direction: "export" })!;
    expect(records.lines).toHaveLength(2);
    expect(records.lines.every(line => line.periodLabel === "2024" && line.direction === "export")).toBe(true);
    const missing = createMapView(queries, { product: "generic-smartphone", layer: "trade", year: "1900" })!;
    expect(missing.lines).toHaveLength(0);
    expect(missing.years).toEqual(["2025", "2024"]);
  });

  it("keeps the finished product's broader classification mapping visible on the trade map", async () => {
    const cotton = createProductQueryService(await loadFixtureRepositoryFromManifest(resolve("data/published/releases/generic-cotton-tshirt/globe-chain-cotton-tshirt-2026.1/manifest.json")));
    const records = cotton.getTradeMapView("generic-cotton-tshirt")!.observations;
    expect(records).toHaveLength(4);
    for (const record of records) {
      expect(record.classification.code).toBe("610910");
      expect(record.classification.mappingType).toBe("aggregate");
      expect(record.limitation).toBeTruthy();
    }
  });

  it("retains a component's upstream inputs and all published downstream branches without unrelated component inputs", () => {
    const battery = createMapView(queries, { product: "generic-smartphone", layer: "supply-chain", focus: "battery" })!;
    const ids = battery.lines.map(line => line.id);
    expect(ids).toContain("flow-lithium-refining");
    expect(ids).toContain("flow-cobalt-refining");
    expect(ids).toContain("flow-module-assembly");
    expect(ids).toContain("flow-assembly-export");
    expect(ids).toContain("flow-assembly-germany-market");
    expect(ids).not.toContain("flow-components-assembly");
    expect(battery.lines.every(line => line.evidenceLabel && line.evidenceCode === "representative")).toBe(true);
  });

  it("distinguishes ledger coverage from bilateral records and filters selected countries", () => {
    const view = createMapView(queries, { product: "generic-smartphone", layer: "trade", country: "country-au" })!;
    const australia = view.countries.find(country => country.id === "country-au")!;
    expect(australia.hasTradeLedger).toBe(true);
    expect(australia.hasTradeRecords).toBe(false);
    expect(view.lines).toHaveLength(0);
    const china = createMapView(queries, { product: "generic-smartphone", layer: "trade", country: "country-cn" })!;
    expect(china.lines.every(line => line.fromCountryId === "country-cn" || line.toCountryId === "country-cn")).toBe(true);
  });

  it("opens the component's actual material statistics without borrowing finished-product figures", () => {
    const component = createMapView(queries, { product: "generic-smartphone", layer: "trade", focus: "battery" })!;
    expect(component.records.length).toBeGreaterThan(0);
    expect(component.records.every(record => record.recordKind === "material_trade" && record.itemId !== "generic-smartphone")).toBe(true);
    expect(component.relatedMaterials.some(item => item.id === "copper")).toBe(true);
    expect(component.relatedMaterials.some(item => item.id === "lithium")).toBe(true);
    expect(createMapView(queries, { product: "generic-smartphone", focus: "missing-component" })).toBeNull();
  });

  it("makes all existing material records reachable while keeping world totals off the bilateral geometry", () => {
    const view = queries.getTradeMapView("generic-smartphone", { focusItemId: "battery" })!;
    expect(view.observations).toHaveLength(62);
    expect(view.observations.every(record => record.recordKind === "material_trade")).toBe(true);
    const bilateral = createMapView(queries, { product: "generic-smartphone", layer: "trade", focus: "battery", scope: "bilateral" })!;
    const totals = createMapView(queries, { product: "generic-smartphone", layer: "trade", focus: "battery", scope: "world" })!;
    expect(bilateral.records).toHaveLength(50);
    expect(bilateral.lines).toHaveLength(50);
    expect(totals.records).toHaveLength(12);
    expect(totals.lines).toHaveLength(0);
    expect(totals.records.every(record => record.partnerScope === "world_total" && (record.fromCountryId === null || record.toCountryId === null))).toBe(true);
  });

  it("preserves material classification granularity, units, annual periods and estimated quantities", () => {
    const copper = createMapView(queries, { product: "generic-smartphone", layer: "trade", focus: "copper", scope: "bilateral" })!;
    expect(copper.records.some(record => record.classificationCode === "7403")).toBe(true);
    expect(copper.records.some(record => record.classificationCode === "741011")).toBe(true);
    const lithium = createMapView(queries, { product: "generic-smartphone", layer: "trade", focus: "lithium", scope: "world" })!;
    expect(lithium.records.every(record => record.classificationCode === "283691" && record.classificationMappingType === "exact" && record.unit === "kg" && record.periodLabel === "2024")).toBe(true);
    expect(lithium.records.some(record => record.quantityDataStatus === "estimated" && record.quantity !== null)).toBe(true);
    expect(lithium.records.every(record => record.sources[0]?.retrievedAt && record.method === "official" && record.datasetVersion)).toBe(true);
    const cathode = createMapView(queries, { product: "generic-smartphone", layer: "trade", focus: "cathode-material" })!;
    expect(cathode.records.every(record => record.classificationMappingType === "aggregate" && record.classificationLabel?.includes("近似分类"))).toBe(true);
  });

  it("keeps valid material coverage when a country, direction or year currently has no records", () => {
    const view = createMapView(queries, { product: "generic-smartphone", layer: "trade", focus: "lithium", country: "country-de", direction: "import", year: "1900" })!;
    expect(view.records).toHaveLength(0);
    expect(view.hasFocusTradeCoverage).toBe(true);
    expect(view.items.find(item => item.id === "lithium")?.directTradeCount).toBeGreaterThan(0);
    expect(view.years).toContain("2025");
    expect(view.years).toContain("2024");
    expect(view.selectedItemName).toBe("锂及锂化合物");
  });

  it("retains finished product world totals as distinct observations with no fake partner", () => {
    const view = createMapView(queries, { product: "generic-smartphone", layer: "trade", scope: "world" })!;
    expect(view.records).toHaveLength(16);
    expect(view.lines).toHaveLength(0);
    expect(view.records.every(record => record.recordKind === "product_trade" && record.partnerScope === "world_total" && record.reporterId)).toBe(true);
  });

  it("preserves the active layer, component and actual year in map links", () => {
    const url = new URL(mapPath({ product: "generic-smartphone", layer: "supply-chain", focus: "battery", year: "2023", country: "country-cn" }), "http://localhost");
    expect(Object.fromEntries(url.searchParams)).toEqual({ product: "generic-smartphone", layer: "supply-chain", focus: "battery", year: "2023", country: "country-cn" });
  });
});

describe("map pan and zoom bounds", () => {
  it("keeps the enlarged map covering the viewport after dragging far beyond an edge", () => {
    expect(clampMapTransform({ x: 9000, y: -9000, scale: 2 })).toEqual({ x: 0, y: -540, scale: 2 });
    expect(clampMapTransform({ x: -9000, y: 9000, scale: 3 })).toEqual({ x: -2000, y: 0, scale: 3 });
  });

  it("restores the complete map at original size and clamps zoom limits", () => {
    expect(zoomMap({ x: -200, y: -100, scale: 1.25 }, 0.8)).toEqual({ x: 0, y: 0, scale: 1 });
    expect(zoomMap({ x: 0, y: 0, scale: 1 }, 0.5)).toEqual({ x: 0, y: 0, scale: 1 });
    expect(zoomMap({ x: -1000, y: -540, scale: 4 }, 2).scale).toBe(4);
  });
});
