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
    queries = createProductQueryService(await loadFixtureRepositoryFromManifest(resolve("data/published/manifest.json")));
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

  it("retains a component's upstream inputs and all published downstream branches without unrelated component inputs", () => {
    const battery = createMapView(queries, { product: "generic-smartphone", layer: "supply-chain", focus: "battery" })!;
    const ids = battery.lines.map(line => line.id);
    expect(ids).toContain("flow-lithium-refining");
    expect(ids).toContain("flow-cobalt-refining");
    expect(ids).toContain("flow-module-assembly");
    expect(ids).toContain("flow-assembly-export");
    expect(ids).toContain("flow-assembly-germany-market");
    expect(ids).not.toContain("flow-components-assembly");
    expect(battery.lines.every(line => line.evidenceLabel && line.evidenceDescription)).toBe(true);
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

  it("does not borrow finished product statistics for a component without observations", () => {
    const component = createMapView(queries, { product: "generic-smartphone", layer: "trade", focus: "battery" })!;
    expect(component.lines).toHaveLength(0);
    expect(createMapView(queries, { product: "generic-smartphone", focus: "missing-component" })).toBeNull();
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
