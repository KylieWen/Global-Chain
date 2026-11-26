import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import { loadFixtureRepositoryFromManifest } from "@globe-chain/db";
import { createProductQueryService, type ProductQueryService } from "@globe-chain/domain";
import { buildExplodedModel, modelHasLedger, type ExplodedModel } from "../apps/web/lib/exploded-model";
import { layoutExplodedBoxes, layoutIsoSlots } from "../apps/web/lib/exploded-layout";
import { explodedLinks, ledgerFallbackHref } from "../apps/web/lib/exploded-links";
import { createMapView } from "../apps/web/lib/map-view-model";
import { productBodySize, resolveNodeRole } from "../apps/web/lib/exploded-appearance";
import { UNKNOWN_LEDGER_ENTITY_ID } from "../apps/web/lib/paths";

const PRODUCT_IDS = [
  "generic-smartphone",
  "generic-cotton-tshirt",
  "generic-soybean-oil",
  "generic-electric-bicycle",
  "generic-home-air-conditioner"
] as const;

function modelFor(queries: ProductQueryService, productId: string): ExplodedModel {
  const breakdown = queries.getProductBreakdown(productId);
  const overview = queries.getProductOverview(productId);
  if (!breakdown || !overview) throw new Error(`Missing product ${productId}`);
  const tradeItems = new Set(
    queries.getTradeMapView(productId)?.itemCoverage.filter((entry) => entry.directObservationCount > 0).map((entry) => entry.item.id) ?? []
  );
  const story = queries.getSupplyChainStory(productId);
  const explorableItemIds = [
    ...new Set([
      ...(story?.nodes.flatMap((node) => (node.item ? [node.item.id] : [])) ?? []),
      ...(story?.flows.map((flow) => flow.flow.itemId) ?? [])
    ])
  ];
  const ledgerEntitiesByItem: Record<string, { id: string; name: string }[]> = {};
  for (const node of story?.nodes ?? []) {
    if (node.item && node.entity) {
      const list = ledgerEntitiesByItem[node.item.id] ?? [];
      if (!list.some((entry) => entry.id === node.entity!.id)) {
        list.push({ id: node.entity.id, name: node.entity.name });
      }
      ledgerEntitiesByItem[node.item.id] = list;
    }
  }
  return buildExplodedModel({
    root: breakdown,
    componentCoverage: overview.componentCoverage,
    tradeItems: [...tradeItems],
    explorableItemIds,
    ledgerEntitiesByItem
  });
}

