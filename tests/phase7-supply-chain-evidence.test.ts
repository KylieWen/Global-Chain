import { readFileSync, readdirSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import publishedSmartphone from "../data/published/smartphone/fixture.json";
import smartphoneSample from "../data/samples/smartphone/fixture.json";
import {
  FixtureLoaderError,
  loadFixtureRepositoryFromManifest,
  parseProductFixture
} from "@globe-chain/db";
import {
  createInMemoryFixtureRepository,
  createProductQueryService
} from "@globe-chain/domain";

const publishedManifestPath = resolve("data/published/manifest.json");
const previewManifestPath = resolve("data/samples/manifest.json");
const routeContentVersionId = "content-smartphone-route-2023-2";

async function loadPublishedQueries() {
  const repository = await loadFixtureRepositoryFromManifest(publishedManifestPath, {
    allowedStatuses: ["published"]
  });
  return createProductQueryService(repository);
}

function requireResult<T>(value: T | null | undefined, label: string): T {
  if (!value) throw new Error(`Expected ${label}`);
  return value;
}

function listSourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return listSourceFiles(path);
    return [".ts", ".tsx"].includes(extname(path)) ? [path] : [];
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

describe("phase 7 supply-chain evidence interpretation", () => {
  it("covers every published material and major battery-to-market stage", async () => {
    const queries = await loadPublishedQueries();
    const story = requireResult(
      queries.getSupplyChainStory("generic-smartphone", { label: "2023" }),
      "published smartphone story"
    );
    const expectedNodes = [
      ["node-au-lithium", "lithium", "extraction"],
      ["node-cd-cobalt", "cobalt", "extraction"],
      ["node-id-nickel", "nickel", "extraction"],
      ["node-cn-graphite", "graphite", "extraction"],
      ["node-cl-copper", "copper", "extraction"],
      ["node-au-aluminum", "aluminum", "extraction"],
      ["node-cn-cathode", "cathode-material", "refining"],
      ["node-cn-anode", "anode-material", "material_processing"],
      ["node-kr-cell", "cell", "component_manufacturing"],
      ["node-kr-module", "battery-module", "assembly"],
      ["node-cn-assembly", "generic-smartphone", "assembly"],
      ["node-us-export", "generic-smartphone", "distribution"],
      ["node-de-consumption", "generic-smartphone", "consumption"]
    ] as const;

    for (const [nodeId, itemId, processStageId] of expectedNodes) {
      expect(
        story.nodes.find((view) => view.node.id === nodeId),
        `missing ${nodeId}`
      ).toMatchObject({
        node: { id: nodeId },
        item: { id: itemId },
        processStage: { id: processStageId },
        period: { label: "2023" }
      });
    }

    expect(story.flows.map((view) => view.item?.id)).toEqual(
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
        "battery-module",
        "generic-smartphone"
      ])
    );
    expect(story.steps.map((view) => view.step.order)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("resolves evidence, sources, dataset and content versions for every node and edge", async () => {
    const queries = await loadPublishedQueries();
    const story = requireResult(
      queries.getSupplyChainStory("generic-smartphone", { label: "2023" }),
      "published smartphone story"
    );

    for (const node of story.nodes) {
      expect(node.node.evidenceIds.length, node.node.id).toBeGreaterThan(0);
      expect(node.evidence.map((record) => record.evidence.id).sort()).toEqual(
        [...node.node.evidenceIds].sort()
      );
      expect(node.evidence.every((record) => record.source?.id === record.evidence.sourceId)).toBe(
        true
      );
      expect(node.sources.length, node.node.id).toBeGreaterThan(0);
      expect(node.datasetVersion?.id).toBe(story.datasetVersion.id);
      expect(node.contentVersion?.id).toBe(routeContentVersionId);
      expect(node.period.label).toBe("2023");
    }

    for (const flow of story.flows) {
      expect(flow.flow.evidenceIds.length, flow.flow.id).toBeGreaterThan(0);
      expect(flow.evidence.map((record) => record.evidence.id).sort()).toEqual(
        [...flow.flow.evidenceIds].sort()
      );
      expect(flow.evidence.every((record) => record.source?.id === record.evidence.sourceId)).toBe(
        true
      );
      expect(flow.from.node).not.toBeNull();
      expect(flow.to.node).not.toBeNull();
      expect(flow.datasetVersion?.id).toBe(story.datasetVersion.id);
      expect(flow.contentVersion?.id).toBe(routeContentVersionId);
    }
  });

  it("marks mineral country roles as supported without promoting them to bilateral flows", async () => {
    const queries = await loadPublishedQueries();
    const story = requireResult(
      queries.getSupplyChainStory("generic-smartphone", { label: "2023" }),
      "published smartphone story"
    );
    const mineralNodeIds = [
      "node-au-lithium",
      "node-cd-cobalt",
      "node-id-nickel",
      "node-cn-graphite",
      "node-cl-copper",
      "node-au-aluminum"
    ];

    for (const nodeId of mineralNodeIds) {
      const node = requireResult(
        story.nodes.find((view) => view.node.id === nodeId),
        nodeId
      );
      expect(node.evidenceLevel).toMatchObject({
        code: "role_supported",
        supportsCountryRole: true,
        supportsBilateralFlow: false,
        isRepresentative: false
      });
      expect(node.evidence.some((record) => record.evidence.supportType === "country_role")).toBe(
        true
      );
      expect(node.evidence.some((record) => record.evidence.supportType === "bilateral_flow")).toBe(
        false
      );
    }
  });

  it("keeps every current edge representative and explicitly non-bilateral", async () => {
    const queries = await loadPublishedQueries();
    const story = requireResult(
      queries.getSupplyChainStory("generic-smartphone", { label: "2023" }),
      "published smartphone story"
    );

    expect(story.flows).toHaveLength(13);
    expect(
      story.flows.every(
        (view) =>
          view.flow.flowKind === "representative_supply" &&
          view.flow.evidenceLevel === "representative" &&
          view.evidenceLevel.code === "representative" &&
          view.evidenceLevel.isRepresentative &&
          !view.evidenceLevel.supportsBilateralFlow &&
          !view.evidence.some((record) => record.evidence.supportType === "bilateral_flow")
      )
    ).toBe(true);
  });

  it("keeps unknown route quantities distinct from a true observed zero", async () => {
    const publishedQueries = await loadPublishedQueries();
    const publishedStory = requireResult(
      publishedQueries.getSupplyChainStory("generic-smartphone", { label: "2023" }),
      "published smartphone story"
    );

    expect(
      publishedStory.flows.every(
        (view) =>
          view.flow.quantity === null &&
          view.quantityDataStatus === "unknown" &&
          view.flow.value === null &&
          view.valueDataStatus === "unknown"
      )
    ).toBe(true);

    const observedZeroFixture = structuredClone(smartphoneSample) as Record<string, unknown> & {
      storyGraph: { flows: Array<Record<string, unknown>> };
    };
    observedZeroFixture.storyGraph.flows[0].quantity = 0;
    observedZeroFixture.storyGraph.flows[0].unit = "kg";
    observedZeroFixture.storyGraph.flows[0].quantityDataStatus = "observed";
    const parsed = parseProductFixture(observedZeroFixture);
    const zeroQueries = createProductQueryService(createInMemoryFixtureRepository([parsed]));
    const zeroStory = requireResult(
      zeroQueries.getSupplyChainStory("generic-smartphone", { label: "2023" }),
      "mock story with observed zero"
    );
    const zeroFlow = requireResult(
      zeroStory.flows.find((view) => view.flow.id === observedZeroFixture.storyGraph.flows[0].id),
      "observed-zero flow"
    );
    expect(zeroFlow.flow.quantity).toBe(0);
    expect(zeroFlow.quantityDataStatus).toBe("observed");

    const contradictory = structuredClone(observedZeroFixture);
    contradictory.storyGraph.flows[0].quantityDataStatus = "unknown";
    try {
      parseProductFixture(contradictory);
      throw new Error("Expected unknown numeric quantity validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(FixtureLoaderError);
      expect((error as FixtureLoaderError).issues?.join("\n")).toContain(
        "unknown supply-flow quantities must be null"
      );
    }
  });

  it("does not merge the Australian aluminum activity into the lithium node", async () => {
    const queries = await loadPublishedQueries();
    const detail = requireResult(
      queries.getSupplyChainNode("generic-smartphone", "node-au-lithium"),
      "Australian lithium node"
    );

    expect(detail.productionActivities.map((view) => view.activity.id)).toEqual([
      "activity-au-lithium"
    ]);
    expect(detail.productionActivities[0].outputs.map((item) => item.id)).toEqual(["lithium"]);
    expect(detail.evidence.map((record) => record.evidence.id)).not.toContain(
      "evidence-usgs-australia-aluminum-role"
    );
  });

  it("does not make the assembly node inherit unrelated USGS mineral evidence", async () => {
    const queries = await loadPublishedQueries();
    const detail = requireResult(
      queries.getSupplyChainNode("generic-smartphone", "node-cn-assembly"),
      "China assembly node"
    );

    expect(detail.productionActivities.map((view) => view.activity.id)).toEqual([
      "activity-cn-assembly"
    ]);
    expect(detail.sources.map((source) => source.id)).not.toContain(
      "source-usgs-mineral-commodities"
    );
    expect(
      detail.evidence.some((record) => record.evidence.id.startsWith("evidence-usgs-"))
    ).toBe(false);
    expect(detail.node.evidenceLevel.code).toBe("role_supported");
  });

  it("returns resolved steps and only route-relevant source/evidence aggregates", async () => {
    const queries = await loadPublishedQueries();
    const story = requireResult(
      queries.getSupplyChainStory("generic-smartphone", { label: "2023" }),
      "published smartphone story"
    );

    expect(story.steps).toHaveLength(7);
    for (const step of story.steps) {
      expect(step.step.method).toBe("curated");
      expect(step.nodes.length + step.flows.length, step.step.id).toBeGreaterThan(0);
      expect(step.evidence.length, step.step.id).toBeGreaterThan(0);
      expect(step.sources.length, step.step.id).toBeGreaterThan(0);
      expect(step.contentVersion?.id).toBe(routeContentVersionId);
      expect(step.evidence.every((record) => record.source?.id === record.evidence.sourceId)).toBe(
        true
      );
    }

    const sourceIds = story.sources.map((source) => source.id);
    expect(sourceIds).toEqual(
      expect.arrayContaining([
        "source-usgs-mineral-commodities",
        "source-iea-battery-supply-chain",
        "source-un-comtrade",
        "source-globe-chain-route-methodology"
      ])
    );
    expect(sourceIds).not.toContain("source-world-bank-wdi");
    expect(sourceIds).not.toContain("source-un-m49");
    expect(story.evidence.length).toBeGreaterThanOrEqual(11);
    expect(story.evidence.map((record) => record.evidence.id)).not.toContain(
      "evidence-un-m49-crosswalk"
    );
  });

  it("exposes route methodology, limitations and content version through provenance", async () => {
    const queries = await loadPublishedQueries();
    const provenance = requireResult(
      queries.getProvenance("generic-smartphone"),
      "published provenance"
    );

    expect(provenance.route.method).toBe("curated");
    expect(provenance.route.representativeStatement).toContain("代表性策展路线");
    expect(provenance.route.methodology.length).toBeGreaterThanOrEqual(3);
    expect(provenance.route.methodology.some((text) => text.includes("双边流向"))).toBe(true);
    expect(provenance.route.limitations.length).toBeGreaterThanOrEqual(5);
    expect(provenance.route.limitations.some((text) => text.includes("13 条边"))).toBe(true);
    expect(provenance.route.contentVersion?.id).toBe(routeContentVersionId);
    expect(provenance.contentVersions).toHaveLength(1);
    expect(provenance.contentVersions[0]).toMatchObject({
      id: routeContentVersionId,
      status: "published"
    });
    expect(
      provenance.resolvedEvidence.every(
        (record) => record.source?.id === record.evidence.sourceId
      )
    ).toBe(true);
  });

  it("keeps the same resolved query contract for the generic coffee mock fixture", async () => {
    const repository = await loadFixtureRepositoryFromManifest(previewManifestPath, {
      allowedStatuses: ["draft"]
    });
    const queries = createProductQueryService(repository);
    const story = requireResult(
      queries.getSupplyChainStory("coffee", { label: "2023" }),
      "coffee mock story"
    );

    expect(story.product.id).toBe("coffee");
    expect(story.flows).toHaveLength(4);
    expect(story.steps).toHaveLength(3);
    expect(story.route).toMatchObject({
      method: "mock",
      representativeStatement: null,
      methodology: [],
      limitations: [],
      contentVersion: null
    });
    expect(story.nodes.every((node) => node.evidenceLevel.code === "none")).toBe(true);
    expect(story.flows.every((flow) => flow.evidenceLevel.code === "none")).toBe(true);
    expect(story.flows.every((flow) => flow.quantityDataStatus === "unknown")).toBe(true);
    expect(story.steps.every((step) => step.step.method === "mock")).toBe(true);
    expect(story.steps.every((step) => Array.isArray(step.nodes) && Array.isArray(step.flows))).toBe(
      true
    );
  });

  it("finds no product or material ID branching in Web page and component source", () => {
    const webFiles = [
      ...listSourceFiles(resolve("apps/web/app/products")),
      ...listSourceFiles(resolve("apps/web/components")),
      ...listSourceFiles(resolve("apps/web/lib"))
    ];
    const businessItemIds = publishedSmartphone.items.map((item) => item.id);
    const violations: string[] = [];

    for (const file of webFiles) {
      const source = readFileSync(file, "utf8");
      for (const itemId of businessItemIds) {
        const escaped = escapeRegExp(itemId);
        const branchingPatterns = [
          new RegExp(`(?:===|!==)\\s*["'\\\`]${escaped}["'\\\`]`),
          new RegExp(`case\\s+["'\\\`]${escaped}["'\\\`]`),
          new RegExp(
            `\\.(?:includes|startsWith|endsWith)\\(\\s*["'\\\`]${escaped}["'\\\`]`
          )
        ];
        if (branchingPatterns.some((pattern) => pattern.test(source))) {
          violations.push(`${file}: ${itemId}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
