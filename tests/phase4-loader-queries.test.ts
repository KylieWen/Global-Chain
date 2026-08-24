import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import smartphoneJson from "../data/samples/smartphone/fixture.json";
import {
  FixtureLoaderError,
  loadFixtureFile,
  loadFixtureRepositoryFromManifest,
  parseFixtureManifest,
  parseProductFixture
} from "@globe-chain/db";
import {
  createInMemoryFixtureRepository,
  createProductQueryService,
  type ProductBreakdownNode
} from "@globe-chain/domain";

const manifestPath = resolve("data/samples/manifest.json");
const smartphonePath = resolve("data/samples/smartphone/fixture.json");

const loadPreviewRepository = () =>
  loadFixtureRepositoryFromManifest(manifestPath, {
    allowedStatuses: ["draft", "published"]
  });

function findNode(root: ProductBreakdownNode, itemId: string): ProductBreakdownNode {
  if (root.item.id === itemId) return root;
  for (const child of root.children) {
    try {
      return findNode(child, itemId);
    } catch {
      // Continue searching sibling branches.
    }
  }
  throw new Error(`Missing breakdown node: ${itemId}`);
}

describe("fixture loader and domain queries", () => {
  it("loads all manifest fixtures and keeps draft status explicit", async () => {
    const repository = await loadPreviewRepository();

    expect(repository.listProductIds()).toEqual(["generic-smartphone", "coffee"]);
    expect(repository.getProductFixture("generic-smartphone")?.datasetVersion.status).toBe("draft");
    expect(repository.getProductFixture("missing-product")).toBeUndefined();
  });

  it("can enforce a published-only read boundary", async () => {
    const repository = await loadFixtureRepositoryFromManifest(manifestPath, {
      allowedStatuses: ["published"]
    });

    expect(repository.listProductIds()).toHaveLength(0);
  });

  it("rejects malformed fixtures at the loader boundary", () => {
    expect(() => parseProductFixture({})).toThrow(FixtureLoaderError);
    expect(() =>
      parseFixtureManifest({ schemaVersion: "fixture-manifest.v9", fixtures: [] })
    ).toThrow("Unsupported fixture manifest schema version");
    const unsupportedFixture = structuredClone(smartphoneJson) as typeof smartphoneJson;
    unsupportedFixture.schemaVersion = "product-fixture.v9";
    expect(() => parseProductFixture(unsupportedFixture)).toThrow(
      "Unsupported product fixture schema version"
    );
  });

  it("returns deeply frozen fixture data", async () => {
    const fixture = await loadFixtureFile(smartphonePath);
    expect(Object.isFrozen(fixture)).toBe(true);
    expect(Object.isFrozen(fixture.items)).toBe(true);

    const mutableFixture = fixture as unknown as { items: Array<{ name: string }> };
    expect(() => {
      mutableFixture.items[0].name = "tampered";
    }).toThrow();
  });

  it("exposes generic product overview and breakdown queries", async () => {
    const repository = await loadPreviewRepository();
    const queries = createProductQueryService(repository);
    const overview = queries.getProductOverview("generic-smartphone");
    const breakdown = queries.getProductBreakdown("generic-smartphone");

    expect(overview?.product.id).toBe("generic-smartphone");
    expect(overview?.directChildren.map((item) => item.id)).toContain("battery");
    expect(breakdown?.item.id).toBe("generic-smartphone");
    expect(findNode(breakdown!, "battery").children.map((node) => node.item.id)).toContain(
      "lithium"
    );
    expect(queries.getProductOverview("missing-product")).toBeNull();
    expect(queries.listProducts()).toHaveLength(2);
  });

  it("focuses the supply-chain story on a generic item subtree", async () => {
    const repository = await loadPreviewRepository();
    const queries = createProductQueryService(repository);
    const story = queries.getSupplyChainStory("generic-smartphone", {
      focusItemId: "battery",
      label: "2023"
    });

    expect(story?.flows.map((view) => view.item?.id)).toEqual(
      expect.arrayContaining([
        "lithium",
        "cobalt",
        "nickel",
        "graphite",
        "copper",
        "aluminum",
        "cathode-material",
        "anode-material",
        "cell",
        "battery-module"
      ])
    );
    expect(story?.flows.every((view) => view.flow.period.label === "2023")).toBe(true);
    expect(story?.flows[0].from.node?.entity?.name).toBeTruthy();
    expect(story?.warnings.some((warning) => warning.includes("合成"))).toBe(true);
    const storyFlowIds = new Set(story?.flows.map((view) => view.flow.id));
    expect(story?.steps.every((step) => step.flowIds.every((flowId) => storyFlowIds.has(flowId)))).toBe(true);
  });

  it("returns a country ledger without calculating unsupported totals", async () => {
    const repository = await loadPreviewRepository();
    const queries = createProductQueryService(repository);
    const ledger = queries.getCountryLedger("generic-smartphone", "country-cn", {
      label: "2023"
    });

    expect(ledger?.entity.iso3).toBe("CHN");
    expect(ledger?.tradeObservations.every((observation) => observation.reporterEntityId === "country-cn")).toBe(true);
    expect(ledger?.macroIndicators.every((observation) => observation.entityId === "country-cn")).toBe(true);
    expect(ledger?.relatedNodes.some((node) => node.node.id === "node-cn-assembly")).toBe(true);
    expect(ledger?.resolvedTradeObservations[0].partner?.iso3).toBe("USA");
    expect(ledger?.resolvedTradeObservations[0].item?.id).toBe("generic-smartphone");
    expect(ledger?.tradeObservations[0].value).toBeNull();
    expect(ledger?.tradeObservations[0].dataStatus).toBe("unknown");
    expect(queries.getCountryLedger("generic-smartphone", "missing-country")).toBeNull();
  });

  it("returns a node detail with inbound, outbound and provenance context", async () => {
    const repository = await loadFixtureRepositoryFromManifest(manifestPath, {
      allowedStatuses: ["draft"]
    });
    const queries = createProductQueryService(repository);
    const node = queries.getSupplyChainNode("generic-smartphone", "node-cn-assembly");
    const provenance = queries.getProvenance("generic-smartphone", {
      sourceIds: ["source-synthetic-demo"]
    });

    expect(node?.node.entity?.iso3).toBe("CHN");
    expect(node?.incomingFlows.length).toBeGreaterThan(0);
    expect(node?.outgoingFlows.some((flow) => flow.to.entity?.iso3 === "USA")).toBe(true);
    expect(node?.productionActivities.some((activity) => activity.outputItemIds.includes("generic-smartphone"))).toBe(true);
    expect(node?.evidence.map((record) => record.sourceId)).toContain("source-synthetic-demo");
    const cathode = queries.getSupplyChainNode("generic-smartphone", "node-cn-cathode");
    expect(cathode?.outgoingFlows.map((flow) => flow.flow.id)).toEqual(["flow-cathode-cell"]);
    expect(provenance?.sources).toHaveLength(1);
    expect(provenance?.evidence).toHaveLength(1);
  });

  it("keeps the same query API for coffee", async () => {
    const repository = await loadPreviewRepository();
    const queries = createProductQueryService(repository);
    const story = queries.getSupplyChainStory("coffee", { label: "2023" });

    expect(story?.product.id).toBe("coffee");
    expect(story?.flows).toHaveLength(4);
    expect(story?.flows.every((flow) => flow.item !== null)).toBe(true);
  });

  it("does not mutate a repository through query results", async () => {
    const repository = await loadPreviewRepository();
    const queries = createProductQueryService(repository);
    const overview = queries.getProductOverview("coffee");

    expect(Object.isFrozen(overview)).toBe(true);
    expect(Object.isFrozen(overview?.directChildren)).toBe(true);
    expect(repository.getProductFixture("coffee")?.items[0].name).toBe("咖啡（通用商品）");
  });

  it("guards the item tree against cycles even when a parsed fixture contains one", () => {
    const invalid = structuredClone(smartphoneJson) as typeof smartphoneJson;
    const root = invalid.items.find((item) => item.id === "generic-smartphone");
    if (!root) throw new Error("Fixture root missing in test data");
    root.parentItemId = "battery";
    const repository = createInMemoryFixtureRepository([parseProductFixture(invalid)]);
    const queries = createProductQueryService(repository);

    expect(() => queries.getProductBreakdown("generic-smartphone")).toThrow("Cycle detected");
  });

});