describe("batch 3 exploded model derivation", () => {
  let queries: ProductQueryService;

  beforeAll(async () => {
    queries = createProductQueryService(await loadFixtureRepositoryFromManifest(resolve("data/published/manifest.json")));
  });

  it("maps the smartphone BOM onto the five-level framework without fabricating assembly splits", () => {
    const model = modelFor(queries, "generic-smartphone");
    const byId = new Map(model.nodes.map((node) => [node.id, node]));

    expect(byId.get("generic-smartphone")?.lane).toBe("product");
    expect(byId.get("battery")?.lane).toBe("module");
    expect(byId.get("lithium")?.lane).toBe("material");
    expect(byId.get("cathode-material")?.lane).toBe("material");
    expect(byId.get("battery-housing")?.lane).toBe("material");
    for (const component of ["cell", "battery-module", "battery-bms"]) {
      expect(byId.get(component)?.lane).toBe("assembly-part");
    }
    expect(byId.get("chip-design-layout")?.isService).toBe(true);

    const partLane = model.lanes.find((lane) => lane.id === "part");
    expect(partLane?.present).toBe(false);
    expect(partLane?.missingNote).toBeTruthy();
    expect(model.gaps.some((gap) => gap.includes("装配体与零件"))).toBe(true);
  });

  it("aggregates the battery descendant subtree and keeps lithium linked to its Australian ledger role", () => {
    const model = modelFor(queries, "generic-smartphone");
    const byId = new Map(model.nodes.map((node) => [node.id, node]));
    const battery = byId.get("battery");
    const lithium = byId.get("lithium");

    expect(battery?.descendantIds).toContain("lithium");
    expect(battery?.descendantIds).toContain("cell");
    expect(battery?.descendantIds).toContain("battery-bms");
    expect(lithium?.ledgerEntities.some((entry) => entry.id === "country-au")).toBe(true);
    const au = lithium?.ledgerEntities.find((entry) => entry.id === "country-au");
    expect(au?.name).toBe("澳大利亚");
    expect(battery?.hasRoute).toBe(true);
  });

  it("carries real country/region names and dedupes ledger entities per item", () => {
    const model = modelFor(queries, "generic-smartphone");
    const byId = new Map(model.nodes.map((node) => [node.id, node]));
    const root = byId.get("generic-smartphone");
    const rootEntities = root?.ledgerEntities ?? [];

    expect(rootEntities.map((entry) => entry.name).sort()).toEqual(["中国", "德国", "印度", "越南", "美国"].sort());
    const rootIds = rootEntities.map((entry) => entry.id);
    expect(new Set(rootIds).size).toBe(rootIds.length);
    expect(rootEntities.every((entry) => entry.name.trim().length > 0)).toBe(true);

    const batteryModule = byId.get("battery-module");
    const moduleIds = (batteryModule?.ledgerEntities ?? []).map((entry) => entry.id);
    expect([...moduleIds].sort()).toEqual(["country-cn", "country-kr"].sort());
    expect(new Set(moduleIds).size).toBe(moduleIds.length);
  });

  it("resolves real destination links for battery and lithium without rebuilding relations", () => {
    const model = modelFor(queries, "generic-smartphone");
    const byId = new Map(model.nodes.map((node) => [node.id, node]));
    const batteryLinks = explodedLinks("generic-smartphone", byId.get("battery")!, {});
    const lithiumLinks = explodedLinks("generic-smartphone", byId.get("lithium")!, {});

    expect(batteryLinks.routeHref).toBe("/products/generic-smartphone/supply-chain?focus=battery");
    expect(lithiumLinks.materialHref).toBe("/products/generic-smartphone/materials?material=lithium");
    expect(lithiumLinks.tradeMapHref).toBe("/map?product=generic-smartphone&layer=trade&items=lithium");
    expect(lithiumLinks.ledgerHrefs.map((ledger) => ledger.id)).toContain("country-au");
    expect(lithiumLinks.ledgerHrefs.find((ledger) => ledger.id === "country-au")?.name).toBe("澳大利亚");
    expect(lithiumLinks.ledgerHrefs[0]?.href).toBe("/products/generic-smartphone/ledger/country-au");
  });

  it("keeps deep material/process chains on the isometric fallback and reports the depth gap", () => {
    const tshirt = modelFor(queries, "generic-cotton-tshirt");
    expect(tshirt.renderMode).toBe("iso-layers");
    expect(tshirt.maxDepth).toBeGreaterThan(2);
    expect(tshirt.gaps.some((gap) => gap.includes("工序阶段"))).toBe(true);

    for (const productId of ["generic-soybean-oil", "generic-electric-bicycle", "generic-home-air-conditioner"] as const) {
      const model = modelFor(queries, productId);
      expect(model.renderMode).toBe("iso-layers");
      expect(model.lanes.find((lane) => lane.id === "material")?.present).toBe(true);
    }
  });

  it("chooses procedural 3D only for the shallow physically assembled product", () => {
    const phone = modelFor(queries, "generic-smartphone");
    expect(phone.renderMode).toBe("procedural-3d");
    expect(phone.nodeCount).toBeLessThanOrEqual(60);
    expect(modelHasLedger(phone)).toBe(true);
  });

  it("maps the generic camera drone onto the procedural 3D path through appearance roles only", () => {
    const drone = modelFor(queries, "generic-camera-drone");
    expect(drone.renderMode).toBe("procedural-3d");
    expect(drone.maxDepth).toBe(2);
    expect(drone.nodeCount).toBe(16);

    const byId = new Map(drone.nodes.map((node) => [node.id, node]));
    const roleFor = (id: string) => resolveNodeRole("generic-camera-drone", byId.get(id)!);
    expect(roleFor("generic-camera-drone").shape).toBe("drone-body");
    expect(roleFor("drone-arm").shape).toBe("drone-arm");
    expect(roleFor("drone-gimbal-camera").shape).toBe("lens");
    expect(roleFor("drone-vision").shape).toBe("lens");
    expect(roleFor("drone-remote-battery").shape).toBe("battery-pack");
    expect(productBodySize("generic-camera-drone")).toEqual([1.05, 0.82, 0.34]);

    const boxes = layoutExplodedBoxes(drone, 0.85, "generic-camera-drone");
    expect(boxes.size).toBe(drone.nodeCount);
    for (const box of boxes.values()) {
      expect([box.anchor[0], box.anchor[1], box.anchor[2]].every(Number.isFinite)).toBe(true);
    }

    expect(modelHasLedger(drone)).toBe(false);
    expect(drone.nodes.every((node) => node.ledgerEntities.length === 0)).toBe(true);
    expect(ledgerFallbackHref("generic-camera-drone", {})).toBe(`/products/generic-camera-drone/ledger/${UNKNOWN_LEDGER_ENTITY_ID}`);
  });

  it("produces deterministic layout slots and anchors for every node", () => {
    const model = modelFor(queries, "generic-smartphone");
    const first = layoutExplodedBoxes(model, 0.62);
    const second = layoutExplodedBoxes(model, 0.62);
    expect([...first.keys()]).toEqual([...second.keys()]);
    for (const box of first.values()) {
      expect(Number.isFinite(box.anchor[0])).toBe(true);
      expect(Number.isFinite(box.anchor[1])).toBe(true);
      expect(Number.isFinite(box.anchor[2])).toBe(true);
    }
    const iso = layoutIsoSlots(model);
    expect(iso.size).toBe(model.nodeCount);
  });

  it("keeps the six batch-3 deep chains resolvable against real queries", () => {    const batteryStory = queries.getSupplyChainStory("generic-smartphone", { focusItemId: "battery" });
    const lithiumStory = queries.getSupplyChainStory("generic-smartphone", { focusItemId: "lithium" });
    expect(batteryStory).not.toBeNull();
    expect(lithiumStory).not.toBeNull();
    expect(lithiumStory!.nodes.some((node) => node.entity?.id === "country-au" && node.item?.id === "lithium")).toBe(true);

    const batteryRouteMap = createMapView(queries, { product: "generic-smartphone", layer: "supply-chain", focus: "battery" });
    const lithiumRouteMap = createMapView(queries, { product: "generic-smartphone", layer: "supply-chain", focus: "lithium" });
    const lithiumTradeMap = createMapView(queries, { product: "generic-smartphone", layer: "trade", items: "lithium" });
    expect(batteryRouteMap).not.toBeNull();
    expect(lithiumRouteMap).not.toBeNull();
    expect(lithiumRouteMap!.nodes.some((node) => node.countryId === "country-au")).toBe(true);
    expect(lithiumTradeMap).not.toBeNull();
    expect(lithiumTradeMap!.records.length).toBeGreaterThan(0);

    const ledger = queries.getCountryLedger("generic-smartphone", "country-au");
    expect(ledger).not.toBeNull();
  });
});

describe("exploded viewer core components stay product-id agnostic", () => {
  const coreSources = [
    "apps/web/components/exploded-three-viewer.tsx",
    "apps/web/components/exploded-explorer.tsx",
    "apps/web/components/exploded-canvas-viewer.tsx",
    "apps/web/components/exploded-iso-view.tsx",
    "apps/web/lib/exploded-appearance.ts",
    "apps/web/lib/exploded-layout.ts",
    "apps/web/lib/exploded-model.ts"
  ];

  it("does not branch on a specific product or item id in reusable code", async () => {
    for (const relative of coreSources) {
      const source = await readFile(resolve(relative), "utf8");
      expect(source, relative).not.toContain("generic-camera-drone");
      expect(source, relative).not.toContain("generic-smartphone");
    }
  });
});
